// simulacros.js
// Rutas para guardar y consultar simulacros y sus resultados

const express = require('express');
const router = express.Router();
const db = require('../database');

// POST /api/simulacros/guardar
// Guarda un simulacro con esCorrecta ya calculado por el cliente (uso interno)
router.post('/guardar', async (req, res) => {
    const { estudianteId, grado, modulo, respuestas } = req.body;

    if (!estudianteId || !grado || !modulo || !respuestas || !Array.isArray(respuestas)) {
        return res.status(400).json({ exito: false, mensaje: 'Datos incompletos' });
    }

    try {
        const correctas = respuestas.filter(r => r.esCorrecta).length;
        const total = respuestas.length;
        const puntaje = total > 0 ? Math.round((correctas / total) * 100) : 0;

        const simulacroId = await db.guardarSimulacro(estudianteId, grado, modulo, total, correctas, puntaje);

        for (const r of respuestas) {
            await db.guardarRespuesta(simulacroId, r.preguntaId, r.respuestaDada, r.esCorrecta ? 1 : 0);
        }

        res.json({ exito: true, simulacroId, puntaje, correctas, total });
    } catch (error) {
        console.error('Error guardando simulacro:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// POST /api/simulacros/guardar-validado
// Guarda un simulacro validando las respuestas contra la base de datos
// El frontend nunca recibe las respuestas correctas, así que las validamos aquí
router.post('/guardar-validado', async (req, res) => {
    const { estudianteId, grado, modulo, respuestas } = req.body;

    if (!estudianteId || !grado || !modulo || !respuestas || !Array.isArray(respuestas)) {
        return res.status(400).json({ exito: false, mensaje: 'Datos incompletos' });
    }

    try {
        // Verificamos que el estudiante todavía tenga intentos disponibles para este módulo
        // (defensa adicional: el front ya bloquea esto antes de empezar el simulacro)
        const estadoIntento = await db.puedeIntentarModulo(estudianteId, grado, modulo);
        if (!estadoIntento.puede) {
            return res.status(403).json({
                exito: false,
                mensaje: 'Ya agotaste los intentos permitidos para este módulo. Pide a tu docente que te habilite un nuevo intento.'
            });
        }

        // Obtenemos las respuestas correctas de cada pregunta desde la BD
        const idsPreguntas = respuestas.map(r => r.preguntaId).filter(Boolean);
        if (idsPreguntas.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'No hay preguntas en el simulacro' });
        }

        const preguntasDB = await db.obtenerPreguntasPorIds(idsPreguntas);

        // Mapeamos id -> respuesta_correcta para comparación rápida
        const mapaRespuestas = {};
        preguntasDB.forEach(p => { mapaRespuestas[p.id] = p.respuesta_correcta; });

        // Calculamos cuántas fueron correctas
        let correctas = 0;
        const respuestasValidadas = respuestas.map(r => {
            const esCorrecta = r.respuestaDada && mapaRespuestas[r.preguntaId] === r.respuestaDada;
            if (esCorrecta) correctas++;
            return { ...r, esCorrecta };
        });

        const total = respuestas.length;
        const puntaje = total > 0 ? Math.round((correctas / total) * 100) : 0;

        const simulacroId = await db.guardarSimulacro(estudianteId, grado, modulo, total, correctas, puntaje);

        for (const r of respuestasValidadas) {
            await db.guardarRespuesta(simulacroId, r.preguntaId, r.respuestaDada || '', r.esCorrecta ? 1 : 0);
        }

        res.json({ exito: true, simulacroId, puntaje, correctas, total });
    } catch (error) {
        console.error('Error guardando simulacro validado:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/simulacros/historial/:estudianteId
// Devuelve el historial de simulacros de un estudiante
router.get('/historial/:estudianteId', async (req, res) => {
    try {
        const historial = await db.obtenerHistorialEstudiante(req.params.estudianteId);
        res.json({ exito: true, historial });
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/simulacros/revision/:simulacroId
// Devuelve las respuestas detalladas de un simulacro para revisión
router.get('/revision/:simulacroId', async (req, res) => {
    try {
        const respuestas = await db.obtenerRespuestasSimulacro(req.params.simulacroId);
        res.json({ exito: true, respuestas });
    } catch (error) {
        console.error('Error obteniendo revisión:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/simulacros/estadisticas
// Devuelve estadísticas generales de todos los estudiantes (para el docente)
router.get('/estadisticas', async (req, res) => {
    try {
        const estadisticas = await db.obtenerEstadisticasGenerales();
        res.json({ exito: true, estadisticas });
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/simulacros/estado-intentos?estudianteId=&grado=
// Devuelve, para cada módulo del grado, cuántos intentos usó el estudiante,
// cuántos tiene permitidos y si puede volver a intentarlo
router.get('/estado-intentos', async (req, res) => {
    const { estudianteId, grado } = req.query;
    if (!estudianteId || !grado) {
        return res.status(400).json({ exito: false, mensaje: 'Estudiante y grado son obligatorios' });
    }
    try {
        const estado = await db.obtenerEstadoIntentos(estudianteId, grado);
        res.json({ exito: true, estado });
    } catch (error) {
        console.error('Error obteniendo estado de intentos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// POST /api/simulacros/habilitar-reintento
// El docente otorga un intento adicional a un estudiante para un módulo específico
// GET /api/simulacros/intentos-grado?grado=
// Devuelve cuantos intentos por modulo estan permitidos para todo un grado
router.get('/intentos-grado', async (req, res) => {
    const { grado } = req.query;
    if (!grado) {
        return res.status(400).json({ exito: false, mensaje: 'Grado obligatorio' });
    }
    try {
        const intentos = await db.obtenerIntentosPermitidos(grado);
        res.json({ exito: true, grado, intentos });
    } catch (error) {
        console.error('Error obteniendo intentos por grado:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// PUT /api/simulacros/intentos-grado
// El docente define cuantas veces puede hacerse cada modulo en un grado completo
router.put('/intentos-grado', async (req, res) => {
    const { grado, intentos } = req.body;
    const intentosNumero = parseInt(intentos, 10);

    if (!grado || Number.isNaN(intentosNumero)) {
        return res.status(400).json({ exito: false, mensaje: 'Grado e intentos son obligatorios' });
    }

    if (intentosNumero < 0 || intentosNumero > 10) {
        return res.status(400).json({ exito: false, mensaje: 'Los intentos deben estar entre 0 (ilimitado) y 10' });
    }

    try {
        await db.establecerIntentosPermitidos(grado, intentosNumero);
        res.json({
            exito: true,
            grado,
            intentos: intentosNumero,
            mensaje: 'Intentos por grado actualizados'
        });
    } catch (error) {
        console.error('Error guardando intentos por grado:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

module.exports = router;

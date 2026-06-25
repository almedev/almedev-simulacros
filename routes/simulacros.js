const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');
const authEstudiante = require('../middleware/authEstudiante');
const simulacrosService = require('../services/simulacros');

// POST /api/simulacros/guardar-validado
router.post('/guardar-validado', authEstudiante, async (req, res, next) => {
    const { estudianteId, grado, modulo, respuestas } = req.body;

    if (!estudianteId || !grado || !modulo || !respuestas || !Array.isArray(respuestas)) {
        return res.status(400).json({ exito: false, mensaje: 'Datos incompletos' });
    }
    if (parseInt(estudianteId) !== req.estudiante.id) {
        return res.status(403).json({ exito: false, mensaje: 'No puedes enviar simulacros en nombre de otro estudiante' });
    }

    try {
        const resultado = await simulacrosService.procesarSimulacro(estudianteId, grado, modulo, respuestas);
        res.json({ exito: true, ...resultado });
    } catch (error) {
        if (error.code === 'INTENTOS_AGOTADOS') {
            return res.status(409).json({ exito: false, mensaje: error.message });
        }
        if (error.code === 'SIN_PREGUNTAS') {
            return res.status(400).json({ exito: false, mensaje: error.message });
        }
        next(error);
    }
});

// GET /api/simulacros/historial/:estudianteId
router.get('/historial/:estudianteId', authEstudiante, async (req, res) => {
    if (parseInt(req.params.estudianteId) !== req.estudiante.id) {
        return res.status(403).json({ exito: false, mensaje: 'No puedes ver el historial de otro estudiante' });
    }
    const historial = await db.obtenerHistorialEstudiante(req.params.estudianteId);
    res.json({ exito: true, historial });
});

// GET /api/simulacros/revision/:simulacroId
router.get('/revision/:simulacroId', authEstudiante, async (req, res) => {
    const simulacro = await db.obtenerSimulacroPorId(req.params.simulacroId);
    if (!simulacro || simulacro.estudiante_id !== req.estudiante.id) {
        return res.status(403).json({ exito: false, mensaje: 'No puedes ver la revisión de otro estudiante' });
    }
    const respuestas = await db.obtenerRespuestasSimulacro(req.params.simulacroId);
    res.json({ exito: true, respuestas });
});

// GET /api/simulacros/estadisticas
router.get('/estadisticas', authDocente, async (req, res) => {
    const estadisticas = await db.obtenerEstadisticasGenerales();
    res.json({ exito: true, estadisticas });
});

// GET /api/simulacros/estado-intentos
router.get('/estado-intentos', authEstudiante, async (req, res) => {
    const { estudianteId, grado } = req.query;
    if (!estudianteId || !grado) {
        return res.status(400).json({ exito: false, mensaje: 'Estudiante y grado son obligatorios' });
    }
    if (parseInt(estudianteId) !== req.estudiante.id) {
        return res.status(403).json({ exito: false, mensaje: 'No puedes ver los intentos de otro estudiante' });
    }
    const estado = await db.obtenerEstadoIntentos(estudianteId, grado);
    res.json({ exito: true, estado });
});

// GET /api/simulacros/intentos-grado
router.get('/intentos-grado', authDocente, async (req, res) => {
    const { grado } = req.query;
    if (!grado) {
        return res.status(400).json({ exito: false, mensaje: 'Grado obligatorio' });
    }
    const intentos = await db.obtenerIntentosPermitidos(grado);
    res.json({ exito: true, grado, intentos });
});

// PUT /api/simulacros/intentos-grado
router.put('/intentos-grado', authDocente, async (req, res) => {
    const { grado, intentos } = req.body;
    const intentosNumero = parseInt(intentos, 10);

    if (!grado || Number.isNaN(intentosNumero)) {
        return res.status(400).json({ exito: false, mensaje: 'Grado e intentos son obligatorios' });
    }
    if (intentosNumero < 0 || intentosNumero > 10) {
        return res.status(400).json({ exito: false, mensaje: 'Los intentos deben estar entre 0 (ilimitado) y 10' });
    }

    await db.establecerIntentosPermitidos(grado, intentosNumero);
    res.json({ exito: true, grado, intentos: intentosNumero, mensaje: 'Intentos por grado actualizados' });
});

module.exports = router;

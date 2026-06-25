const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');
const authEstudiante = require('../middleware/authEstudiante');
const { validarPregunta } = require('../middleware/validar');

// GET /api/preguntas — lista para el docente
router.get('/', authDocente, async (req, res) => {
    const { grado, modulo } = req.query;
    const preguntas = await db.obtenerTodasPreguntas(grado, modulo);
    res.json({ exito: true, preguntas });
});

// GET /api/preguntas/simulacro — preguntas aleatorias para el estudiante (sin respuestas)
router.get('/simulacro', authEstudiante, async (req, res) => {
    const { grado, modulo, cantidad, estudianteId } = req.query;

    if (!grado || !modulo || !estudianteId) {
        return res.status(400).json({ exito: false, mensaje: 'Grado, módulo y estudiante son obligatorios' });
    }

    if (parseInt(estudianteId) !== req.estudiante.id) {
        return res.status(403).json({ exito: false, mensaje: 'No puedes hacer simulacros en nombre de otro estudiante' });
    }

    const estadoIntento = await db.puedeIntentarModulo(estudianteId, grado, modulo);
    if (!estadoIntento.puede) {
        return res.status(403).json({
            exito: false,
            mensaje: 'Ya respondiste este módulo. Pide a tu docente que te habilite un nuevo intento.'
        });
    }

    const cant = parseInt(cantidad) || 10;
    const total = await db.contarPreguntas(grado, modulo);

    if (total === 0) {
        return res.status(404).json({ exito: false, mensaje: 'No hay preguntas para este grado y módulo' });
    }

    const preguntas = await db.obtenerPreguntasSimulacro(grado, modulo, Math.min(cant, total));
    const preguntasSinRespuesta = preguntas.map(p => ({
        id: p.id,
        enunciado: p.enunciado,
        opcion_a: p.opcion_a,
        opcion_b: p.opcion_b,
        opcion_c: p.opcion_c,
        opcion_d: p.opcion_d
    }));
    res.json({ exito: true, preguntas: preguntasSinRespuesta });
});

// POST /api/preguntas — agrega pregunta (solo docente)
router.post('/', authDocente, validarPregunta, async (req, res) => {
    const { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, justificacion } = req.body;
    await db.insertarPregunta({ grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta: respuesta_correcta.toUpperCase(), justificacion });
    res.json({ exito: true, mensaje: 'Pregunta agregada correctamente' });
});

// PUT /api/preguntas/:id — actualiza pregunta (solo docente)
router.put('/:id', authDocente, validarPregunta, async (req, res) => {
    const { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, justificacion } = req.body;
    await db.actualizarPregunta(req.params.id, { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta: respuesta_correcta.toUpperCase(), justificacion });
    res.json({ exito: true, mensaje: 'Pregunta actualizada correctamente' });
});

// DELETE /api/preguntas/:id — elimina pregunta (solo docente)
router.delete('/:id', authDocente, async (req, res) => {
    await db.eliminarPregunta(req.params.id);
    res.json({ exito: true, mensaje: 'Pregunta eliminada' });
});

module.exports = router;

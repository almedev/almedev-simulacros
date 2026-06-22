// preguntas.js
// Rutas para gestión del banco de preguntas

const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/preguntas
// Obtiene preguntas filtrando por grado y/o módulo (para el docente)
router.get('/', async (req, res) => {
    try {
        const { grado, modulo } = req.query;
        const preguntas = await db.obtenerTodasPreguntas(grado, modulo);
        res.json({ exito: true, preguntas });
    } catch (error) {
        console.error('Error obteniendo preguntas:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/preguntas/simulacro
// Devuelve preguntas aleatorias para un simulacro (para el estudiante)
router.get('/simulacro', async (req, res) => {
    const { grado, modulo, cantidad, estudianteId } = req.query;

    if (!grado || !modulo || !estudianteId) {
        return res.status(400).json({ exito: false, mensaje: 'Grado, módulo y estudiante son obligatorios' });
    }

    try {
        // Verificamos que el estudiante todavía tenga intentos disponibles para este módulo
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
        // Quitamos la respuesta correcta y justificación antes de enviarlas al estudiante
        const preguntasSinRespuesta = preguntas.map(p => ({
            id: p.id,
            enunciado: p.enunciado,
            opcion_a: p.opcion_a,
            opcion_b: p.opcion_b,
            opcion_c: p.opcion_c,
            opcion_d: p.opcion_d
        }));
        res.json({ exito: true, preguntas: preguntasSinRespuesta });
    } catch (error) {
        console.error('Error obteniendo preguntas para simulacro:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// POST /api/preguntas
// Agrega una nueva pregunta al banco (solo docente)
router.post('/', async (req, res) => {
    const { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, justificacion } = req.body;

    if (!grado || !modulo || !enunciado || !opcion_a || !opcion_b || !opcion_c || !opcion_d || !respuesta_correcta) {
        return res.status(400).json({ exito: false, mensaje: 'Faltan campos obligatorios' });
    }

    if (!['A', 'B', 'C', 'D'].includes(respuesta_correcta.toUpperCase())) {
        return res.status(400).json({ exito: false, mensaje: 'La respuesta correcta debe ser A, B, C o D' });
    }

    try {
        await db.insertarPregunta({ grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta: respuesta_correcta.toUpperCase(), justificacion });
        res.json({ exito: true, mensaje: 'Pregunta agregada correctamente' });
    } catch (error) {
        console.error('Error insertando pregunta:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// PUT /api/preguntas/:id
// Actualiza una pregunta existente (solo docente)
router.put('/:id', async (req, res) => {
    const { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, justificacion } = req.body;

    if (!grado || !modulo || !enunciado || !opcion_a || !opcion_b || !opcion_c || !opcion_d || !respuesta_correcta) {
        return res.status(400).json({ exito: false, mensaje: 'Faltan campos obligatorios' });
    }

    try {
        await db.actualizarPregunta(req.params.id, { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta: respuesta_correcta.toUpperCase(), justificacion });
        res.json({ exito: true, mensaje: 'Pregunta actualizada correctamente' });
    } catch (error) {
        console.error('Error actualizando pregunta:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// DELETE /api/preguntas/:id
// Elimina una pregunta del banco (solo docente)
router.delete('/:id', async (req, res) => {
    try {
        await db.eliminarPregunta(req.params.id);
        res.json({ exito: true, mensaje: 'Pregunta eliminada' });
    } catch (error) {
        console.error('Error eliminando pregunta:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

module.exports = router;

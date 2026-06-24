// estudiantes.js
// Rutas para registro y consulta de estudiantes

const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');

// POST /api/estudiantes/registro
// Registra un estudiante nuevo con documento, nombre, grado y contraseña
router.post('/registro', authDocente, async (req, res) => {
    const { documento, nombre, grado, contrasena } = req.body;

    if (!documento || !nombre || !grado || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Todos los campos son obligatorios' });
    }

    const gradosValidos = ['Grado 11A', 'Grado 11B'];
    if (!gradosValidos.includes(grado)) {
        return res.status(400).json({ exito: false, mensaje: 'Grado no válido' });
    }

    try {
        const resultado = await db.registrarEstudiante(documento, nombre, grado, contrasena);
        if (!resultado.exito) {
            return res.status(409).json(resultado);
        }
        const estudiante = await db.verificarEstudiante(documento, contrasena);
        res.json({
            exito: true,
            estudiante: {
                id: estudiante.id,
                nombre: estudiante.nombre,
                documento: estudiante.documento,
                grado: estudiante.grado
            }
        });
    } catch (error) {
        console.error('Error registrando estudiante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// GET /api/estudiantes
// Devuelve la lista completa de estudiantes (solo para el docente)
router.get('/', authDocente, async (req, res) => {
    try {
        const estudiantes = await db.obtenerTodosEstudiantes();
        res.json({ exito: true, estudiantes });
    } catch (error) {
        console.error('Error obteniendo estudiantes:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// DELETE /api/estudiantes/:id
// Elimina un estudiante por su ID (solo para el docente)
router.delete('/:id', authDocente, async (req, res) => {
    try {
        await db.eliminarEstudiante(req.params.id);
        res.json({ exito: true, mensaje: 'Estudiante eliminado' });
    } catch (error) {
        console.error('Error eliminando estudiante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');

const GRADOS_VALIDOS = ['Grado 11A', 'Grado 11B'];

// POST /api/estudiantes/registro
router.post('/registro', authDocente, async (req, res) => {
    const { documento, nombre, grado, contrasena } = req.body;

    if (!documento || !nombre || !grado || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Todos los campos son obligatorios' });
    }
    if (!GRADOS_VALIDOS.includes(grado)) {
        return res.status(400).json({ exito: false, mensaje: 'Grado no válido' });
    }

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
});

// POST /api/estudiantes/registro-lote
router.post('/registro-lote', authDocente, async (req, res) => {
    const { estudiantes, grado } = req.body;

    if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
        return res.status(400).json({ exito: false, mensaje: 'Se requiere un array de estudiantes' });
    }
    if (estudiantes.length > 500) {
        return res.status(400).json({ exito: false, mensaje: 'Máximo 500 estudiantes por lote' });
    }
    if (!GRADOS_VALIDOS.includes(grado)) {
        return res.status(400).json({ exito: false, mensaje: 'Grado no válido' });
    }

    const resultados = [];
    const validos = [];
    for (const est of estudiantes) {
        if (!est.documento || !est.nombre || !est.contrasena) {
            resultados.push({ documento: est.documento || '', exito: false, mensaje: 'Datos incompletos' });
        } else {
            validos.push(est);
        }
    }

    const resultado = await db.registrarEstudiantesLote(validos, grado);
    res.json({ exito: true, resultados: [...resultados, ...resultado] });
});

// GET /api/estudiantes
router.get('/', authDocente, async (req, res) => {
    const estudiantes = await db.obtenerTodosEstudiantes();
    res.json({ exito: true, estudiantes });
});

// DELETE /api/estudiantes/:id
router.delete('/:id', authDocente, async (req, res) => {
    await db.eliminarEstudiante(req.params.id);
    res.json({ exito: true, mensaje: 'Estudiante eliminado' });
});

module.exports = router;

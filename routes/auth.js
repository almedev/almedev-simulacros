// auth.js
// Rutas de autenticación para estudiantes y docentes

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');

// POST /api/auth/estudiante
// El estudiante ingresa con su número de documento y contraseña
router.post('/estudiante', async (req, res) => {
    const { documento, contrasena } = req.body;

    if (!documento || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Documento y contraseña son obligatorios' });
    }

    try {
        const estudiante = await db.verificarEstudiante(documento, contrasena);
        if (!estudiante) {
            return res.status(401).json({ exito: false, mensaje: 'Documento o contraseña incorrectos' });
        }
        // Devolvemos los datos básicos del estudiante (sin contraseña)
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
        console.error('Error en login estudiante:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});


// POST /api/auth/docente
// El docente ingresa con usuario y contraseña
router.post('/docente', async (req, res) => {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Usuario y contraseña son obligatorios' });
    }

    try {
        const docente = await db.verificarUsuario(usuario, contrasena);
        if (!docente) {
            return res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
        }
        const token = jwt.sign({ rol: 'docente' }, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ exito: true, token });
    } catch (error) {
        console.error('Error en login docente:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../database');

// POST /api/auth/estudiante
router.post('/estudiante', async (req, res) => {
    const { documento, contrasena } = req.body;

    if (!documento || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Documento y contraseña son obligatorios' });
    }

    const estudiante = await db.verificarEstudiante(documento, contrasena);
    if (!estudiante) {
        return res.status(401).json({ exito: false, mensaje: 'Documento o contraseña incorrectos' });
    }
    const token = jwt.sign({ rol: 'estudiante', id: estudiante.id }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({
        exito: true,
        token,
        estudiante: {
            id: estudiante.id,
            nombre: estudiante.nombre,
            documento: estudiante.documento,
            grado: estudiante.grado
        }
    });
});

// POST /api/auth/docente
router.post('/docente', async (req, res) => {
    const { usuario, contrasena } = req.body;

    if (!usuario || !contrasena) {
        return res.status(400).json({ exito: false, mensaje: 'Usuario y contraseña son obligatorios' });
    }

    const docente = await db.verificarUsuario(usuario, contrasena);
    if (!docente) {
        return res.status(401).json({ exito: false, mensaje: 'Usuario o contraseña incorrectos' });
    }
    const token = jwt.sign({ rol: 'docente', id: docente.id, usuario: docente.usuario }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ exito: true, token });
});

module.exports = router;

// modulos.js
// Rutas para gestión de módulos temáticos (cada módulo pertenece a un grado)

const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');

// GET /api/modulos?grado=Grado%206 — lista módulos, filtrando por grado si se indica
router.get('/', async (req, res) => {
    try {
        const modulos = await db.obtenerModulos(req.query.grado);
        res.json({ exito: true, modulos });
    } catch (error) {
        console.error('Error obteniendo módulos:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// POST /api/modulos — crea un módulo nuevo para un grado
router.post('/', authDocente, async (req, res) => {
    const { grado, nombre } = req.body;
    if (!grado || !nombre || !nombre.trim()) {
        return res.status(400).json({ exito: false, mensaje: 'Grado y nombre son obligatorios' });
    }
    try {
        await db.insertarModulo(grado, nombre.trim());
        res.json({ exito: true, mensaje: 'Módulo creado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ exito: false, mensaje: 'Ya existe ese módulo en este grado' });
        }
        console.error('Error creando módulo:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// PUT /api/modulos/:id — actualiza grado y/o nombre de un módulo
router.put('/:id', authDocente, async (req, res) => {
    const { grado, nombre } = req.body;
    if (!grado || !nombre || !nombre.trim()) {
        return res.status(400).json({ exito: false, mensaje: 'Grado y nombre son obligatorios' });
    }
    try {
        await db.actualizarModulo(req.params.id, grado, nombre.trim());
        res.json({ exito: true, mensaje: 'Módulo actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ exito: false, mensaje: 'Ya existe ese módulo en este grado' });
        }
        console.error('Error actualizando módulo:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

// DELETE /api/modulos/:id — elimina un módulo
router.delete('/:id', authDocente, async (req, res) => {
    try {
        await db.eliminarModulo(req.params.id);
        res.json({ exito: true, mensaje: 'Módulo eliminado' });
    } catch (error) {
        console.error('Error eliminando módulo:', error);
        res.status(500).json({ exito: false, mensaje: 'Error interno del servidor' });
    }
});

module.exports = router;

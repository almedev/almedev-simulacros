const express = require('express');
const router = express.Router();
const db = require('../database');
const authDocente = require('../middleware/authDocente');
const { validarModulo } = require('../middleware/validar');

// GET /api/modulos
router.get('/', async (req, res) => {
    const modulos = await db.obtenerModulos(req.query.grado);
    res.json({ exito: true, modulos });
});

// POST /api/modulos
router.post('/', authDocente, validarModulo, async (req, res, next) => {
    const { grado, nombre } = req.body;
    try {
        await db.insertarModulo(grado, nombre.trim());
        res.json({ exito: true, mensaje: 'Módulo creado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ exito: false, mensaje: 'Ya existe ese módulo en este grado' });
        }
        next(error);
    }
});

// PUT /api/modulos/:id
router.put('/:id', authDocente, validarModulo, async (req, res, next) => {
    const { grado, nombre } = req.body;
    try {
        await db.actualizarModulo(req.params.id, grado, nombre.trim());
        res.json({ exito: true, mensaje: 'Módulo actualizado' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ exito: false, mensaje: 'Ya existe ese módulo en este grado' });
        }
        next(error);
    }
});

// DELETE /api/modulos/:id
router.delete('/:id', authDocente, async (req, res) => {
    await db.eliminarModulo(req.params.id);
    res.json({ exito: true, mensaje: 'Módulo eliminado' });
});

module.exports = router;

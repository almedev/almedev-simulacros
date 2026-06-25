function validarPregunta(req, res, next) {
    const { grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta } = req.body;
    if (!grado || !modulo || !enunciado || !opcion_a || !opcion_b || !opcion_c || !opcion_d || !respuesta_correcta) {
        return res.status(400).json({ exito: false, mensaje: 'Faltan campos obligatorios' });
    }
    if (!['A', 'B', 'C', 'D'].includes(respuesta_correcta.toUpperCase())) {
        return res.status(400).json({ exito: false, mensaje: 'La respuesta correcta debe ser A, B, C o D' });
    }
    next();
}

function validarModulo(req, res, next) {
    const { grado, nombre } = req.body;
    if (!grado || !nombre || !nombre.trim()) {
        return res.status(400).json({ exito: false, mensaje: 'Grado y nombre son obligatorios' });
    }
    next();
}

module.exports = { validarPregunta, validarModulo };

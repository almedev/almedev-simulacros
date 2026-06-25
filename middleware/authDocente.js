const jwt = require('jsonwebtoken');

function authDocente(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ exito: false, mensaje: 'Acceso no autorizado' });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload.rol !== 'docente') {
            return res.status(403).json({ exito: false, mensaje: 'Acceso denegado' });
        }
        req.docente = { id: payload.id, usuario: payload.usuario };
        next();
    } catch {
        return res.status(403).json({ exito: false, mensaje: 'Token inválido o expirado' });
    }
}

module.exports = authDocente;

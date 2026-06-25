const { db, hashContrasena } = require('./conexion');

async function verificarUsuario(usuario, contrasena) {
    const hash = hashContrasena(contrasena);
    const [rows] = await db.execute(
        'SELECT id, usuario FROM usuarios WHERE usuario = ? AND contrasena = ?',
        [usuario, hash]
    );
    return rows[0] || null;
}

module.exports = { verificarUsuario };

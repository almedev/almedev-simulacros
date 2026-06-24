const { db } = require('./conexion');

async function obtenerModulos(grado) {
    if (grado) {
        const [rows] = await db.execute('SELECT * FROM modulos WHERE grado = ? ORDER BY nombre', [grado]);
        return rows;
    }
    const [rows] = await db.execute('SELECT * FROM modulos ORDER BY grado, nombre');
    return rows;
}

async function insertarModulo(grado, nombre) {
    await db.execute('INSERT INTO modulos (grado, nombre) VALUES (?, ?)', [grado, nombre]);
}

async function actualizarModulo(id, grado, nombre) {
    await db.execute('UPDATE modulos SET grado = ?, nombre = ? WHERE id = ?', [grado, nombre, id]);
}

async function eliminarModulo(id) {
    await db.execute('DELETE FROM modulos WHERE id = ?', [id]);
}

module.exports = { obtenerModulos, insertarModulo, actualizarModulo, eliminarModulo };

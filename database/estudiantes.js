const { db, hashContrasena } = require('./conexion');

async function buscarEstudiantePorDocumento(documento) {
    const [rows] = await db.execute('SELECT * FROM estudiantes WHERE documento = ?', [documento]);
    return rows[0] || null;
}

async function registrarEstudiante(documento, nombre, grado, contrasena) {
    const existe = await buscarEstudiantePorDocumento(documento);
    if (existe) return { exito: false, mensaje: 'El documento ya está registrado' };
    const fecha = new Date();
    const hash = hashContrasena(contrasena);
    await db.execute(
        'INSERT INTO estudiantes (documento, nombre, grado, contrasena, contrasena_plana, fecha_registro) VALUES (?, ?, ?, ?, ?, ?)',
        [documento, nombre, grado, hash, contrasena, fecha]
    );
    return { exito: true };
}

async function verificarEstudiante(documento, contrasena) {
    const estudiante = await buscarEstudiantePorDocumento(documento);
    if (!estudiante) return null;
    if (estudiante.contrasena !== hashContrasena(contrasena)) return null;
    return estudiante;
}

async function obtenerTodosEstudiantes() {
    const [rows] = await db.execute(
        'SELECT id, documento, nombre, grado, contrasena_plana, fecha_registro FROM estudiantes ORDER BY nombre'
    );
    return rows;
}

async function eliminarEstudiante(id) {
    await db.execute('DELETE FROM estudiantes WHERE id = ?', [id]);
}

module.exports = {
    buscarEstudiantePorDocumento,
    registrarEstudiante,
    verificarEstudiante,
    obtenerTodosEstudiantes,
    eliminarEstudiante
};

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

async function registrarEstudiantesLote(listaEstudiantes, grado) {
    if (listaEstudiantes.length === 0) return [];

    const documentos = listaEstudiantes.map(e => String(e.documento));
    const placeholders = documentos.map(() => '?').join(',');
    const [existentes] = await db.execute(
        `SELECT documento FROM estudiantes WHERE documento IN (${placeholders})`,
        documentos
    );
    const existentesSet = new Set(existentes.map(r => String(r.documento)));

    const resultados = [];
    const paraInsertar = [];

    for (const est of listaEstudiantes) {
        if (existentesSet.has(String(est.documento))) {
            resultados.push({ documento: est.documento, exito: false, mensaje: 'Documento ya registrado' });
        } else {
            paraInsertar.push(est);
            resultados.push({ documento: est.documento, exito: true });
        }
    }

    if (paraInsertar.length > 0) {
        const fecha = new Date();
        const values = paraInsertar.map(e => [
            String(e.documento), e.nombre, grado,
            hashContrasena(String(e.contrasena)), String(e.contrasena), fecha
        ]);
        await db.query('INSERT INTO estudiantes (documento, nombre, grado, contrasena, contrasena_plana, fecha_registro) VALUES ?', [values]);
    }

    return resultados;
}

module.exports = {
    buscarEstudiantePorDocumento,
    registrarEstudiante,
    registrarEstudiantesLote,
    verificarEstudiante,
    obtenerTodosEstudiantes,
    eliminarEstudiante
};

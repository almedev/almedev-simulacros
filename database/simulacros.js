const { db } = require('./conexion');
const { obtenerModulos } = require('./modulos');

async function guardarSimulacro(estudianteId, grado, modulo, total, correctas, puntaje) {
    const fecha = new Date();
    const [result] = await db.execute(
        `INSERT INTO simulacros (estudiante_id, grado, modulo, fecha, total_preguntas, correctas, puntaje)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [estudianteId, grado, modulo, fecha, total, correctas, puntaje]
    );
    return result.insertId;
}

async function guardarRespuestas(simulacroId, respuestas) {
    if (!respuestas.length) return;
    const placeholders = respuestas.map(() => '(?, ?, ?, ?)').join(', ');
    const valores = respuestas.flatMap(r => [simulacroId, r.preguntaId, r.respuestaDada, r.esCorrecta]);
    await db.execute(
        `INSERT INTO respuestas (simulacro_id, pregunta_id, respuesta_dada, es_correcta) VALUES ${placeholders}`,
        valores
    );
}

async function obtenerIntentosPermitidos(grado) {
    const [rows] = await db.execute(
        'SELECT intentos_permitidos FROM configuracion_grados WHERE grado = ?',
        [grado]
    );
    return rows[0] ? rows[0].intentos_permitidos : 1;
}

async function establecerIntentosPermitidos(grado, intentos) {
    await db.execute(
        `INSERT INTO configuracion_grados (grado, intentos_permitidos) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE intentos_permitidos = ?`,
        [grado, intentos, intentos]
    );
}

async function puedeIntentarModulo(estudianteId, grado, modulo) {
    const [usadosRows] = await db.execute(
        'SELECT COUNT(*) as total FROM simulacros WHERE estudiante_id = ? AND grado = ? AND modulo = ?',
        [estudianteId, grado, modulo]
    );
    const usados = usadosRows[0].total;
    const permitidos = await obtenerIntentosPermitidos(grado);
    return { usados, permitidos, puede: permitidos === 0 || usados < permitidos };
}

async function obtenerEstadoIntentos(estudianteId, grado) {
    const [usadosRows] = await db.execute(
        'SELECT modulo, COUNT(*) as usados FROM simulacros WHERE estudiante_id = ? AND grado = ? GROUP BY modulo',
        [estudianteId, grado]
    );
    const usadosMap = {};
    usadosRows.forEach(r => { usadosMap[r.modulo] = r.usados; });

    const permitidos = await obtenerIntentosPermitidos(grado);
    const modulos = await obtenerModulos(grado);
    const estado = {};
    modulos.forEach(m => {
        const usados = usadosMap[m.nombre] || 0;
        estado[m.nombre] = { usados, permitidos, puede: permitidos === 0 || usados < permitidos };
    });
    return estado;
}

async function obtenerHistorialEstudiante(estudianteId) {
    const [rows] = await db.execute(
        'SELECT * FROM simulacros WHERE estudiante_id = ? ORDER BY fecha DESC',
        [estudianteId]
    );
    return rows;
}

async function obtenerEstadisticasGenerales() {
    const [rows] = await db.execute(`
        SELECT s.estudiante_id, e.nombre, e.grado, s.grado AS grado_simulacro, s.modulo, s.fecha,
               s.total_preguntas, s.correctas, s.puntaje,
               (SELECT DISTINCT p.grado FROM preguntas p
                WHERE p.modulo = s.modulo AND p.grado = s.grado LIMIT 1) AS grado_modulo
        FROM simulacros s
        JOIN estudiantes e ON s.estudiante_id = e.id
        ORDER BY s.fecha DESC
    `);
    return rows;
}

async function obtenerRespuestasSimulacro(simulacroId) {
    const [rows] = await db.execute(`
        SELECT r.respuesta_dada, r.es_correcta, p.enunciado,
               p.respuesta_correcta, p.justificacion,
               p.opcion_a, p.opcion_b, p.opcion_c, p.opcion_d
        FROM respuestas r
        JOIN preguntas p ON r.pregunta_id = p.id
        WHERE r.simulacro_id = ?
    `, [simulacroId]);
    return rows;
}

module.exports = {
    guardarSimulacro,
    guardarRespuestas,
    obtenerIntentosPermitidos,
    establecerIntentosPermitidos,
    puedeIntentarModulo,
    obtenerEstadoIntentos,
    obtenerHistorialEstudiante,
    obtenerEstadisticasGenerales,
    obtenerRespuestasSimulacro
};

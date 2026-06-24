const { db } = require('./conexion');

async function obtenerPreguntasSimulacro(grado, modulo, cantidad) {
    // 1. Traer solo IDs — usa idx_preg_grado_mod, sin leer filas completas
    const [idRows] = await db.execute(
        'SELECT id FROM preguntas WHERE grado = ? AND modulo = ?',
        [grado, modulo]
    );
    if (idRows.length === 0) return [];

    // 2. Fisher-Yates en memoria — O(n), sin carga en MySQL
    const ids = idRows.map(r => r.id);
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    // 3. Traer solo las filas seleccionadas por PK
    const seleccionados = ids.slice(0, Math.min(parseInt(cantidad, 10) || 10, ids.length));
    const placeholders = seleccionados.map(() => '?').join(',');
    const [rows] = await db.execute(
        `SELECT * FROM preguntas WHERE id IN (${placeholders})`,
        seleccionados
    );

    // 4. Restaurar el orden barajado (IN no garantiza orden)
    const orden = new Map(seleccionados.map((id, i) => [id, i]));
    rows.sort((a, b) => orden.get(a.id) - orden.get(b.id));
    return rows;
}

async function obtenerTodasPreguntas(grado, modulo) {
    if (grado && modulo) {
        const [rows] = await db.execute(
            'SELECT * FROM preguntas WHERE grado = ? AND modulo = ?', [grado, modulo]
        );
        return rows;
    } else if (grado) {
        const [rows] = await db.execute('SELECT * FROM preguntas WHERE grado = ?', [grado]);
        return rows;
    }
    const [rows] = await db.execute('SELECT * FROM preguntas');
    return rows;
}

async function insertarPregunta(datos) {
    await db.execute(
        `INSERT INTO preguntas (grado, modulo, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, justificacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [datos.grado, datos.modulo, datos.enunciado, datos.opcion_a, datos.opcion_b,
         datos.opcion_c, datos.opcion_d, datos.respuesta_correcta, datos.justificacion]
    );
}

async function actualizarPregunta(id, datos) {
    await db.execute(
        `UPDATE preguntas SET grado=?, modulo=?, enunciado=?, opcion_a=?, opcion_b=?,
         opcion_c=?, opcion_d=?, respuesta_correcta=?, justificacion=? WHERE id=?`,
        [datos.grado, datos.modulo, datos.enunciado, datos.opcion_a, datos.opcion_b,
         datos.opcion_c, datos.opcion_d, datos.respuesta_correcta, datos.justificacion, id]
    );
}

async function eliminarPregunta(id) {
    await db.execute('DELETE FROM preguntas WHERE id = ?', [id]);
}

async function obtenerPreguntasPorIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.execute(
        `SELECT id, respuesta_correcta FROM preguntas WHERE id IN (${placeholders})`,
        ids
    );
    return rows;
}

async function contarPreguntas(grado, modulo) {
    const [rows] = await db.execute(
        'SELECT COUNT(*) as total FROM preguntas WHERE grado = ? AND modulo = ?',
        [grado, modulo]
    );
    return rows[0].total;
}

module.exports = {
    obtenerPreguntasSimulacro,
    obtenerTodasPreguntas,
    insertarPregunta,
    actualizarPregunta,
    eliminarPregunta,
    obtenerPreguntasPorIds,
    contarPreguntas
};

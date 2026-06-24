const { db } = require('./conexion');

async function obtenerPreguntasSimulacro(grado, modulo, cantidad) {
    // mysql2 falla al pasar LIMIT como parámetro (?) en execute(); como "cantidad"
    // es un número validado con parseInt en la ruta, es seguro interpolarlo directo.
    const limite = parseInt(cantidad, 10) || 10;
    const [rows] = await db.execute(
        `SELECT * FROM preguntas WHERE grado = ? AND modulo = ? ORDER BY RAND() LIMIT ${limite}`,
        [grado, modulo]
    );
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

// database.js
// Manejo de la base de datos MySQL

require('dotenv').config();
const mysql = require('mysql2');
const crypto = require('crypto');

// Conexión a MySQL
// charset utf8mb4 es necesario para que las tildes y ñ se guarden y lean correctamente
const conexion = mysql.createPool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT || 3306,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
});

const db = conexion.promise();

function hashContrasena(contrasena) {
    return crypto.createHash('sha256').update(contrasena).digest('hex');
}

async function inicializar() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS preguntas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grado VARCHAR(20) NOT NULL,
            modulo VARCHAR(100) NOT NULL,
            enunciado TEXT NOT NULL,
            opcion_a TEXT NOT NULL,
            opcion_b TEXT NOT NULL,
            opcion_c TEXT NOT NULL,
            opcion_d TEXT NOT NULL,
            respuesta_correcta VARCHAR(1) NOT NULL,
            justificacion TEXT
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS estudiantes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            documento VARCHAR(20) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            grado VARCHAR(20) NOT NULL,
            contrasena VARCHAR(100) NOT NULL,
            contrasena_plana VARCHAR(100) NOT NULL DEFAULT '',
            fecha_registro DATETIME NOT NULL
        )
    `);

    // Agrega la columna si la tabla ya existía sin ella (compatible con MySQL antiguo)
    const [columnas] = await db.execute(`
        SELECT COUNT(*) as total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'estudiantes' AND COLUMN_NAME = 'contrasena_plana'
    `);
    if (columnas[0].total === 0) {
        await db.execute(`ALTER TABLE estudiantes ADD COLUMN contrasena_plana VARCHAR(100) NOT NULL DEFAULT ''`);
    }

    await db.execute(`
        CREATE TABLE IF NOT EXISTS simulacros (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estudiante_id INT NOT NULL,
            grado VARCHAR(20) NOT NULL,
            modulo VARCHAR(100) NOT NULL,
            fecha DATETIME NOT NULL,
            total_preguntas INT NOT NULL,
            correctas INT NOT NULL,
            puntaje FLOAT NOT NULL
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS respuestas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            simulacro_id INT NOT NULL,
            pregunta_id INT NOT NULL,
            respuesta_dada VARCHAR(1) NOT NULL,
            es_correcta TINYINT NOT NULL
        )
    `);

    // Configuración de intentos permitidos por grado: el docente define un número
    // (1 a 10) que aplica a todos los estudiantes y todos los módulos de ese grado
    await db.execute(`
        CREATE TABLE IF NOT EXISTS configuracion_grados (
            grado VARCHAR(20) PRIMARY KEY,
            intentos_permitidos INT NOT NULL DEFAULT 1
        )
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            usuario VARCHAR(50) NOT NULL,
            contrasena VARCHAR(100) NOT NULL
        )
    `);

    // Tabla de módulos temáticos (gestionable por el docente, uno por grado)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS modulos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grado VARCHAR(20) NOT NULL DEFAULT '',
            nombre VARCHAR(100) NOT NULL,
            UNIQUE KEY grado_nombre (grado, nombre)
        )
    `);

    // Agrega la columna grado si la tabla ya existía sin ella (compatible con MySQL antiguo)
    const [columnasModulos] = await db.execute(`
        SELECT COUNT(*) as total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modulos' AND COLUMN_NAME = 'grado'
    `);
    if (columnasModulos[0].total === 0) {
        await db.execute(`ALTER TABLE modulos ADD COLUMN grado VARCHAR(20) NOT NULL DEFAULT ''`);
    }

    // Elimina los módulos genéricos antiguos (de antes de asociar módulo a grado)
    await db.execute(`DELETE FROM modulos WHERE grado = ''`);

    // Inserta los módulos base de cada grado solo si ese grado todavía no tiene ninguno
    const modulosBase = [
        ['Grado 6', 'El universo'],
        ['Grado 6', 'La tierra, nuestro planeta'],
        ['Grado 6', 'Geografía física del mundo'],
        ['Grado 6', 'Mesopotamia y Egipto'],
        ['Grado 6', 'Civilizaciones de India y China'],
        ['Grado 6', 'Grecia y Roma'],
        ['Grado 6', 'Las civilizaciones del continente americano'],
        ['Grado 6', 'Nuestros pasados indígenas'],
        ['Grado 7', 'Estado y región'],
        ['Grado 7', 'Las regiones de Colombia'],
        ['Grado 7', 'El mundo político'],
        ['Grado 7', 'Ética y ciudadanía'],
        ['Grado 7', 'El mundo medieval'],
        ['Grado 7', 'Los inicios de la modernidad'],
        ['Grado 7', 'Conquista y colonia en América'],
        ['Grado 7', 'La colonia en nuestro territorio'],
        ['Grado 8', 'La geografía humana'],
        ['Grado 8', 'Los ecosistemas y los seres humanos'],
        ['Grado 8', 'Los seres humanos y el deterioro ambiental'],
        ['Grado 8', 'Democracia y sistema político en Colombia'],
        ['Grado 8', 'Una época de revoluciones: 1776-1850'],
        ['Grado 8', 'El territorio colombiano en la primera mitad del siglo XIX'],
        ['Grado 8', 'El mundo en la segunda mitad del siglo XIX'],
        ['Grado 8', 'Los principios de la modernización en Colombia'],
        ['Grado 9', 'Geografía económica y sociedad'],
        ['Grado 9', 'Estados y geografía económica'],
        ['Grado 9', 'Los sectores económicos en el mundo'],
        ['Grado 9', 'Gobierno y poder político'],
        ['Grado 9', 'El mundo durante la primera mitad del siglo XX'],
        ['Grado 9', 'Colombia durante la primera mitad del siglo XX'],
        ['Grado 9', 'El mundo de la segunda mitad del siglo XX a la actualidad'],
        ['Grado 9', 'Colombia desde la segunda mitad del siglo XX a la actualidad'],
        ['Grado 10', 'El crecimiento demográfico y la superpoblación'],
        ['Grado 10', 'El deterioro ambiental y la sostenibilidad'],
        ['Grado 10', 'El sistema mundo'],
        ['Grado 10', 'El pensamiento político y social moderno'],
        ['Grado 10', 'Nacionalismos y conflicto'],
        ['Grado 10', 'Los derechos humanos'],
        ['Grado 10', 'Los movimientos y las reformas sociales en América Latina'],
        ['Grado 10', 'La violencia y el conflicto en Colombia'],
        ['Grado 11', 'Historia económica latinoamericana'],
        ['Grado 11', 'Globalización y sociedad'],
        ['Grado 11', 'Ecología y desarrollo sostenible'],
        ['Grado 11', 'Grupos étnicos y población'],
        ['Grado 11', 'Del caudillismo a la democracia'],
        ['Grado 11', 'Género y sociedad en América Latina'],
        ['Grado 11', 'La configuración del mundo actual'],
        ['Grado 11', 'Normatividad internacional y conflicto armado']
    ];
    const gradosBase = [...new Set(modulosBase.map(m => m[0]))];
    for (const grado of gradosBase) {
        const [existentes] = await db.execute('SELECT COUNT(*) as total FROM modulos WHERE grado = ?', [grado]);
        if (existentes[0].total === 0) {
            for (const [g, nombre] of modulosBase.filter(m => m[0] === grado)) {
                await db.execute('INSERT INTO modulos (grado, nombre) VALUES (?, ?)', [g, nombre]);
            }
        }
    }

    const [docentes] = await db.execute('SELECT COUNT(*) as total FROM usuarios');
    if (docentes[0].total === 0) {
        const hash = hashContrasena('K7mP4xQ9tR');
        await db.execute('INSERT INTO usuarios (usuario, contrasena) VALUES (?, ?)', ['1056554610', hash]);
    }

    const [preguntas] = await db.execute('SELECT COUNT(*) as total FROM preguntas');
    if (preguntas[0].total === 0) {
        await insertarPreguntasMuestra();
    }

    console.log('Base de datos lista.');
}

// ================================
// ESTUDIANTES
// ================================

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

// ================================
// PREGUNTAS
// ================================

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

// ================================
// SIMULACROS
// ================================

async function guardarSimulacro(estudianteId, grado, modulo, total, correctas, puntaje) {
    const fecha = new Date();
    const [result] = await db.execute(
        `INSERT INTO simulacros (estudiante_id, grado, modulo, fecha, total_preguntas, correctas, puntaje)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [estudianteId, grado, modulo, fecha, total, correctas, puntaje]
    );
    return result.insertId;
}

async function guardarRespuesta(simulacroId, preguntaId, respuestaDada, esCorrecta) {
    await db.execute(
        'INSERT INTO respuestas (simulacro_id, pregunta_id, respuesta_dada, es_correcta) VALUES (?, ?, ?, ?)',
        [simulacroId, preguntaId, respuestaDada, esCorrecta]
    );
}

// ================================
// CONTROL DE INTENTOS POR MÓDULO
// ================================

// Devuelve cuántos intentos están permitidos por módulo en un grado (1 a 10).
// Si el docente no ha configurado nada, el valor por defecto es 1.
async function obtenerIntentosPermitidos(grado) {
    const [rows] = await db.execute(
        'SELECT intentos_permitidos FROM configuracion_grados WHERE grado = ?',
        [grado]
    );
    return rows[0] ? rows[0].intentos_permitidos : 1;
}

// El docente define cuántos intentos se permiten por módulo para todo un grado
async function establecerIntentosPermitidos(grado, intentos) {
    await db.execute(
        `INSERT INTO configuracion_grados (grado, intentos_permitidos) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE intentos_permitidos = ?`,
        [grado, intentos, intentos]
    );
}

// Verifica si un estudiante puede intentar un módulo, según el límite configurado para el grado
async function puedeIntentarModulo(estudianteId, grado, modulo) {
    const [usadosRows] = await db.execute(
        'SELECT COUNT(*) as total FROM simulacros WHERE estudiante_id = ? AND grado = ? AND modulo = ?',
        [estudianteId, grado, modulo]
    );
    const usados = usadosRows[0].total;
    const permitidos = await obtenerIntentosPermitidos(grado);

    return { usados, permitidos, puede: permitidos === 0 || usados < permitidos };
}

// Devuelve el estado de intentos (usados/permitidos/puede) de TODOS los módulos
// de un grado para un estudiante, en un solo objeto { nombreModulo: {...} }
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

// ================================
// USUARIO DOCENTE
// ================================

async function verificarUsuario(usuario, contrasena) {
    const hash = hashContrasena(contrasena);
    const [rows] = await db.execute(
        'SELECT id FROM usuarios WHERE usuario = ? AND contrasena = ?',
        [usuario, hash]
    );
    return rows[0] || null;
}

// ================================
// PREGUNTAS DE MUESTRA
// ================================



// ================================
// MÓDULOS
// ================================

// Si se pasa grado, filtra solo los módulos de ese grado; si no, devuelve todos
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

module.exports = {
    inicializar,
    buscarEstudiantePorDocumento,
    registrarEstudiante,
    verificarEstudiante,
    obtenerTodosEstudiantes,
    eliminarEstudiante,
    obtenerPreguntasSimulacro,
    obtenerTodasPreguntas,
    insertarPregunta,
    actualizarPregunta,
    eliminarPregunta,
    contarPreguntas,
    obtenerPreguntasPorIds,
    guardarSimulacro,
    guardarRespuesta,
    obtenerHistorialEstudiante,
    obtenerEstadisticasGenerales,
    obtenerRespuestasSimulacro,
    verificarUsuario,
    obtenerModulos,
    insertarModulo,
    actualizarModulo,
    eliminarModulo,
    puedeIntentarModulo,
    obtenerEstadoIntentos,
    obtenerIntentosPermitidos,
    establecerIntentosPermitidos
};

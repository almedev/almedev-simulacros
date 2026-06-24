const { db, hashContrasena } = require('./conexion');

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

    await db.execute(`
        CREATE TABLE IF NOT EXISTS modulos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            grado VARCHAR(20) NOT NULL DEFAULT '',
            nombre VARCHAR(100) NOT NULL,
            UNIQUE KEY grado_nombre (grado, nombre)
        )
    `);

    const [columnasModulos] = await db.execute(`
        SELECT COUNT(*) as total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'modulos' AND COLUMN_NAME = 'grado'
    `);
    if (columnasModulos[0].total === 0) {
        await db.execute(`ALTER TABLE modulos ADD COLUMN grado VARCHAR(20) NOT NULL DEFAULT ''`);
    }

    await db.execute(`DELETE FROM modulos WHERE grado = ''`);

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

    console.log('Base de datos lista.');
}

module.exports = { inicializar };

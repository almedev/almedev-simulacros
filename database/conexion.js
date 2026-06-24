require('dotenv').config();

const mysql = require('mysql2');
const crypto = require('crypto');

const conexion = mysql.createPool(
    process.env.DATABASE_URL || {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        charset: 'utf8mb4'
    }
);

const db = conexion.promise();

function hashContrasena(contrasena) {
    return crypto.createHash('sha256').update(contrasena).digest('hex');
}

module.exports = { db, hashContrasena };

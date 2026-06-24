require('dotenv').config();

const REQUERIDAS = ['JWT_SECRET', 'DOCENTE_USUARIO', 'DOCENTE_CONTRASENA'];
const faltantes = REQUERIDAS.filter(v => !process.env[v]);
if (faltantes.length > 0) {
    console.error(`[ARRANQUE] Faltan variables de entorno obligatorias: ${faltantes.join(', ')}`);
    console.error('[ARRANQUE] Define estas variables en .env o en la plataforma de despliegue.');
    process.exit(1);
}

const app = require('./app');
const db = require('./database');

const PORT = process.env.PORT || 3000;

async function arrancar() {
    await db.inicializar();
    app.listen(PORT, () => {
        console.log(`Almedev corriendo en http://localhost:${PORT}`);
    });
}

arrancar();

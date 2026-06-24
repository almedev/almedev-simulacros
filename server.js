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

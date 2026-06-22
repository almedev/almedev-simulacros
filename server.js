// server.js
// Archivo principal del servidor de Almedev

const express = require('express');
const path = require('path');
const db = require('./database');

// Importamos todas las rutas
const authRoutes = require('./routes/auth');
const estudiantesRoutes = require('./routes/estudiantes');
const preguntasRoutes = require('./routes/preguntas');
const simulacrosRoutes = require('./routes/simulacros');
const modulosRoutes = require('./routes/modulos');

const app = express();
const PORT = 3000;

// Permite recibir JSON en el cuerpo de las peticiones
app.use(express.json());

// Archivos estáticos (HTML, CSS, JS del frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Conectamos cada grupo de rutas a su prefijo de URL
app.use('/api/auth', authRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/preguntas', preguntasRoutes);
app.use('/api/simulacros', simulacrosRoutes);
app.use('/api/modulos', modulosRoutes);

async function arrancar() {
    await db.inicializar();
    app.listen(PORT, () => {
        console.log(`Almedev corriendo en http://localhost:${PORT}`);
    });
}

arrancar();

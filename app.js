const express = require('express');
const path = require('path');

const authRoutes = require('./routes/auth');
const estudiantesRoutes = require('./routes/estudiantes');
const preguntasRoutes = require('./routes/preguntas');
const simulacrosRoutes = require('./routes/simulacros');
const modulosRoutes = require('./routes/modulos');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/preguntas', preguntasRoutes);
app.use('/api/simulacros', simulacrosRoutes);
app.use('/api/modulos', modulosRoutes);

module.exports = app;

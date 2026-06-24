const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const estudiantesRoutes = require('./routes/estudiantes');
const preguntasRoutes = require('./routes/preguntas');
const simulacrosRoutes = require('./routes/simulacros');
const modulosRoutes = require('./routes/modulos');

const app = express();

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", "'unsafe-inline'"],      // scripts inline en docente/estudiante
            'script-src-attr': ["'unsafe-inline'"],            // onclick/onchange inline
        }
    }
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { exito: false, mensaje: 'Demasiados intentos. Espera 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/estudiantes', estudiantesRoutes);
app.use('/api/preguntas', preguntasRoutes);
app.use('/api/simulacros', simulacrosRoutes);
app.use('/api/modulos', modulosRoutes);

module.exports = app;

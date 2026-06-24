const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

jest.mock('../database', () => ({
    verificarUsuario: jest.fn(),
    obtenerTodosEstudiantes: jest.fn(),
    eliminarEstudiante: jest.fn(),
    insertarModulo: jest.fn(),
    eliminarModulo: jest.fn(),
    insertarPregunta: jest.fn(),
    eliminarPregunta: jest.fn(),
    obtenerEstadisticasGenerales: jest.fn(),
    establecerIntentosPermitidos: jest.fn(),
    inicializar: jest.fn()
}));

const db = require('../database');

function tokenValido() {
    return jwt.sign({ rol: 'docente' }, process.env.JWT_SECRET || 'almedev_jwt_secret_2025_profe_aldana', { expiresIn: '1h' });
}

describe('Rutas protegidas — sin token', () => {
    test('GET /api/estudiantes devuelve 401', async () => {
        const res = await request(app).get('/api/estudiantes');
        expect(res.status).toBe(401);
    });

    test('DELETE /api/estudiantes/1 devuelve 401', async () => {
        const res = await request(app).delete('/api/estudiantes/1');
        expect(res.status).toBe(401);
    });

    test('POST /api/modulos devuelve 401', async () => {
        const res = await request(app).post('/api/modulos').send({ grado: 'Grado 11', nombre: 'Test' });
        expect(res.status).toBe(401);
    });

    test('DELETE /api/preguntas/1 devuelve 401', async () => {
        const res = await request(app).delete('/api/preguntas/1');
        expect(res.status).toBe(401);
    });

    test('GET /api/simulacros/estadisticas devuelve 401', async () => {
        const res = await request(app).get('/api/simulacros/estadisticas');
        expect(res.status).toBe(401);
    });
});

describe('Rutas protegidas — con token válido', () => {
    test('GET /api/estudiantes devuelve 200', async () => {
        db.obtenerTodosEstudiantes.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/estudiantes')
            .set('Authorization', `Bearer ${tokenValido()}`);

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });

    test('DELETE /api/estudiantes/1 devuelve 200', async () => {
        db.eliminarEstudiante.mockResolvedValue();

        const res = await request(app)
            .delete('/api/estudiantes/1')
            .set('Authorization', `Bearer ${tokenValido()}`);

        expect(res.status).toBe(200);
    });

    test('GET /api/simulacros/estadisticas devuelve 200', async () => {
        db.obtenerEstadisticasGenerales.mockResolvedValue([]);

        const res = await request(app)
            .get('/api/simulacros/estadisticas')
            .set('Authorization', `Bearer ${tokenValido()}`);

        expect(res.status).toBe(200);
    });
});

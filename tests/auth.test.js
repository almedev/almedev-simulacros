const request = require('supertest');
const app = require('../app');

jest.mock('../database', () => ({
    verificarUsuario: jest.fn(),
    verificarEstudiante: jest.fn(),
    buscarEstudiantePorDocumento: jest.fn(),
    inicializar: jest.fn()
}));

const db = require('../database');

describe('POST /api/auth/docente', () => {
    test('devuelve token con credenciales correctas', async () => {
        db.verificarUsuario.mockResolvedValue({ id: 1 });

        const res = await request(app)
            .post('/api/auth/docente')
            .send({ usuario: '1056554610', contrasena: 'K7mP4xQ9tR' });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.token).toBeDefined();
    });

    test('devuelve 401 con credenciales incorrectas', async () => {
        db.verificarUsuario.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/docente')
            .send({ usuario: '1056554610', contrasena: 'incorrecta' });

        expect(res.status).toBe(401);
        expect(res.body.exito).toBe(false);
    });

    test('devuelve 400 si faltan campos', async () => {
        const res = await request(app)
            .post('/api/auth/docente')
            .send({ usuario: '1056554610' });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/auth/estudiante', () => {
    test('devuelve datos del estudiante con credenciales correctas', async () => {
        db.verificarEstudiante.mockResolvedValue({
            id: 1, nombre: 'Juan Pérez', documento: '123456', grado: 'Grado 11A'
        });

        const res = await request(app)
            .post('/api/auth/estudiante')
            .send({ documento: '123456', contrasena: 'clave123' });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.estudiante.nombre).toBe('Juan Pérez');
    });

    test('devuelve 401 con credenciales incorrectas', async () => {
        db.verificarEstudiante.mockResolvedValue(null);

        const res = await request(app)
            .post('/api/auth/estudiante')
            .send({ documento: '123456', contrasena: 'incorrecta' });

        expect(res.status).toBe(401);
        expect(res.body.exito).toBe(false);
    });
});

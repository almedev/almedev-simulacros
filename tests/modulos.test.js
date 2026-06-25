const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

jest.mock('../database', () => ({
    obtenerModulos: jest.fn(),
    insertarModulo: jest.fn(),
    actualizarModulo: jest.fn(),
    eliminarModulo: jest.fn(),
    inicializar: jest.fn(),
}));

const db = require('../database');

function tokenDocente() {
    return jwt.sign({ rol: 'docente', id: 1, usuario: 'docente_test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('GET /api/modulos', () => {
    test('devuelve módulos sin autenticación', async () => {
        db.obtenerModulos.mockResolvedValue([{ id: 1, nombre: 'Módulo 1' }]);
        const res = await request(app).get('/api/modulos');
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });
});

describe('POST /api/modulos', () => {
    test('crea módulo con datos válidos', async () => {
        db.insertarModulo.mockResolvedValue();
        const res = await request(app)
            .post('/api/modulos')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', nombre: 'Historia' });
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });

    test('devuelve 400 si falta grado o nombre', async () => {
        const res = await request(app)
            .post('/api/modulos')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 si nombre es solo espacios', async () => {
        const res = await request(app)
            .post('/api/modulos')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', nombre: '   ' });
        expect(res.status).toBe(400);
    });

    test('devuelve 409 si el módulo ya existe en ese grado', async () => {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        db.insertarModulo.mockRejectedValue(err);
        const res = await request(app)
            .post('/api/modulos')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', nombre: 'Historia' });
        expect(res.status).toBe(409);
        expect(res.body.exito).toBe(false);
    });

    test('devuelve 401 sin token', async () => {
        const res = await request(app)
            .post('/api/modulos')
            .send({ grado: 'Grado 11', nombre: 'Historia' });
        expect(res.status).toBe(401);
    });
});

describe('PUT /api/modulos/:id', () => {
    test('actualiza módulo con datos válidos', async () => {
        db.actualizarModulo.mockResolvedValue();
        const res = await request(app)
            .put('/api/modulos/1')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', nombre: 'Historia actualizada' });
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });

    test('devuelve 409 si el nombre ya existe en ese grado', async () => {
        const err = new Error('Duplicate entry');
        err.code = 'ER_DUP_ENTRY';
        db.actualizarModulo.mockRejectedValue(err);
        const res = await request(app)
            .put('/api/modulos/1')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', nombre: 'Historia' });
        expect(res.status).toBe(409);
    });
});

describe('DELETE /api/modulos/:id', () => {
    test('elimina módulo existente', async () => {
        db.eliminarModulo.mockResolvedValue();
        const res = await request(app)
            .delete('/api/modulos/1')
            .set('Authorization', `Bearer ${tokenDocente()}`);
        expect(res.status).toBe(200);
        expect(db.eliminarModulo).toHaveBeenCalledWith('1');
    });
});

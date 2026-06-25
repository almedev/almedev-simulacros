const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

jest.mock('../database', () => ({
    obtenerTodasPreguntas: jest.fn(),
    insertarPregunta: jest.fn(),
    actualizarPregunta: jest.fn(),
    eliminarPregunta: jest.fn(),
    inicializar: jest.fn(),
}));

const db = require('../database');

function tokenDocente() {
    return jwt.sign({ rol: 'docente', id: 1, usuario: 'docente_test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const PREGUNTA_VALIDA = {
    grado: 'Grado 11',
    modulo: 'Módulo 1',
    enunciado: '¿Cuál es la capital de Colombia?',
    opcion_a: 'Bogotá',
    opcion_b: 'Medellín',
    opcion_c: 'Cali',
    opcion_d: 'Barranquilla',
    respuesta_correcta: 'A',
    justificacion: 'Bogotá es la capital.',
};

describe('GET /api/preguntas', () => {
    test('devuelve lista con token docente', async () => {
        db.obtenerTodasPreguntas.mockResolvedValue([PREGUNTA_VALIDA]);
        const res = await request(app)
            .get('/api/preguntas')
            .set('Authorization', `Bearer ${tokenDocente()}`);
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(Array.isArray(res.body.preguntas)).toBe(true);
    });
});

describe('POST /api/preguntas', () => {
    test('crea pregunta con datos válidos', async () => {
        db.insertarPregunta.mockResolvedValue();
        const res = await request(app)
            .post('/api/preguntas')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send(PREGUNTA_VALIDA);
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });

    test('devuelve 400 si falta un campo obligatorio', async () => {
        const { enunciado, ...sinEnunciado } = PREGUNTA_VALIDA;
        const res = await request(app)
            .post('/api/preguntas')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send(sinEnunciado);
        expect(res.status).toBe(400);
    });

    test('devuelve 400 si respuesta_correcta no es A-D', async () => {
        const res = await request(app)
            .post('/api/preguntas')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ ...PREGUNTA_VALIDA, respuesta_correcta: 'E' });
        expect(res.status).toBe(400);
    });

    test('acepta respuesta_correcta en minúscula', async () => {
        db.insertarPregunta.mockResolvedValue();
        const res = await request(app)
            .post('/api/preguntas')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ ...PREGUNTA_VALIDA, respuesta_correcta: 'b' });
        expect(res.status).toBe(200);
        expect(db.insertarPregunta).toHaveBeenCalledWith(
            expect.objectContaining({ respuesta_correcta: 'B' })
        );
    });
});

describe('PUT /api/preguntas/:id', () => {
    test('actualiza pregunta con datos válidos', async () => {
        db.actualizarPregunta.mockResolvedValue();
        const res = await request(app)
            .put('/api/preguntas/1')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send(PREGUNTA_VALIDA);
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
    });

    test('devuelve 400 si faltan campos', async () => {
        const res = await request(app)
            .put('/api/preguntas/1')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11' });
        expect(res.status).toBe(400);
    });
});

describe('DELETE /api/preguntas/:id', () => {
    test('elimina pregunta existente', async () => {
        db.eliminarPregunta.mockResolvedValue();
        const res = await request(app)
            .delete('/api/preguntas/1')
            .set('Authorization', `Bearer ${tokenDocente()}`);
        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(db.eliminarPregunta).toHaveBeenCalledWith('1');
    });
});

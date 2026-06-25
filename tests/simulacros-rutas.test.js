const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

// Mockeamos el servicio de simulacros para probar solo la capa HTTP
jest.mock('../services/simulacros', () => ({
    procesarSimulacro: jest.fn(),
}));

jest.mock('../database', () => ({
    obtenerHistorialEstudiante: jest.fn(),
    obtenerSimulacroPorId: jest.fn(),
    obtenerRespuestasSimulacro: jest.fn(),
    obtenerEstadisticasGenerales: jest.fn(),
    obtenerEstadoIntentos: jest.fn(),
    obtenerIntentosPermitidos: jest.fn(),
    establecerIntentosPermitidos: jest.fn(),
    inicializar: jest.fn(),
}));

const db = require('../database');
const simulacrosService = require('../services/simulacros');

function tokenEstudiante(id = 10) {
    return jwt.sign({ rol: 'estudiante', id }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
function tokenDocente() {
    return jwt.sign({ rol: 'docente', id: 1, usuario: 'docente_test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const PAYLOAD_VALIDO = {
    estudianteId: 10,
    grado: 'Grado 11',
    modulo: 'Módulo 1',
    respuestas: [{ preguntaId: 1, respuestaDada: 'A' }],
};

describe('POST /api/simulacros/guardar-validado', () => {
    test('guarda y devuelve resultado cuando el servicio tiene éxito', async () => {
        simulacrosService.procesarSimulacro.mockResolvedValue({ simulacroId: 5, puntaje: 80, correctas: 4, total: 5 });

        const res = await request(app)
            .post('/api/simulacros/guardar-validado')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`)
            .send(PAYLOAD_VALIDO);

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.puntaje).toBe(80);
    });

    test('devuelve 400 si faltan campos obligatorios', async () => {
        const res = await request(app)
            .post('/api/simulacros/guardar-validado')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`)
            .send({ estudianteId: 10, grado: 'Grado 11' });
        expect(res.status).toBe(400);
    });

    test('devuelve 403 si el estudianteId no coincide con el token', async () => {
        const res = await request(app)
            .post('/api/simulacros/guardar-validado')
            .set('Authorization', `Bearer ${tokenEstudiante(99)}`) // token de estudiante 99
            .send({ ...PAYLOAD_VALIDO, estudianteId: 10 });        // intenta enviar como estudiante 10
        expect(res.status).toBe(403);
    });

    test('devuelve 409 cuando el servicio lanza INTENTOS_AGOTADOS', async () => {
        const err = new Error('Ya agotaste los intentos');
        err.code = 'INTENTOS_AGOTADOS';
        simulacrosService.procesarSimulacro.mockRejectedValue(err);

        const res = await request(app)
            .post('/api/simulacros/guardar-validado')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`)
            .send(PAYLOAD_VALIDO);

        expect(res.status).toBe(409);
        expect(res.body.exito).toBe(false);
    });

    test('devuelve 400 cuando el servicio lanza SIN_PREGUNTAS', async () => {
        const err = new Error('No hay preguntas en el simulacro');
        err.code = 'SIN_PREGUNTAS';
        simulacrosService.procesarSimulacro.mockRejectedValue(err);

        const res = await request(app)
            .post('/api/simulacros/guardar-validado')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`)
            .send(PAYLOAD_VALIDO);

        expect(res.status).toBe(400);
    });
});

describe('GET /api/simulacros/historial/:estudianteId — aislamiento', () => {
    test('devuelve el historial propio', async () => {
        db.obtenerHistorialEstudiante.mockResolvedValue([]);
        const res = await request(app)
            .get('/api/simulacros/historial/10')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(200);
    });

    test('devuelve 403 si pide el historial de otro estudiante', async () => {
        const res = await request(app)
            .get('/api/simulacros/historial/99')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/simulacros/estado-intentos — aislamiento', () => {
    test('devuelve el estado propio', async () => {
        db.obtenerEstadoIntentos.mockResolvedValue({});
        const res = await request(app)
            .get('/api/simulacros/estado-intentos?estudianteId=10&grado=Grado+11')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(200);
    });

    test('devuelve 403 si pide el estado de otro estudiante', async () => {
        const res = await request(app)
            .get('/api/simulacros/estado-intentos?estudianteId=99&grado=Grado+11')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(403);
    });
});

describe('GET /api/simulacros/revision/:simulacroId — aislamiento', () => {
    test('devuelve 403 si el simulacro pertenece a otro estudiante', async () => {
        db.obtenerSimulacroPorId.mockResolvedValue({ id: 1, estudiante_id: 99 });
        const res = await request(app)
            .get('/api/simulacros/revision/1')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(403);
    });

    test('devuelve la revisión si el simulacro es propio', async () => {
        db.obtenerSimulacroPorId.mockResolvedValue({ id: 1, estudiante_id: 10 });
        db.obtenerRespuestasSimulacro.mockResolvedValue([]);
        const res = await request(app)
            .get('/api/simulacros/revision/1')
            .set('Authorization', `Bearer ${tokenEstudiante(10)}`);
        expect(res.status).toBe(200);
    });
});

describe('PUT /api/simulacros/intentos-grado — validación', () => {
    test('guarda intentos válidos', async () => {
        db.establecerIntentosPermitidos.mockResolvedValue();
        const res = await request(app)
            .put('/api/simulacros/intentos-grado')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', intentos: 3 });
        expect(res.status).toBe(200);
        expect(res.body.intentos).toBe(3);
    });

    test('devuelve 400 si intentos supera 10', async () => {
        const res = await request(app)
            .put('/api/simulacros/intentos-grado')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', intentos: 11 });
        expect(res.status).toBe(400);
    });

    test('acepta 0 como ilimitado', async () => {
        db.establecerIntentosPermitidos.mockResolvedValue();
        const res = await request(app)
            .put('/api/simulacros/intentos-grado')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ grado: 'Grado 11', intentos: 0 });
        expect(res.status).toBe(200);
    });

    test('devuelve 400 si falta grado', async () => {
        const res = await request(app)
            .put('/api/simulacros/intentos-grado')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ intentos: 2 });
        expect(res.status).toBe(400);
    });
});

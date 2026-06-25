const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');

jest.mock('../database', () => ({
    registrarEstudiante: jest.fn(),
    verificarEstudiante: jest.fn(),
    registrarEstudiantesLote: jest.fn(),
    obtenerTodosEstudiantes: jest.fn(),
    eliminarEstudiante: jest.fn(),
    inicializar: jest.fn(),
}));

const db = require('../database');

function tokenDocente() {
    return jwt.sign({ rol: 'docente', id: 1, usuario: 'docente_test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const ESTUDIANTE = { id: 1, nombre: 'Ana García', documento: '1001', grado: 'Grado 11A' };

describe('POST /api/estudiantes/registro', () => {
    test('registra estudiante con datos válidos', async () => {
        db.registrarEstudiante.mockResolvedValue({ exito: true });
        db.verificarEstudiante.mockResolvedValue(ESTUDIANTE);

        const res = await request(app)
            .post('/api/estudiantes/registro')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ documento: '1001', nombre: 'Ana García', grado: 'Grado 11A', contrasena: 'clave' });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.estudiante.nombre).toBe('Ana García');
    });

    test('devuelve 409 si el documento ya existe', async () => {
        db.registrarEstudiante.mockResolvedValue({ exito: false, mensaje: 'No fue posible completar el registro' });

        const res = await request(app)
            .post('/api/estudiantes/registro')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ documento: '1001', nombre: 'Ana García', grado: 'Grado 11A', contrasena: 'clave' });

        expect(res.status).toBe(409);
        expect(res.body.exito).toBe(false);
    });

    test('devuelve 400 si faltan campos', async () => {
        const res = await request(app)
            .post('/api/estudiantes/registro')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ documento: '1001', nombre: 'Ana García' });

        expect(res.status).toBe(400);
    });

    test('devuelve 400 si el grado no es válido', async () => {
        const res = await request(app)
            .post('/api/estudiantes/registro')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ documento: '1001', nombre: 'Ana García', grado: 'Grado 5', contrasena: 'clave' });

        expect(res.status).toBe(400);
    });
});

describe('POST /api/estudiantes/registro-lote', () => {
    const LOTE = [
        { documento: '101', nombre: 'Ana',   contrasena: 'c1' },
        { documento: '102', nombre: 'Luis',  contrasena: 'c2' },
    ];

    test('importa lote de estudiantes correctamente', async () => {
        db.registrarEstudiantesLote.mockResolvedValue([
            { documento: '101', exito: true },
            { documento: '102', exito: true },
        ]);

        const res = await request(app)
            .post('/api/estudiantes/registro-lote')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ estudiantes: LOTE, grado: 'Grado 11A' });

        expect(res.status).toBe(200);
        expect(res.body.exito).toBe(true);
        expect(res.body.resultados).toHaveLength(2);
    });

    test('marca como error las filas con datos incompletos, importa el resto', async () => {
        db.registrarEstudiantesLote.mockResolvedValue([
            { documento: '102', exito: true },
        ]);

        const loteConFila = [
            { documento: '', nombre: 'Sin doc', contrasena: 'c1' }, // fila inválida
            { documento: '102', nombre: 'Luis', contrasena: 'c2' },
        ];

        const res = await request(app)
            .post('/api/estudiantes/registro-lote')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ estudiantes: loteConFila, grado: 'Grado 11A' });

        expect(res.status).toBe(200);
        expect(res.body.resultados).toHaveLength(2);
        expect(res.body.resultados[0].exito).toBe(false); // fila inválida
        expect(res.body.resultados[1].exito).toBe(true);
    });

    test('devuelve 400 si el array está vacío', async () => {
        const res = await request(app)
            .post('/api/estudiantes/registro-lote')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ estudiantes: [], grado: 'Grado 11A' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 si supera 500 estudiantes', async () => {
        const loteGrande = Array.from({ length: 501 }, (_, i) => ({
            documento: String(i), nombre: 'X', contrasena: 'c'
        }));
        const res = await request(app)
            .post('/api/estudiantes/registro-lote')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ estudiantes: loteGrande, grado: 'Grado 11A' });
        expect(res.status).toBe(400);
    });

    test('devuelve 400 si el grado no es válido', async () => {
        const res = await request(app)
            .post('/api/estudiantes/registro-lote')
            .set('Authorization', `Bearer ${tokenDocente()}`)
            .send({ estudiantes: LOTE, grado: 'Grado 5' });
        expect(res.status).toBe(400);
    });
});

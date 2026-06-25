const { procesarSimulacro } = require('../services/simulacros');

jest.mock('../database', () => ({
    puedeIntentarModulo: jest.fn(),
    obtenerPreguntasPorIds: jest.fn(),
    guardarSimulacroCompleto: jest.fn(),
    inicializar: jest.fn(),
}));

const db = require('../database');

const PREGUNTAS_DB = [
    { id: 1, respuesta_correcta: 'A' },
    { id: 2, respuesta_correcta: 'B' },
    { id: 3, respuesta_correcta: 'C' },
    { id: 4, respuesta_correcta: 'D' },
    { id: 5, respuesta_correcta: 'A' },
];

function respuestas(respuestasPorId) {
    return PREGUNTAS_DB.map(p => ({
        preguntaId: p.id,
        respuestaDada: respuestasPorId[p.id] || '',
    }));
}

beforeEach(() => {
    jest.clearAllMocks();
    db.puedeIntentarModulo.mockResolvedValue({ puede: true });
    db.obtenerPreguntasPorIds.mockResolvedValue(PREGUNTAS_DB);
    db.guardarSimulacroCompleto.mockResolvedValue(42);
});

describe('procesarSimulacro — cálculo de puntaje', () => {
    test('10/10 correctas → 100%', async () => {
        const res = await procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'A', 2:'B', 3:'C', 4:'D', 5:'A' }));
        expect(res.puntaje).toBe(100);
        expect(res.correctas).toBe(5);
        expect(res.total).toBe(5);
    });

    test('0/5 correctas → 0%', async () => {
        const res = await procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'B', 2:'C', 3:'D', 4:'A', 5:'B' }));
        expect(res.puntaje).toBe(0);
        expect(res.correctas).toBe(0);
    });

    test('3/5 correctas → 60%', async () => {
        // correctas: 1→A, 2→B, 5→A — incorrectas: 3→wrong, 4→wrong
        const res = await procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'A', 2:'B', 3:'A', 4:'A', 5:'A' }));
        expect(res.puntaje).toBe(60);
        expect(res.correctas).toBe(3);
    });

    test('respuesta en blanco cuenta como incorrecta', async () => {
        // Solo 1 respondida correctamente
        const res = await procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'A' }));
        expect(res.correctas).toBe(1);
        expect(res.puntaje).toBe(20);
    });
});

describe('procesarSimulacro — casos de error', () => {
    test('lanza INTENTOS_AGOTADOS cuando el estudiante no puede intentar', async () => {
        db.puedeIntentarModulo.mockResolvedValue({ puede: false });
        await expect(
            procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'A' }))
        ).rejects.toMatchObject({ code: 'INTENTOS_AGOTADOS' });
    });

    test('lanza SIN_PREGUNTAS cuando no hay preguntaId válido', async () => {
        const sinIds = [{ preguntaId: null, respuestaDada: 'A' }];
        await expect(
            procesarSimulacro(1, 'Grado 11', 'Módulo 1', sinIds)
        ).rejects.toMatchObject({ code: 'SIN_PREGUNTAS' });
    });
});

describe('procesarSimulacro — llamada a guardarSimulacroCompleto', () => {
    test('guarda con los datos correctos', async () => {
        await procesarSimulacro(7, 'Grado 11', 'Módulo X', respuestas({ 1:'A', 2:'B', 3:'C', 4:'D', 5:'A' }));
        expect(db.guardarSimulacroCompleto).toHaveBeenCalledWith(
            7, 'Grado 11', 'Módulo X', 5, 5, 100,
            expect.arrayContaining([
                expect.objectContaining({ preguntaId: 1, respuestaDada: 'A', esCorrecta: 1 }),
                expect.objectContaining({ preguntaId: 2, respuestaDada: 'B', esCorrecta: 1 }),
            ])
        );
    });

    test('devuelve el simulacroId que retorna la base de datos', async () => {
        db.guardarSimulacroCompleto.mockResolvedValue(99);
        const res = await procesarSimulacro(1, 'Grado 11', 'Módulo 1', respuestas({ 1:'A' }));
        expect(res.simulacroId).toBe(99);
    });
});

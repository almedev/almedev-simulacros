const db = require('../database');

async function procesarSimulacro(estudianteId, grado, modulo, respuestas) {
    const estadoIntento = await db.puedeIntentarModulo(estudianteId, grado, modulo);
    if (!estadoIntento.puede) {
        const err = new Error('Ya agotaste los intentos permitidos para este módulo. Pide a tu docente que te habilite un nuevo intento.');
        err.code = 'INTENTOS_AGOTADOS';
        throw err;
    }

    const idsPreguntas = respuestas.map(r => r.preguntaId).filter(Boolean);
    if (idsPreguntas.length === 0) {
        const err = new Error('No hay preguntas en el simulacro');
        err.code = 'SIN_PREGUNTAS';
        throw err;
    }

    const preguntasDB = await db.obtenerPreguntasPorIds(idsPreguntas);
    const mapaRespuestas = {};
    preguntasDB.forEach(p => { mapaRespuestas[p.id] = p.respuesta_correcta; });

    let correctas = 0;
    const respuestasValidadas = respuestas.map(r => {
        const esCorrecta = r.respuestaDada && mapaRespuestas[r.preguntaId] === r.respuestaDada;
        if (esCorrecta) correctas++;
        return { ...r, esCorrecta };
    });

    const total = respuestas.length;
    const puntaje = total > 0 ? Math.round((correctas / total) * 100) : 0;

    const simulacroId = await db.guardarSimulacroCompleto(
        estudianteId, grado, modulo, total, correctas, puntaje,
        respuestasValidadas.map(r => ({
            preguntaId: r.preguntaId,
            respuestaDada: r.respuestaDada || '',
            esCorrecta: r.esCorrecta ? 1 : 0
        }))
    );

    return { simulacroId, puntaje, correctas, total };
}

module.exports = { procesarSimulacro };

const { inicializar } = require('./database/inicializar');
const estudiantes = require('./database/estudiantes');
const preguntas = require('./database/preguntas');
const modulos = require('./database/modulos');
const simulacros = require('./database/simulacros');
const auth = require('./database/auth');

module.exports = {
    inicializar,
    ...estudiantes,
    ...preguntas,
    ...modulos,
    ...simulacros,
    ...auth
};

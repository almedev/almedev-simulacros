function escapeHtml(str) {
    return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

const SS_ESTUDIANTE      = 'almedev_estudiante';
const SS_SIMULACRO       = 'almedev_simulacro';
const DURACION_SIMULACRO = 10 * 60; // segundos

let tiempoRestante       = 0;
let intervaloTemporizador = null;

function formatearTiempo(segundos) {
    const m = String(Math.floor(segundos / 60)).padStart(2, '0');
    const s = String(segundos % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function iniciarTemporizador(segundos) {
    tiempoRestante = segundos;
    const el = document.getElementById('temporizador');
    el.textContent = formatearTiempo(tiempoRestante);
    el.classList.remove('urgente');

    clearInterval(intervaloTemporizador);
    intervaloTemporizador = setInterval(() => {
        tiempoRestante--;
        el.textContent = formatearTiempo(tiempoRestante);

        if (tiempoRestante <= 120) el.classList.add('urgente');

        if (tiempoRestante <= 0) {
            clearInterval(intervaloTemporizador);
            finalizarSimulacro(true);
        }
    }, 1000);
}

function detenerTemporizador() {
    clearInterval(intervaloTemporizador);
    intervaloTemporizador = null;
}

function guardarEstadoSimulacro() {
    sessionStorage.setItem(SS_SIMULACRO, JSON.stringify({
        moduloSeleccionado: estado.moduloSeleccionado,
        gradoRepaso:        estado.gradoRepaso,
        preguntas:          estado.preguntas,
        respuestas:         estado.respuestas,
        preguntaActual:     estado.preguntaActual,
        contadorSalidas:    contadorSalidas,
        tiempoRestante:     tiempoRestante
    }));
}

function limpiarEstadoSimulacro() {
    detenerTemporizador();
    sessionStorage.removeItem(SS_SIMULACRO);
}

// ============================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// ============================================================
const estado = {
    documentoIngresado: '',  // Documento que escribió el usuario
    estudiante: null,        // Datos del estudiante logueado
    moduloSeleccionado: '',  // Módulo elegido para el simulacro
    preguntas: [],           // Preguntas del simulacro actual
    respuestas: {},          // Respuestas seleccionadas { indice: 'A'|'B'|'C'|'D' }
    preguntaActual: 0,       // Índice de la pregunta que se muestra
    ultimoSimulacroId: null  // ID del último simulacro guardado (para revisión)
};

// ============================================================
// UTILIDADES
// ============================================================

// Muestra una sección y oculta todas las demás
function mostrarSeccion(id) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    document.getElementById(id).classList.add('activa');
    if (id === 'sec-seleccion' && estado.estudiante) {
        cargarModulosEstudiante();
    }
}

// Muestra un mensaje de alerta en un elemento dado
function mostrarAlerta(idElemento, mensaje, tipo) {
    const el = document.getElementById(idElemento);
    el.textContent = mensaje;
    el.className = `alerta alerta-${tipo} visible`;
}

// Oculta una alerta
function ocultarAlerta(idElemento) {
    document.getElementById(idElemento).className = 'alerta';
}

// Formatea una fecha legible con hora
function formatearFecha(fechaStr) {
    const fecha = new Date(fechaStr);
    const parte_fecha = fecha.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
    const parte_hora = fecha.toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
    return `${parte_fecha} · ${parte_hora}`;
}

// ============================================================
// FLUJO DE AUTENTICACIÓN
// ============================================================

async function iniciarSesion() {
    const documento = document.getElementById('input-documento').value.trim();
    const contrasena = document.getElementById('input-contrasena-login').value;

    if (!documento || !contrasena) {
        mostrarAlerta('alerta-documento', 'Ingresa tu documento y contraseña', 'error');
        return;
    }

    estado.documentoIngresado = documento;

    try {
        const res = await fetch('/api/auth/estudiante', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documento, contrasena })
        });
        const data = await res.json();

        if (data.exito) {
            sessionStorage.setItem('estudianteToken', data.token);
            entrarAlPanel(data.estudiante);
        } else {
            mostrarAlerta('alerta-documento', 'Documento o contraseña incorrectos', 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-documento', 'Error de conexión', 'error');
    }
}

// Entra al panel principal con los datos del estudiante
function entrarAlPanel(estudiante) {
    estado.estudiante = estudiante;
    sessionStorage.setItem(SS_ESTUDIANTE, JSON.stringify(estudiante));
    document.getElementById('bienvenida-nombre').textContent = `Hola, ${estudiante.nombre.split(' ')[0]}`;
    document.getElementById('bienvenida-grado').textContent = `${estudiante.grado} · Documento: ${estudiante.documento}`;
    document.getElementById('subtitulo-encabezado').textContent = estudiante.nombre;
    document.getElementById('btn-salir-enc').classList.add('visible');
    mostrarSeccion('sec-panel');
    cargarModulosEstudiante();
}

function cerrarSesion() {
    estado.estudiante = null;
    estado.documentoIngresado = '';
    sessionStorage.removeItem(SS_ESTUDIANTE);
    sessionStorage.removeItem('estudianteToken');
    limpiarEstadoSimulacro();
    document.getElementById('input-documento').value = '';
    document.getElementById('input-contrasena-login').value = '';
    document.getElementById('btn-salir-enc').classList.remove('visible');
    mostrarSeccion('sec-documento');
    document.getElementById('subtitulo-encabezado').textContent = 'Acceso Estudiante';
}

// ============================================================
// SELECCIÓN DE MÓDULO Y SIMULACRO
// ============================================================

let btnModuloActivo = null;

// Carga los módulos del grado de repaso elegido y dibuja los botones
async function cargarModulosEstudiante() {
    const grid = document.getElementById('grid-modulos');
    const grado = document.getElementById('seleccion-grado-repaso').value;
    grid.innerHTML = '<div class="cargando" style="grid-column:1/-1;"><div class="spinner"></div><p>Cargando módulos...</p></div>';

    try {
        // Pedimos en paralelo la lista de módulos y el estado de intentos del estudiante
        const [resModulos, resEstado] = await Promise.all([
            fetch(`/api/modulos?grado=${encodeURIComponent(grado)}`),
            fetch(`/api/simulacros/estado-intentos?estudianteId=${estado.estudiante.id}&grado=${encodeURIComponent(grado)}`, { headers: authHeaders() })
        ]);
        const dataModulos = await resModulos.json();
        const dataEstado = await resEstado.json();
        const modulos = dataModulos.modulos || [];
        const estadoIntentos = dataEstado.estado || {};

        if (modulos.length === 0) {
            grid.innerHTML = '<p style="color:var(--gris); grid-column:1/-1; text-align:center;">No hay módulos disponibles para este grado.</p>';
            return;
        }

        btnModuloActivo = null;
        estado.moduloSeleccionado = '';
        document.getElementById('btn-comenzar').style.display = 'none';

        grid.innerHTML = modulos.map(m => {
            const info = estadoIntentos[m.nombre] || { usados: 0, permitidos: 1, puede: true };
            if (info.puede) {
                return `
                    <button class="btn-modulo" onclick="seleccionarModulo(this, '${m.nombre.replace(/'/g, "\\'")}')">
                        ${m.nombre}
                    </button>
                `;
            }
            // Módulo ya respondido: se muestra bloqueado hasta que el docente habilite otro intento
            return `
                <button class="btn-modulo btn-modulo-bloqueado" disabled
                    title="Ya respondiste este módulo. Pide a tu docente que te habilite un nuevo intento.">
                    🔒 ${m.nombre}
                </button>
            `;
        }).join('');
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--rojo); grid-column:1/-1;">Error al cargar módulos.</p>';
    }
}

// Marca el módulo seleccionado visualmente
function seleccionarModulo(btn, modulo) {
    if (btnModuloActivo) btnModuloActivo.classList.remove('seleccionado');
    btn.classList.add('seleccionado');
    btnModuloActivo = btn;
    estado.moduloSeleccionado = modulo;
    document.getElementById('btn-comenzar').style.display = 'block';
    ocultarAlerta('alerta-seleccion');
}

// Carga las preguntas del servidor y empieza el simulacro
async function comenzarSimulacro() {
    if (!estado.moduloSeleccionado) {
        mostrarAlerta('alerta-seleccion', 'Selecciona un módulo primero', 'error');
        return;
    }

    try {
        // Usamos el grado de repaso elegido, no el grado del estudiante
        const gradoRepaso = document.getElementById('seleccion-grado-repaso').value;
        const params = new URLSearchParams({
            grado: gradoRepaso,
            modulo: estado.moduloSeleccionado,
            cantidad: 10,
            estudianteId: estado.estudiante.id
        });
        const res = await fetch(`/api/preguntas/simulacro?${params}`, { headers: authHeaders() });
        const data = await res.json();

        if (!data.exito || !data.preguntas || data.preguntas.length === 0) {
            mostrarAlerta('alerta-seleccion', data.mensaje || 'No hay preguntas disponibles para este módulo y grado.', 'error');
            return;
        }

        // Reiniciamos el estado del simulacro
        estado.preguntas = data.preguntas;
        estado.respuestas = {};
        estado.preguntaActual = 0;
        estado.gradoRepaso = gradoRepaso;
        contadorSalidas = 0;
        guardarEstadoSimulacro();

        mostrarSeccion('sec-simulacro');
        document.getElementById('modulo-texto-simulacro').textContent = estado.moduloSeleccionado;
        iniciarTemporizador(DURACION_SIMULACRO);
        renderizarPregunta();
    } catch (e) {
        mostrarAlerta('alerta-seleccion', 'Error al cargar las preguntas', 'error');
    }
}

// ============================================================
// SIMULACRO PREGUNTA POR PREGUNTA
// ============================================================

// Dibuja la pregunta actual en pantalla
function renderizarPregunta() {
    const total = estado.preguntas.length;
    const indice = estado.preguntaActual;
    const pregunta = estado.preguntas[indice];

    // Actualiza barra de progreso
    document.getElementById('progreso-texto').textContent = `Pregunta ${indice + 1} de ${total}`;
    document.getElementById('barra-relleno').style.width = `${((indice + 1) / total) * 100}%`;

    // Muestra el enunciado
    document.getElementById('enunciado-pregunta').textContent = pregunta.enunciado;

    // Dibuja las 4 opciones
    const opciones = [
        { letra: 'A', texto: pregunta.opcion_a },
        { letra: 'B', texto: pregunta.opcion_b },
        { letra: 'C', texto: pregunta.opcion_c },
        { letra: 'D', texto: pregunta.opcion_d }
    ];

    const contenedor = document.getElementById('contenedor-opciones');
    contenedor.innerHTML = '';
    opciones.forEach(op => {
        const div = document.createElement('div');
        div.className = 'opcion';
        if (estado.respuestas[indice] === op.letra) div.classList.add('seleccionada');
        div.onclick = () => seleccionarRespuesta(op.letra);
        div.innerHTML = `
            <div class="opcion-letra">${op.letra}</div>
            <div class="opcion-texto">${op.texto}</div>
        `;
        contenedor.appendChild(div);
    });

    // Muestra u oculta botones según la posición
    document.getElementById('btn-anterior').style.display = indice > 0 ? 'inline-block' : 'none';
    document.getElementById('btn-siguiente').style.display = indice < total - 1 ? 'inline-block' : 'none';
    document.getElementById('btn-finalizar').style.display = indice === total - 1 ? 'inline-block' : 'none';
}

// Registra la respuesta seleccionada
function seleccionarRespuesta(letra) {
    estado.respuestas[estado.preguntaActual] = letra;
    guardarEstadoSimulacro();
    // Actualiza visualmente cuál opción está marcada
    document.querySelectorAll('.opcion').forEach((el, i) => {
        const letras = ['A', 'B', 'C', 'D'];
        el.classList.toggle('seleccionada', letras[i] === letra);
    });
}

function preguntaSiguiente() {
    if (estado.preguntaActual < estado.preguntas.length - 1) {
        estado.preguntaActual++;
        guardarEstadoSimulacro();
        renderizarPregunta();
    }
}

function preguntaAnterior() {
    if (estado.preguntaActual > 0) {
        estado.preguntaActual--;
        guardarEstadoSimulacro();
        renderizarPregunta();
    }
}

// Envía las respuestas al servidor y muestra los resultados
async function finalizarSimulacro(forzado = false) {
    // Verificamos que haya respondido todas las preguntas (solo si no es forzado)
    if (!forzado) {
        const sinResponder = estado.preguntas.length - Object.keys(estado.respuestas).length;
        if (sinResponder > 0) {
            if (!confirm(`Tienes ${sinResponder} pregunta(s) sin responder. ¿Deseas finalizar de todas formas?`)) return;
        }
    }

    const payload = {
        estudianteId: estado.estudiante.id,
        grado: estado.gradoRepaso,
        modulo: estado.moduloSeleccionado,
        respuestas: estado.preguntas.map((p, i) => ({
            preguntaId: p.id,
            respuestaDada: estado.respuestas[i] || '',
            esCorrecta: false  // El servidor recalcula esto
        }))
    };

    try {
        const res = await fetch('/api/simulacros/guardar-validado', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.exito) {
            estado.ultimoSimulacroId = data.simulacroId;
            limpiarEstadoSimulacro();
            mostrarResultados(data.puntaje, data.correctas, data.total);
        } else {
            alert(data.mensaje || 'Error al guardar el simulacro. Intenta de nuevo.');
        }
    } catch (e) {
        alert('Error de conexión al guardar el simulacro.');
    }
}

// Muestra la pantalla de resultados con puntaje
function mostrarResultados(puntaje, correctas, total) {
    document.getElementById('resultado-puntaje').textContent = `${puntaje}%`;
    document.getElementById('resultado-resumen').textContent = `Respondiste ${correctas} de ${total} preguntas correctamente`;
    document.getElementById('resultado-modulo').textContent = `Módulo: ${estado.moduloSeleccionado} · ${estado.estudiante.grado}`;

    // Cambiamos el color del círculo según el puntaje
    const circulo = document.querySelector('.circulo-puntaje');
    if (puntaje >= 80) circulo.style.background = 'var(--verde)';
    else if (puntaje >= 60) circulo.style.background = 'var(--amarillo)';
    else circulo.style.background = 'var(--rojo)';

    mostrarSeccion('sec-resultados');
}

// ============================================================
// REVISIÓN DE RESPUESTAS
// ============================================================

async function verRevision() {
    if (!estado.ultimoSimulacroId) return;

    try {
        const res = await fetch(`/api/simulacros/revision/${estado.ultimoSimulacroId}`, { headers: authHeaders() });
        const data = await res.json();

        const contenedor = document.getElementById('contenedor-revision');
        contenedor.innerHTML = '';

        data.respuestas.forEach((r, i) => {
            const div = document.createElement('div');
            div.className = `item-revision ${r.es_correcta ? 'correcto' : 'incorrecto'}`;

            const icono = r.es_correcta ? '✓' : '✗';
            const opcionesTexto = {
                'A': r.opcion_a, 'B': r.opcion_b, 'C': r.opcion_c, 'D': r.opcion_d
            };

            div.innerHTML = `
                <div class="pregunta-texto">${i+1}. ${icono} ${escapeHtml(r.enunciado)}</div>
                <div class="respuesta-info">
                    <strong>Tu respuesta:</strong> ${escapeHtml(r.respuesta_dada || 'Sin responder')} – ${escapeHtml(opcionesTexto[r.respuesta_dada] || '')}<br>
                    <strong>Respuesta correcta:</strong> ${escapeHtml(r.respuesta_correcta)} – ${escapeHtml(opcionesTexto[r.respuesta_correcta])}
                </div>
                ${r.justificacion ? `<div class="justificacion">💡 ${escapeHtml(r.justificacion)}</div>` : ''}
            `;
            contenedor.appendChild(div);
        });

        mostrarSeccion('sec-revision');
    } catch (e) {
        alert('Error al cargar la revisión');
    }
}

// ============================================================
// HISTORIAL
// ============================================================

async function verHistorial() {
    const contenedor = document.getElementById('contenedor-historial');
    contenedor.innerHTML = '<div class="cargando"><div class="spinner"></div><p>Cargando...</p></div>';
    mostrarSeccion('sec-historial');

    try {
        const res = await fetch(`/api/simulacros/historial/${estado.estudiante.id}`, { headers: authHeaders() });
        const data = await res.json();

        if (data.historial.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--gris); text-align:center; padding:20px;">Aún no has realizado ningún simulacro.</p>';
            return;
        }

        contenedor.innerHTML = '';

        // Contar cuántos intentos totales hay por módulo para numerar cronológicamente
        const totalPorModulo = {};
        data.historial.forEach(s => {
            totalPorModulo[s.modulo] = (totalPorModulo[s.modulo] || 0) + 1;
        });
        // Cursor por módulo: la lista viene DESC (más reciente primero),
        // así que el primero que aparece tiene el número más alto
        const cursorIntento = {};

        data.historial.forEach(s => {
            if (cursorIntento[s.modulo] === undefined) {
                cursorIntento[s.modulo] = totalPorModulo[s.modulo];
            }
            const numIntento = cursorIntento[s.modulo]--;

            const div = document.createElement('div');
            div.className = 'item-historial';
            const claseBadge = s.puntaje >= 80 ? 'alto' : (s.puntaje >= 60 ? 'medio' : 'bajo');
            div.innerHTML = `
                <div class="historial-info">
                    <div class="historial-modulo">${s.modulo}</div>
                    <div class="historial-fecha">Intento ${numIntento} · ${s.grado} · ${formatearFecha(s.fecha)} · ${s.correctas}/${s.total_preguntas} correctas</div>
                </div>
                <div class="badge-puntaje ${claseBadge}">${s.puntaje}%</div>
            `;
            contenedor.appendChild(div);
        });
    } catch (e) {
        contenedor.innerHTML = '<p style="color:var(--rojo);">Error al cargar el historial.</p>';
    }
}

// Permitir Enter en el campo de documento
document.getElementById('input-documento').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('input-contrasena-login').focus();
});
document.getElementById('input-contrasena-login').addEventListener('keydown', e => {
    if (e.key === 'Enter') iniciarSesion();
});

// ============================================================
// DETECCIÓN DE CAMBIO DE PESTAÑA DURANTE EL SIMULACRO
// ============================================================
let contadorSalidas = 0;

function authHeaders() {
    const token = sessionStorage.getItem('estudianteToken');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function enSimulacro() {
    return document.getElementById('sec-simulacro').classList.contains('activa');
}

function cerrarModalTrampa() {
    document.getElementById('modal-trampa').style.display = 'none';
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && enSimulacro()) {
        contadorSalidas++;
        guardarEstadoSimulacro();

        if (contadorSalidas >= 3) {
            // A la tercera salida se finaliza automáticamente al volver
            return;
        }
    } else if (!document.hidden && enSimulacro() && contadorSalidas > 0) {
        if (contadorSalidas >= 3) {
            finalizarSimulacro(true);
            return;
        }

        const restantes = 3 - contadorSalidas;
        const modal = document.getElementById('modal-trampa');
        document.getElementById('modal-trampa-contador').textContent =
            `Llevas ${contadorSalidas} de 3 salidas. ${restantes === 1 ? '⚠️ ¡Una más y la prueba se enviará automáticamente!' : `Aún te quedan ${restantes} oportunidades antes del envío automático.`}`;
        modal.style.display = 'flex';
    }
});

// ============================================================
// RESTAURAR SESIÓN AL REFRESCAR LA PÁGINA
// ============================================================
function restaurarSesion() {
    const estudianteGuardado = sessionStorage.getItem(SS_ESTUDIANTE);
    if (!estudianteGuardado || !sessionStorage.getItem('estudianteToken')) return;

    try {
        const estudiante = JSON.parse(estudianteGuardado);
        estado.estudiante = estudiante;
        document.getElementById('bienvenida-nombre').textContent = `Hola, ${estudiante.nombre.split(' ')[0]}`;
        document.getElementById('bienvenida-grado').textContent = `${estudiante.grado} · Documento: ${estudiante.documento}`;
        document.getElementById('subtitulo-encabezado').textContent = estudiante.nombre;
        document.getElementById('btn-salir-enc').classList.add('visible');

        const simulacroGuardado = sessionStorage.getItem(SS_SIMULACRO);
        if (simulacroGuardado) {
            const sim = JSON.parse(simulacroGuardado);
            estado.moduloSeleccionado = sim.moduloSeleccionado;
            estado.gradoRepaso        = sim.gradoRepaso;
            estado.preguntas          = sim.preguntas;
            estado.respuestas         = sim.respuestas;
            estado.preguntaActual     = sim.preguntaActual;
            contadorSalidas           = sim.contadorSalidas || 0;

            document.getElementById('modulo-texto-simulacro').textContent = sim.moduloSeleccionado;
            mostrarSeccion('sec-simulacro');
            renderizarPregunta();
            iniciarTemporizador(sim.tiempoRestante > 0 ? sim.tiempoRestante : DURACION_SIMULACRO);
        } else {
            mostrarSeccion('sec-panel');
            cargarModulosEstudiante();
        }
    } catch {
        sessionStorage.removeItem(SS_ESTUDIANTE);
        sessionStorage.removeItem(SS_SIMULACRO);
    }
}

document.addEventListener('DOMContentLoaded', restaurarSesion);

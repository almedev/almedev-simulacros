// ============================================================
// ESTADO Y VARIABLES GLOBALES
// ============================================================
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let sesionActiva = false;
let intervalPolling = null;
let todasEstadisticas = [];
let datosActuales = [];
let preguntasCache = {};

function authHeaders(extra = {}) {
    const token = sessionStorage.getItem('docenteToken');
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

// ============================================================
// AUTENTICACIÓN
// ============================================================

async function iniciarSesion() {
    const usuario = document.getElementById('input-usuario').value.trim();
    const contrasena = document.getElementById('input-contrasena').value;

    if (!usuario || !contrasena) {
        mostrarAlerta('alerta-login', 'Ingresa usuario y contraseña', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/docente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, contrasena })
        });
        const data = await res.json();

        if (data.exito) {
            sessionStorage.setItem('docenteToken', data.token);
            sesionActiva = true;
            document.getElementById('subtitulo-enc').textContent = 'Panel Docente';
            document.getElementById('btn-salir-enc').classList.add('visible');
            mostrarSeccion('sec-panel');
            // Cargamos todos los datos iniciales
            cargarEstadisticas();
            cargarIntentosGrado();
            cargarModulos();
            cargarPreguntas();
            cargarEstudiantes();
            // Iniciamos el polling cada 10 segundos para estadísticas en tiempo real
            intervalPolling = setInterval(cargarEstadisticas, 10000);
        } else {
            mostrarAlerta('alerta-login', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-login', 'Error de conexión', 'error');
    }
}

function cerrarSesion() {
    sesionActiva = false;
    if (intervalPolling) clearInterval(intervalPolling);
    sessionStorage.removeItem('docenteToken');
    document.getElementById('input-contrasena').value = '';
    document.getElementById('btn-salir-enc').classList.remove('visible');
    mostrarSeccion('sec-login');
}

document.getElementById('input-contrasena').addEventListener('keydown', e => {
    if (e.key === 'Enter') iniciarSesion();
});

// ============================================================
// UTILIDADES
// ============================================================

function mostrarSeccion(id) {
    document.querySelectorAll('.seccion').forEach(s => s.classList.remove('activa'));
    document.getElementById(id).classList.add('activa');
}

function mostrarAlerta(id, mensaje, tipo) {
    const el = document.getElementById(id);
    el.textContent = mensaje;
    el.className = `alerta alerta-${tipo} visible`;
}

function ocultarAlerta(id) {
    document.getElementById(id).className = 'alerta';
}

function cambiarTab(idTab, btnTab) {
    document.querySelectorAll('.panel-tab').forEach(p => p.classList.remove('activo'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('activo'));
    document.getElementById(idTab).classList.add('activo');
    btnTab.classList.add('activo');

    // Cargamos los datos del tab que se abre
    if (idTab === 'tab-estadisticas') cargarEstadisticas();
    if (idTab === 'tab-preguntas') { cargarModulos(); cargarPreguntas(); }
    if (idTab === 'tab-estudiantes') cargarEstudiantes();
}

function formatearFecha(fechaStr) {
    const f = new Date(fechaStr);
    return f.toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

// ============================================================
// ESTADÍSTICAS EN TIEMPO REAL
// ============================================================

async function cargarEstadisticas() {
    try {
        const res = await fetch('/api/simulacros/estadisticas', { headers: authHeaders() });
        const data = await res.json();
        todasEstadisticas = data.estadisticas || [];
        filtrarEstadisticas();
    } catch (e) {
        document.getElementById('contenedor-estadisticas').innerHTML =
            '<p style="color:var(--rojo);">Error al cargar estadísticas.</p>';
    }
}

// Rellena el select de módulos según el grado de repaso elegido (todos los módulos del grado)
async function actualizarFiltroModulos() {
    const grado = document.getElementById('filtro-grado-repaso').value;
    const select = document.getElementById('filtro-modulo-est');
    select.innerHTML = '<option value="">Todos</option>';
    if (!grado) return;
    try {
        const res = await fetch(`/api/modulos?grado=${encodeURIComponent(grado)}`, { headers: authHeaders() });
        const data = await res.json();
        (data.modulos || []).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.nombre;
            opt.textContent = m.nombre;
            select.appendChild(opt);
        });
    } catch (e) { /* si falla, queda solo "Todos" */ }
}

// Filtra las estadísticas según los tres filtros activos
function filtrarEstadisticas() {
    const gradoEst   = document.getElementById('filtro-grado-est').value;
    const gradoRepaso = document.getElementById('filtro-grado-repaso').value;
    const moduloFiltro = document.getElementById('filtro-modulo-est').value;
    datosActuales = todasEstadisticas.filter(s =>
        (!gradoEst    || s.grado           === gradoEst) &&
        (!gradoRepaso || s.grado_simulacro === gradoRepaso) &&
        (!moduloFiltro || s.modulo         === moduloFiltro)
    );
    const datos = datosActuales;

    const contenedor = document.getElementById('contenedor-estadisticas');

    if (datos.length === 0) {
        contenedor.innerHTML = '<p style="color:var(--gris); text-align:center; padding:20px;">Aún no hay simulacros completados.</p>';
        return;
    }

    // Marcamos con badge "Nuevo" los simulacros de los últimos 10 minutos
    const ahoraMs = Date.now();
    const DIEZ_MIN = 10 * 60 * 1000;

    // Contar intentos totales por estudiante+grado+módulo para numerar cronológicamente
    const totalPorClave = {};
    datos.forEach(s => {
        const clave = `${s.estudiante_id}|${s.grado}|${s.modulo}`;
        totalPorClave[clave] = (totalPorClave[clave] || 0) + 1;
    });
    const cursorIntento = {};

    const filas = datos.map(s => {
        const clave = `${s.estudiante_id}|${s.grado}|${s.modulo}`;
        if (cursorIntento[clave] === undefined) cursorIntento[clave] = totalPorClave[clave];
        const numIntento = cursorIntento[clave]--;

        const esNuevo = (ahoraMs - new Date(s.fecha).getTime()) < DIEZ_MIN;
        const claseBadge = s.puntaje >= 80 ? 'alto' : (s.puntaje >= 60 ? 'medio' : 'bajo');
        return `
            <tr>
                <td>${escapeHtml(s.nombre)} ${esNuevo ? '<span class="badge-nuevo">Nuevo</span>' : ''}</td>
                <td>${escapeHtml(s.grado)}</td>
                <td>${escapeHtml(s.modulo)}<br><small style="color:var(--gris);">${escapeHtml(s.grado_modulo || s.grado)} · Intento ${numIntento}</small></td>
                <td>${s.correctas}/${s.total_preguntas}</td>
                <td><span class="badge-puntaje ${claseBadge}">${s.puntaje}%</span></td>
                <td>${formatearFecha(s.fecha)}</td>
                <td>
                    <button class="btn btn-secundario btn-pequeño"
                        disabled>
                        Habilitar reintento
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    contenedor.innerHTML = `
        <div class="tabla-contenedor">
            <table>
                <thead>
                    <tr>
                        <th>Estudiante</th>
                        <th>Grado</th>
                        <th>Módulo</th>
                        <th>Correctas</th>
                        <th>Puntaje</th>
                        <th>Fecha</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
        <p style="color:var(--gris); font-size:0.8rem; margin-top:8px; text-align:right;">
            ${datos.length} simulacro(s) en total
        </p>
    `;

    contenedor.querySelectorAll('tr').forEach(fila => {
        if (fila.lastElementChild) fila.lastElementChild.remove();
    });
}

// Exporta los datos filtrados actualmente visibles a un archivo .xlsx
function exportarExcel() {
    if (datosActuales.length === 0) {
        alert('No hay datos para exportar.');
        return;
    }

    // Calcular números de intento con la misma lógica que la tabla
    const totalPorClave = {};
    datosActuales.forEach(s => {
        const clave = `${s.estudiante_id}|${s.grado}|${s.modulo}`;
        totalPorClave[clave] = (totalPorClave[clave] || 0) + 1;
    });
    const cursorIntento = {};

    const filas = datosActuales.map(s => {
        const clave = `${s.estudiante_id}|${s.grado}|${s.modulo}`;
        if (cursorIntento[clave] === undefined) cursorIntento[clave] = totalPorClave[clave];
        const numIntento = cursorIntento[clave]--;

        return {
            'Estudiante':       s.nombre,
            'Grado estudiante': s.grado,
            'Grado de repaso':  s.grado_simulacro || s.grado,
            'Módulo':           s.modulo,
            'Intento':          numIntento,
            'Correctas':        s.correctas,
            'Total preguntas':  s.total_preguntas,
            'Puntaje (%)':      s.puntaje,
            'Fecha':            formatearFecha(s.fecha)
        };
    });

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Simulacros');

    const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g, '-');
    XLSX.writeFile(libro, `almedev_simulacros_${fecha}.xlsx`);
}

// Habilita un intento adicional para que un estudiante pueda repetir un módulo
// (por defecto cada estudiante solo puede responder un módulo una vez)
async function cargarIntentosGrado() {
    const grado = document.getElementById('intentos-grado-select').value;
    try {
        const res = await fetch(`/api/simulacros/intentos-grado?grado=${encodeURIComponent(grado)}`, { headers: authHeaders() });
        if (!res.ok) {
            mostrarAlerta('alerta-intentos-grado', 'No se encontro la ruta de intentos. Reinicia el servidor para cargar los cambios.', 'error');
            return;
        }
        const data = await res.json();
        if (data.exito) {
            document.getElementById('intentos-cantidad-select').value = String(data.intentos ?? 1);
            ocultarAlerta('alerta-intentos-grado');
        } else {
            mostrarAlerta('alerta-intentos-grado', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-intentos-grado', 'Error de conexion', 'error');
    }
}

async function guardarIntentosGrado() {
    const grado = document.getElementById('intentos-grado-select').value;
    const intentos = document.getElementById('intentos-cantidad-select').value;
    const esIlimitado = intentos === '0';
    const textoVeces = esIlimitado ? 'intentos ilimitados' : (intentos === '1' ? '1 vez' : `${intentos} veces`);

    const confirmMsg = `¿Desea guardar ${textoVeces} para el repaso del ${grado}?`;

    if (!confirm(confirmMsg)) {
        mostrarAlerta('alerta-intentos-grado', 'No se guardaron cambios.', 'info');
        return;
    }

    try {
        const res = await fetch('/api/simulacros/intentos-grado', {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ grado, intentos })
        });
        if (!res.ok) {
            mostrarAlerta('alerta-intentos-grado', 'No se pudo guardar. Reinicia el servidor.', 'error');
            return;
        }
        const data = await res.json();
        if (data.exito) {
            const msg = esIlimitado
                ? `Se han configurado intentos ilimitados para el repaso del ${grado}.`
                : `Se han configurado ${intentos} intento${intentos === '1' ? '' : 's'} para el repaso del ${grado}.`;
            mostrarAlerta('alerta-intentos-grado', msg, 'exito');
            cargarEstadisticas();
        } else {
            mostrarAlerta('alerta-intentos-grado', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-intentos-grado', 'Error de conexion', 'error');
    }
}

async function habilitarReintento(estudianteId, grado, modulo, nombreEstudiante) {
    if (!confirm(`¿Habilitar un nuevo intento de "${modulo}" para ${nombreEstudiante}?`)) return;

    try {
        const res = await fetch('/api/simulacros/habilitar-reintento', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ estudianteId, grado, modulo })
        });
        const data = await res.json();
        if (data.exito) {
            alert(`Listo: ${nombreEstudiante} ya puede volver a responder "${modulo}".`);
        } else {
            alert('Error: ' + data.mensaje);
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

// ============================================================
// MÓDULOS TEMÁTICOS
// ============================================================

// Carga los módulos del grado elegido en la sección de gestión y los renderiza
async function cargarModulos() {
    const grado = document.getElementById('modulos-grado-select').value;
    try {
        const res = await fetch(`/api/modulos?grado=${encodeURIComponent(grado)}`, { headers: authHeaders() });
        const data = await res.json();
        const modulos = data.modulos || [];

        const lista = document.getElementById('lista-modulos');
        if (modulos.length === 0) {
            lista.innerHTML = '<p style="color:var(--gris); text-align:center; padding:12px;">No hay módulos creados para este grado.</p>';
            return;
        }
        lista.innerHTML = modulos.map(m => `
            <div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #F0F0F0;">
                <span style="flex:1; font-size:0.95rem;">${escapeHtml(m.nombre)}</span>
                <button class="btn btn-secundario btn-pequeño" data-action="editar-modulo" data-id="${m.id}" data-nombre="${escapeHtml(m.nombre)}">Editar</button>
                <button class="btn btn-peligro btn-pequeño" data-action="borrar-modulo" data-id="${m.id}" data-nombre="${escapeHtml(m.nombre)}">Eliminar</button>
            </div>
        `).join('');
        lista.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const { action, id, nombre } = btn.dataset;
                if (action === 'editar-modulo') iniciarEdicionModulo(id, nombre);
                if (action === 'borrar-modulo') borrarModulo(id, nombre);
            });
        });
    } catch (e) {
        document.getElementById('lista-modulos').innerHTML = '<p style="color:var(--rojo);">Error al cargar módulos.</p>';
    }
}

// Rellena el filtro de módulo del banco de preguntas según el grado filtrado
async function cargarModulosFiltro() {
    const grado = document.getElementById('filtro-grado-preg').value;
    const filtro = document.getElementById('filtro-modulo-preg');
    filtro.innerHTML = '<option value="">Todos</option>';
    if (!grado) return;  // Sin grado elegido, dejamos solo "Todos"

    try {
        const res = await fetch(`/api/modulos?grado=${encodeURIComponent(grado)}`, { headers: authHeaders() });
        const data = await res.json();
        (data.modulos || []).forEach(m => {
            filtro.innerHTML += `<option value="${escapeHtml(m.nombre)}">${escapeHtml(m.nombre)}</option>`;
        });
    } catch (e) { /* Si falla, el filtro queda solo con "Todos" */ }
}

// Rellena el selector de módulo del formulario de preguntas según el grado elegido
async function cargarModulosFormulario() {
    const grado = document.getElementById('form-preg-grado').value;
    const select = document.getElementById('form-preg-modulo');
    select.innerHTML = '<option value="">Selecciona</option>';
    if (!grado) return;

    try {
        const res = await fetch(`/api/modulos?grado=${encodeURIComponent(grado)}`, { headers: authHeaders() });
        const data = await res.json();
        (data.modulos || []).forEach(m => {
            select.innerHTML += `<option value="${m.nombre}">${m.nombre}</option>`;
        });
    } catch (e) { /* Si falla, el selector queda vacío */ }
}

// Guarda un módulo nuevo o actualiza uno existente, en el grado seleccionado
async function guardarModulo() {
    const grado = document.getElementById('modulos-grado-select').value;
    const nombre = document.getElementById('input-nuevo-modulo').value.trim();
    const id = document.getElementById('modulo-editando-id').value;

    if (!nombre) {
        mostrarAlerta('alerta-modulos', 'Escribe el nombre del módulo', 'error');
        return;
    }

    try {
        const url = id ? `/api/modulos/${id}` : '/api/modulos';
        const metodo = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: metodo,
            headers: authHeaders(),
            body: JSON.stringify({ grado, nombre })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarAlerta('alerta-modulos', id ? 'Módulo actualizado' : 'Módulo creado', 'exito');
            cancelarEdicionModulo();
            cargarModulos();
        } else {
            mostrarAlerta('alerta-modulos', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-modulos', 'Error de conexión', 'error');
    }
}

// Muestra el bloque de edición con los datos del módulo elegido
function iniciarEdicionModulo(id, nombre) {
    document.getElementById('bloque-editar-modulo').style.display = 'flex';
    document.getElementById('input-nuevo-modulo').value = nombre;
    document.getElementById('modulo-editando-id').value = id;
    document.getElementById('input-nuevo-modulo').focus();
    mostrarAlerta('alerta-modulos', `Editando: "${nombre}"`, 'info');
}

// Oculta el bloque de edición y limpia el formulario
function cancelarEdicionModulo() {
    document.getElementById('bloque-editar-modulo').style.display = 'none';
    document.getElementById('input-nuevo-modulo').value = '';
    document.getElementById('modulo-editando-id').value = '';
    ocultarAlerta('alerta-modulos');
}

async function borrarModulo(id, nombre) {
    if (!confirm(`¿Eliminar el módulo "${nombre}"?\nLas preguntas asociadas quedarán sin módulo visible pero no se borrarán.`)) return;
    try {
        const res = await fetch(`/api/modulos/${id}`, { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (data.exito) cargarModulos();
        else mostrarAlerta('alerta-modulos', data.mensaje, 'error');
    } catch (e) {
        mostrarAlerta('alerta-modulos', 'Error de conexión', 'error');
    }
}

// ============================================================
// BANCO DE PREGUNTAS
// ============================================================

async function cargarPreguntas() {
    const grado = document.getElementById('filtro-grado-preg').value;
    const modulo = document.getElementById('filtro-modulo-preg').value;

    const params = new URLSearchParams();
    if (grado) params.set('grado', grado);
    if (modulo) params.set('modulo', modulo);

    const contenedor = document.getElementById('contenedor-preguntas');
    contenedor.innerHTML = '<div class="cargando"><div class="spinner"></div><p>Cargando...</p></div>';

    try {
        const res = await fetch(`/api/preguntas?${params}`, { headers: authHeaders() });
        const data = await res.json();

        if (data.preguntas.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--gris); text-align:center; padding:20px;">No hay preguntas con ese filtro.</p>';
            return;
        }

        preguntasCache = {};
        data.preguntas.forEach(p => { preguntasCache[p.id] = p; });

        contenedor.innerHTML = data.preguntas.map(p => `
            <div style="border:1px solid #E0E0E0; border-radius:8px; padding:12px; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
                    <div style="flex:1;">
                        <span style="font-size:0.75rem; color:var(--azul); font-weight:600;">${escapeHtml(p.grado)} · ${escapeHtml(p.modulo)}</span>
                        <p style="margin-top:4px; font-size:0.9rem; font-weight:600;">${escapeHtml(p.enunciado)}</p>
                        <p style="font-size:0.8rem; color:var(--gris); margin-top:4px;">
                            A) ${escapeHtml(p.opcion_a)} &nbsp; B) ${escapeHtml(p.opcion_b)} &nbsp; C) ${escapeHtml(p.opcion_c)} &nbsp; D) ${escapeHtml(p.opcion_d)}
                        </p>
                        <p style="font-size:0.8rem; color:var(--verde); margin-top:4px;">✓ Correcta: ${escapeHtml(p.respuesta_correcta)}</p>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="btn btn-secundario btn-pequeño" data-action="editar-preg" data-id="${p.id}">Editar</button>
                        <button class="btn btn-peligro btn-pequeño" data-action="borrar-preg" data-id="${p.id}">Borrar</button>
                    </div>
                </div>
            </div>
        `).join('');
        contenedor.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const { action, id } = btn.dataset;
                if (action === 'editar-preg') editarPregunta(preguntasCache[id]);
                if (action === 'borrar-preg') eliminarPregunta(id);
            });
        });
    } catch (e) {
        contenedor.innerHTML = '<p style="color:var(--rojo);">Error al cargar preguntas.</p>';
    }
}

// Abre el formulario vacío para agregar una pregunta nueva
async function abrirFormularioPregunta(pregunta) {
    const form = document.getElementById('formulario-pregunta');
    form.style.display = 'block';
    ocultarAlerta('alerta-form-preg');

    if (pregunta) {
        // Modo edición: rellenamos los campos con los datos de la pregunta
        document.getElementById('titulo-formulario').textContent = 'Editar pregunta';
        document.getElementById('form-preg-id').value = pregunta.id;
        document.getElementById('form-preg-grado').value = pregunta.grado;
        // Cargamos los módulos de ese grado antes de seleccionar el módulo guardado
        await cargarModulosFormulario();
        document.getElementById('form-preg-modulo').value = pregunta.modulo;
        document.getElementById('form-preg-enunciado').value = pregunta.enunciado;
        document.getElementById('form-preg-a').value = pregunta.opcion_a;
        document.getElementById('form-preg-b').value = pregunta.opcion_b;
        document.getElementById('form-preg-c').value = pregunta.opcion_c;
        document.getElementById('form-preg-d').value = pregunta.opcion_d;
        document.getElementById('form-preg-respuesta').value = pregunta.respuesta_correcta;
        document.getElementById('form-preg-justificacion').value = pregunta.justificacion || '';
    } else {
        // Modo creación: limpiamos el formulario
        document.getElementById('titulo-formulario').textContent = 'Agregar pregunta';
        document.getElementById('form-preg-id').value = '';
        document.getElementById('form-preg-grado').value = '';
        document.getElementById('form-preg-modulo').value = '';
        document.getElementById('form-preg-enunciado').value = '';
        document.getElementById('form-preg-a').value = '';
        document.getElementById('form-preg-b').value = '';
        document.getElementById('form-preg-c').value = '';
        document.getElementById('form-preg-d').value = '';
        document.getElementById('form-preg-respuesta').value = '';
        document.getElementById('form-preg-justificacion').value = '';
    }

    // Desplazamos la pantalla hasta el formulario
    form.scrollIntoView({ behavior: 'smooth' });
}

function editarPregunta(pregunta) {
    abrirFormularioPregunta(pregunta);
}

function cerrarFormularioPregunta() {
    document.getElementById('formulario-pregunta').style.display = 'none';
}

// Guarda la pregunta (crea o actualiza según si tiene ID)
async function guardarPregunta() {
    const id = document.getElementById('form-preg-id').value;
    const datos = {
        grado: document.getElementById('form-preg-grado').value,
        modulo: document.getElementById('form-preg-modulo').value,
        enunciado: document.getElementById('form-preg-enunciado').value.trim(),
        opcion_a: document.getElementById('form-preg-a').value.trim(),
        opcion_b: document.getElementById('form-preg-b').value.trim(),
        opcion_c: document.getElementById('form-preg-c').value.trim(),
        opcion_d: document.getElementById('form-preg-d').value.trim(),
        respuesta_correcta: document.getElementById('form-preg-respuesta').value,
        justificacion: document.getElementById('form-preg-justificacion').value.trim()
    };

    if (!datos.grado || !datos.modulo || !datos.enunciado || !datos.opcion_a ||
        !datos.opcion_b || !datos.opcion_c || !datos.opcion_d || !datos.respuesta_correcta) {
        mostrarAlerta('alerta-form-preg', 'Completa todos los campos obligatorios', 'error');
        return;
    }

    try {
        const url = id ? `/api/preguntas/${id}` : '/api/preguntas';
        const metodo = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method: metodo,
            headers: authHeaders(),
            body: JSON.stringify(datos)
        });
        const data = await res.json();

        if (data.exito) {
            cerrarFormularioPregunta();
            cargarPreguntas();
        } else {
            mostrarAlerta('alerta-form-preg', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-form-preg', 'Error de conexión', 'error');
    }
}

async function eliminarPregunta(id) {
    if (!confirm('¿Seguro que deseas eliminar esta pregunta? Esta acción no se puede deshacer.')) return;

    try {
        const res = await fetch(`/api/preguntas/${id}`, { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (data.exito) cargarPreguntas();
        else alert('Error al eliminar la pregunta');
    } catch (e) {
        alert('Error de conexión');
    }
}

// ============================================================
// GESTIÓN DE ESTUDIANTES
// ============================================================

async function cargarEstudiantes() {
    const contenedor = document.getElementById('contenedor-estudiantes');
    contenedor.innerHTML = '<div class="cargando"><div class="spinner"></div><p>Cargando...</p></div>';

    try {
        const res = await fetch('/api/estudiantes', { headers: authHeaders() });
        const data = await res.json();

        if (data.estudiantes.length === 0) {
            contenedor.innerHTML = '<p style="color:var(--gris); text-align:center; padding:20px;">No hay estudiantes registrados.</p>';
            return;
        }

        const filas = data.estudiantes.map(e => `
            <tr>
                <td>${escapeHtml(e.nombre)}</td>
                <td>${escapeHtml(String(e.documento))}</td>
                <td>${escapeHtml(e.grado)}</td>
                <td>
                    <span id="pwd-${e.id}" style="filter:blur(4px); user-select:none; font-family:monospace;">
                        ${escapeHtml(e.contrasena_plana || '(sin registro)')}
                    </span>
                    <button onclick="verContrasena(${e.id})" title="Mostrar/ocultar"
                        style="background:none; border:none; cursor:pointer; font-size:1rem; margin-left:4px;">
                        👁
                    </button>
                </td>
                <td>${new Date(e.fecha_registro).toLocaleDateString('es-CO')}</td>
                <td>
                    <button class="btn btn-peligro btn-pequeño" data-action="borrar-est" data-id="${e.id}" data-nombre="${escapeHtml(e.nombre)}">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');

        contenedor.innerHTML = `
            <p style="color:var(--gris); font-size:0.85rem; margin-bottom:12px;">${data.estudiantes.length} estudiante(s) registrado(s)</p>
            <div class="tabla-contenedor">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Documento</th>
                            <th>Grado</th>
                            <th>Contraseña</th>
                            <th>Registro</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
        `;
        contenedor.querySelectorAll('button[data-action="borrar-est"]').forEach(btn => {
            btn.addEventListener('click', () => eliminarEstudiante(btn.dataset.id, btn.dataset.nombre));
        });
    } catch (e) {
        contenedor.innerHTML = '<p style="color:var(--rojo);">Error al cargar estudiantes.</p>';
    }
}

// Alterna el desenfoque de la contraseña al presionar el ojo
function verContrasena(id) {
    const span = document.getElementById(`pwd-${id}`);
    const oculta = span.style.filter === 'blur(4px)';
    span.style.filter = oculta ? 'none' : 'blur(4px)';
    span.style.userSelect = oculta ? 'text' : 'none';
}

async function registrarEstudiante() {
    const documento = document.getElementById('reg-est-documento').value.trim();
    const nombre = document.getElementById('reg-est-nombre').value.trim();
    const grado = document.getElementById('reg-est-grado').value;
    const contrasena = document.getElementById('reg-est-contrasena').value.trim();

    if (!documento || !nombre || !grado || !contrasena) {
        mostrarAlerta('alerta-reg-est', 'Completa todos los campos', 'error');
        return;
    }

    try {
        const res = await fetch('/api/estudiantes/registro', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ documento, nombre, grado, contrasena })
        });
        const data = await res.json();

        if (data.exito) {
            mostrarAlerta('alerta-reg-est', `✓ Estudiante "${nombre}" registrado correctamente`, 'exito');
            // Limpiamos el formulario
            document.getElementById('reg-est-documento').value = '';
            document.getElementById('reg-est-nombre').value = '';
            document.getElementById('reg-est-grado').value = '';
            document.getElementById('reg-est-contrasena').value = '';
            // Recargamos la lista
            cargarEstudiantes();
        } else {
            mostrarAlerta('alerta-reg-est', data.mensaje, 'error');
        }
    } catch (e) {
        mostrarAlerta('alerta-reg-est', 'Error de conexión', 'error');
    }
}

async function eliminarEstudiante(id, nombre) {
    if (!confirm(`¿Eliminar al estudiante "${nombre}"? Se borrarán también sus simulacros.`)) return;

    try {
        const res = await fetch(`/api/estudiantes/${id}`, { method: 'DELETE', headers: authHeaders() });
        const data = await res.json();
        if (data.exito) cargarEstudiantes();
        else alert('Error al eliminar el estudiante');
    } catch (e) {
        alert('Error de conexión');
    }
}

// ============================================================
// IMPORTACIÓN MASIVA DESDE EXCEL
// ============================================================

let estudiantesExcel = [];  // Datos leídos del archivo Excel

// Lee el archivo Excel y muestra la vista previa
function leerExcel(input) {
    const archivo = input.files[0];
    if (!archivo) return;

    // Cambiamos el texto de la zona de carga para confirmar el archivo elegido
    document.getElementById('zona-excel').querySelector('span:nth-child(2)').textContent = archivo.name;

    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const datos = new Uint8Array(e.target.result);
            const libro = XLSX.read(datos, { type: 'array' });

            // Tomamos la primera hoja del Excel
            const hoja = libro.Sheets[libro.SheetNames[0]];

            // Convertimos a array de arrays (raw:true para no alterar los valores)
            const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false });

            // Ignoramos la primera fila (encabezado) y filas vacías
            const datos_limpios = filas.slice(1).filter(f => f[0] || f[1]);

            estudiantesExcel = datos_limpios.map((f, i) => ({
                fila: i + 2,
                documento: String(f[0] || '').trim(),
                nombre: String(f[1] || '').trim(),
                contrasena: String(f[2] || '').trim(),
                estado: 'pendiente'
            }));

            if (estudiantesExcel.length === 0) {
                alert('El archivo no tiene datos o está vacío.');
                return;
            }

            mostrarPreviewExcel();
        } catch (err) {
            alert('No se pudo leer el archivo. Asegúrate de que sea un Excel válido (.xlsx o .xls).');
            console.error(err);
        }
    };
    lector.readAsArrayBuffer(archivo);
}

// Muestra la tabla de vista previa con los datos del Excel
function mostrarPreviewExcel() {
    const cuerpo = document.getElementById('cuerpo-preview');
    cuerpo.innerHTML = '';

    estudiantesExcel.forEach((est, i) => {
        const tr = document.createElement('tr');
        tr.id = `fila-excel-${i}`;
        tr.innerHTML = `
            <td>${est.fila}</td>
            <td>${est.documento || '<span style="color:var(--rojo)">Vacío</span>'}</td>
            <td>${est.nombre || '<span style="color:var(--rojo)">Vacío</span>'}</td>
            <td>${est.contrasena || '<span style="color:var(--rojo)">Vacío</span>'}</td>
            <td id="estado-excel-${i}"><span style="color:var(--gris);">Pendiente</span></td>
        `;
        cuerpo.appendChild(tr);
    });

    document.getElementById('preview-conteo').textContent =
        `Se encontraron ${estudiantesExcel.length} estudiante(s) para importar.`;
    document.getElementById('preview-excel').style.display = 'block';
    document.getElementById('alerta-excel').className = 'alerta';

    // Scroll hasta la preview
    document.getElementById('preview-excel').scrollIntoView({ behavior: 'smooth' });
}

// Importa todos los estudiantes en una sola petición al servidor
async function importarEstudiantes() {
    const btn = document.getElementById('btn-importar');
    btn.disabled = true;
    btn.textContent = 'Importando...';

    const grado = document.getElementById('excel-grado-defecto').value;

    try {
        const res = await fetch('/api/estudiantes/registro-lote', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                grado,
                estudiantes: estudiantesExcel.map(e => ({
                    documento: e.documento,
                    nombre: e.nombre,
                    contrasena: e.contrasena
                }))
            })
        });
        const data = await res.json();

        if (!data.exito) {
            mostrarAlerta('alerta-excel', data.mensaje || 'Error al importar', 'error');
            return;
        }

        // Indexar resultados por documento para actualizar cada fila
        const porDocumento = {};
        for (const r of data.resultados) porDocumento[String(r.documento)] = r;

        let exitosos = 0;
        let fallidos = 0;

        estudiantesExcel.forEach((est, i) => {
            const celdaEstado = document.getElementById(`estado-excel-${i}`);
            const r = porDocumento[String(est.documento)];
            if (!r) return;
            if (r.exito) {
                celdaEstado.innerHTML = '<span style="color:var(--verde);">✓ Importado</span>';
                exitosos++;
            } else {
                celdaEstado.innerHTML = `<span style="color:var(--rojo);">✗ ${escapeHtml(r.mensaje)}</span>`;
                fallidos++;
            }
        });

        const tipo = fallidos === 0 ? 'exito' : (exitosos === 0 ? 'error' : 'info');
        mostrarAlerta('alerta-excel',
            `Importación terminada: ${exitosos} registrado(s) correctamente, ${fallidos} con error.`,
            tipo
        );

        if (exitosos > 0) cargarEstudiantes();
    } catch (e) {
        mostrarAlerta('alerta-excel', 'Error de red al importar. Intenta de nuevo.', 'error');
    } finally {
        btn.textContent = 'Importar todos';
        btn.disabled = false;
    }
}

// Limpia la vista previa y el input de archivo
function cancelarImportacion() {
    estudiantesExcel = [];
    document.getElementById('preview-excel').style.display = 'none';
    document.getElementById('input-excel').value = '';
    document.getElementById('zona-excel').querySelector('span:nth-child(2)').textContent = 'Seleccionar archivo Excel';
}

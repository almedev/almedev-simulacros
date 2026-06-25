// Credenciales de prueba — defínelas en .env
// TEST_ESTUDIANTE_DOC, TEST_ESTUDIANTE_PASS, TEST_DOCENTE_USUARIO, TEST_DOCENTE_PASS

function credencialesEstudiante() {
    const doc  = process.env.TEST_ESTUDIANTE_DOC;
    const pass = process.env.TEST_ESTUDIANTE_PASS;
    if (!doc || !pass) throw new Error('Faltan TEST_ESTUDIANTE_DOC y TEST_ESTUDIANTE_PASS en .env');
    return { doc, pass };
}

function credencialesDocente() {
    const usuario = process.env.TEST_DOCENTE_USUARIO || process.env.DOCENTE_USUARIO;
    const pass    = process.env.TEST_DOCENTE_PASS    || process.env.DOCENTE_CONTRASENA;
    if (!usuario || !pass) throw new Error('Faltan credenciales de docente en .env');
    return { usuario, pass };
}

// Inicia sesión como estudiante y deja el navegador en la pantalla de selección de módulo
async function loginEstudiante(page) {
    const { doc, pass } = credencialesEstudiante();
    await page.goto('/estudiante.html');
    await page.fill('#input-documento', doc);
    await page.fill('#input-contrasena-login', pass);
    await page.click('button:has-text("Entrar")');
    await page.waitForSelector('#sec-panel.activa', { timeout: 8000 });
}

// Selecciona el primer módulo disponible (no bloqueado) y arranca el simulacro
// Devuelve false si no hay módulos disponibles
async function iniciarSimulacro(page) {
    // Navegar a la sección de selección desde el panel de bienvenida
    await page.click('button:has-text("Hacer simulacro")');
    await page.waitForSelector('#sec-seleccion.activa', { timeout: 8000 });

    // Esperar a que carguen los botones de módulo (reemplaza el spinner)
    await page.waitForSelector('.btn-modulo', { timeout: 8000 });

    const boton = page.locator('.btn-modulo:not([disabled])').first();
    if (await boton.count() === 0) return false;

    await boton.click();
    await page.click('#btn-comenzar');
    await page.waitForSelector('#sec-simulacro.activa', { timeout: 8000 });
    return true;
}

// Simula que el usuario cambia de pestaña (oculta) y vuelve
async function cambiarPestana(page) {
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(100);
}

module.exports = { loginEstudiante, iniciarSimulacro, cambiarPestana, credencialesDocente };

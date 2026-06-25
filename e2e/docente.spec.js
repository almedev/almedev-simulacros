const { test, expect } = require('@playwright/test');
const { credencialesDocente } = require('./helpers');

async function loginDocente(page) {
    const { usuario, pass } = credencialesDocente();
    await page.goto('/docente.html');
    await page.fill('#input-usuario', usuario);
    await page.fill('#input-contrasena', pass);
    await page.click('button:has-text("Entrar")');
    await page.waitForSelector('#sec-panel.activa', { timeout: 8000 });
}

test.describe('Login docente', () => {
    test('credenciales correctas → llega al panel', async ({ page }) => {
        await loginDocente(page);
        await expect(page.locator('#sec-panel')).toHaveClass(/activa/);
    });

    test('credenciales incorrectas → mensaje de error', async ({ page }) => {
        await page.goto('/docente.html');
        await page.fill('#input-usuario', 'usuariofalso');
        await page.fill('#input-contrasena', 'clavefalsaa');
        await page.click('button:has-text("Entrar")');
        await expect(page.locator('#alerta-login')).toBeVisible();
    });

    test('cerrar sesión vuelve al login', async ({ page }) => {
        await loginDocente(page);
        await page.click('#btn-salir-enc');
        await expect(page.locator('#sec-login')).toHaveClass(/activa/);
        const token = await page.evaluate(() => sessionStorage.getItem('docenteToken'));
        expect(token).toBeNull();
    });
});

test.describe('Panel docente — navegación por tabs', () => {
    test.beforeEach(async ({ page }) => {
        await loginDocente(page);
    });

    test('tab Estadísticas carga el contenedor', async ({ page }) => {
        await expect(page.locator('#tab-estadisticas')).toHaveClass(/activo/);
        await expect(page.locator('#contenedor-estadisticas')).toBeVisible();
    });

    test('tab Banco de preguntas es accesible', async ({ page }) => {
        await page.click('button:has-text("Banco de preguntas")');
        await expect(page.locator('#tab-preguntas')).toHaveClass(/activo/);
        await expect(page.locator('#contenedor-preguntas')).toBeVisible();
    });

    test('tab Estudiantes carga la tabla', async ({ page }) => {
        await page.click('button:has-text("Estudiantes")');
        await expect(page.locator('#tab-estudiantes')).toHaveClass(/activo/);
        await expect(page.locator('#contenedor-estudiantes')).toBeVisible();
    });
});

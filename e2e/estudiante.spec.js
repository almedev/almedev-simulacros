const { test, expect } = require('@playwright/test');
const { loginEstudiante, iniciarSimulacro, cambiarPestana } = require('./helpers');

test.describe('Login estudiante', () => {
    test('credenciales correctas → llega al panel', async ({ page }) => {
        await loginEstudiante(page);
        await expect(page.locator('#sec-panel')).toHaveClass(/activa/);
    });

    test('credenciales incorrectas → mensaje de error', async ({ page }) => {
        await page.goto('/estudiante.html');
        await page.fill('#input-documento', '0000000');
        await page.fill('#input-contrasena-login', 'incorrecta');
        await page.click('button:has-text("Entrar")');
        await expect(page.locator('#alerta-documento')).toBeVisible();
    });

    test('cerrar sesión limpia la pantalla', async ({ page }) => {
        await loginEstudiante(page);
        await page.click('#btn-salir-enc');
        await expect(page.locator('#sec-documento')).toHaveClass(/activa/);
        // El token ya no debe estar en sessionStorage
        const token = await page.evaluate(() => sessionStorage.getItem('estudianteToken'));
        expect(token).toBeNull();
    });
});

test.describe('Timer del simulacro', () => {
    test.beforeEach(async ({ page }) => {
        await page.clock.install();
        await loginEstudiante(page);
    });

    test('al llegar a 0 el simulacro se envía y aparecen los resultados', async ({ page }) => {
        const iniciado = await iniciarSimulacro(page);
        test.skip(!iniciado, 'No hay módulos disponibles para este estudiante');

        await expect(page.locator('#sec-simulacro')).toHaveClass(/activa/);

        // Avanzamos el reloj 10 minutos y 1 segundo
        await page.clock.fastForward(10 * 60 * 1000 + 1000);

        await expect(page.locator('#sec-resultados')).toHaveClass(/activa/, { timeout: 5000 });
    });

    test('el contador se vuelve rojo cuando quedan ≤ 2 minutos', async ({ page }) => {
        const iniciado = await iniciarSimulacro(page);
        test.skip(!iniciado, 'No hay módulos disponibles');

        // Avanzamos hasta que queden 2 minutos
        await page.clock.fastForward(8 * 60 * 1000);
        await expect(page.locator('#temporizador')).toHaveClass(/urgente/, { timeout: 3000 });
    });
});

test.describe('Detección de cambio de pestaña', () => {
    test.beforeEach(async ({ page }) => {
        await loginEstudiante(page);
    });

    test('primera salida → aparece modal de advertencia', async ({ page }) => {
        const iniciado = await iniciarSimulacro(page);
        test.skip(!iniciado, 'No hay módulos disponibles');

        await cambiarPestana(page);
        await expect(page.locator('#modal-trampa')).toBeVisible({ timeout: 3000 });
    });

    test('tres salidas → simulacro se envía automáticamente', async ({ page }) => {
        const iniciado = await iniciarSimulacro(page);
        test.skip(!iniciado, 'No hay módulos disponibles');

        await cambiarPestana(page);
        // Cerrar el modal antes de la segunda salida
        await page.evaluate(() => { document.getElementById('modal-trampa').style.display = 'none'; });

        await cambiarPestana(page);
        await page.evaluate(() => { document.getElementById('modal-trampa').style.display = 'none'; });

        await cambiarPestana(page);

        await expect(page.locator('#sec-resultados')).toHaveClass(/activa/, { timeout: 5000 });
    });
});

test.describe('Restauración de sesión al refrescar', () => {
    test('refrescar durante simulacro restaura el simulacro', async ({ page }) => {
        await loginEstudiante(page);
        const iniciado = await iniciarSimulacro(page);
        test.skip(!iniciado, 'No hay módulos disponibles');

        // Verificamos que estamos en el simulacro
        await expect(page.locator('#sec-simulacro')).toHaveClass(/activa/);

        // Recargamos la página
        await page.reload();

        // El simulacro debe restaurarse automáticamente
        await expect(page.locator('#sec-simulacro')).toHaveClass(/activa/, { timeout: 5000 });
    });

    test('refrescar después de cerrar sesión lleva al login', async ({ page }) => {
        await loginEstudiante(page);
        await page.click('#btn-salir-enc');
        await page.reload();
        await expect(page.locator('#sec-documento')).toHaveClass(/activa/);
    });
});

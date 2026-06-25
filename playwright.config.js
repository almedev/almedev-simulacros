require('dotenv').config();
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        locale: 'es-CO',
    },
    webServer: {
        command: 'node server.js',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 15000,
    },
});

const { defineConfig, devices } = require('@playwright/test');

const PORT = Number(process.env.PORT || 8123);

// Su alcune macchine Chromium è già presente fuori dalla cartella di
// Playwright: PW_CHROMIUM_PATH permette di puntarci senza riscaricarlo.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const launchOptions = { executablePath };

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // I test della clipboard leggono ciò che l'app ha copiato.
    permissions: ['clipboard-read', 'clipboard-write'],
    // La lingua si sceglie da navigator.language: la suite di base verifica
    // l'italiano, e i test dedicati all'inglese sovrascrivono il locale.
    locale: 'it-IT'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions }
    },
    {
      // L'app è mobile-first: il layout a colonna singola è quello che si usa
      // davvero sul campo, e va coperto quanto il desktop.
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions }
    }
  ],
  webServer: {
    command: `node scripts/serve.js ${PORT}`,
    url: `http://localhost:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore'
  }
});

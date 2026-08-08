// Genera le icone PNG dell'app a partire dal marchio dell'intestazione.
//
// Le icone non si disegnano a mano: sono lo stesso mirino che sta accanto a
// "ReadyClickShot", reso da Chromium alle dimensioni richieste. Così quando il
// marchio cambia si rigenerano invece di divergere lentamente dall'originale,
// che è esattamente quello che era successo alle icone precedenti (una macchina
// fotografica generica, rimasta lì dopo il cambio di logo).
//
//   npm run icone
//
// Serve Playwright, che è già una dipendenza di sviluppo per i test.

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const CARTELLA = path.join(__dirname, '..', 'icons');

// Gli stessi tracciati dell'SVG in index.html, viewBox 0 0 24 24. Se cambiano
// lì vanno cambiati qui: il test `le icone corrispondono al marchio` controlla
// che le due copie restino allineate.
const MIRINO = `
  <path d="M3 8.4V5.2A2.2 2.2 0 0 1 5.2 3h3.2M15.6 3h3.2A2.2 2.2 0 0 1 21 5.2v3.2M21 15.6v3.2a2.2 2.2 0 0 1-2.2 2.2h-3.2M8.4 21H5.2A2.2 2.2 0 0 1 3 18.8v-3.2"
        fill="none" stroke="COLORE_TRATTO" stroke-width="1.9" stroke-linecap="round"/>
  <circle cx="12" cy="12" r="3.1" fill="none" stroke="COLORE_TRATTO" stroke-width="1.7"/>
  <circle cx="12" cy="12" r="1.15" fill="COLORE_PUNTO"/>`;

const SFONDO = '#0f172a';   // uguale a theme_color e background_color del manifest
const TRATTO = '#f8fafc';
// Il punto centrale è l'unico elemento colorato. Nell'interfaccia il colore del
// brand è riservato a ciò che è interattivo, ma l'icona non è interfaccia: è un
// quadrato di 48 px in mezzo ad altre icone, e un marchio interamente
// monocromatico lì sparisce.
const PUNTO = '#14b8a6';

// Quanta parte del quadrato occupa il marchio.
//   any       il marchio si vede intero, l'icona è già quella finale
//   maskable  il sistema ritaglia a piacere (cerchio, goccia, squircle) e
//             garantisce solo il cerchio centrale dell'80%. Un quadrato
//             inscritto in quel cerchio misura il 56% del lato: sotto quella
//             soglia il marchio non viene mai tagliato.
const OCCUPAZIONE = { any: 0.6, maskable: 0.52 };

function pagina(lato, scopo) {
  const dimensione = Math.round(lato * OCCUPAZIONE[scopo]);
  const disegno = MIRINO
    .replace(/COLORE_TRATTO/g, TRATTO)
    .replace(/COLORE_PUNTO/g, PUNTO);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; }
    #icona {
      width: ${lato}px; height: ${lato}px; background: ${SFONDO};
      display: flex; align-items: center; justify-content: center;
    }
    svg { width: ${dimensione}px; height: ${dimensione}px; display: block; }
  </style></head><body>
    <div id="icona"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${disegno}</svg></div>
  </body></html>`;
}

async function genera() {
  // Stessa convenzione di playwright.config.js: su alcune macchine Chromium sta
  // fuori dalla cartella di Playwright e PW_CHROMIUM_PATH ci punta.
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined
  });
  // deviceScaleFactor 1: le misure in CSS pixel sono già quelle finali del PNG.
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();

  const richieste = [
    { file: 'icon-192.png', lato: 192, scopo: 'any' },
    { file: 'icon-512.png', lato: 512, scopo: 'any' },
    { file: 'icon-maskable-512.png', lato: 512, scopo: 'maskable' }
  ];

  for (const { file, lato, scopo } of richieste) {
    await page.setViewportSize({ width: lato, height: lato });
    await page.setContent(pagina(lato, scopo));
    const buffer = await page.locator('#icona').screenshot({ type: 'png' });
    fs.writeFileSync(path.join(CARTELLA, file), buffer);
    console.log(`${file}  ${lato}x${lato}  (${scopo})`);
  }

  await browser.close();
}

genera().catch(errore => {
  console.error(errore);
  process.exit(1);
});

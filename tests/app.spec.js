const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Ogni test parte da una pagina pulita, senza preset o service worker
// ereditati dal test precedente.
test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Inizializzazione', () => {
  test('disegna i chip dei modelli al primo caricamento', async ({ page }) => {
    // Il conteggio si ricava dal dato: cosi' aggiungere una camera al catalogo
    // non fa fallire un test che sul catalogo non ha niente da dire.
    const modelliDji = await page.evaluate(() => Object.keys(cameraModelsData.dji).length);
    expect(modelliDji).toBeGreaterThan(1);
    await expect(page.locator('#model-chips-container .btn-chip')).toHaveCount(modelliDji);
    await expect(page.locator('#model-chips-container .btn-chip.selected')).toHaveCount(1);
  });

  test('mostra il segnaposto dei preset quando non ce ne sono', async ({ page }) => {
    await expect(page.locator('#container-saved-presets')).toContainText('Nessun preset salvato');
  });

  test('popola la guida editing senza richiedere interazione', async ({ page }) => {
    await expect(page.locator('#edit-steps-list li').first()).toBeAttached();
    await expect(page.locator('#edit-pills .pill-tag').first()).toBeAttached();
  });

  test('calcola i risultati allo avvio', async ({ page }) => {
    await expect(page.locator('#val-res')).not.toBeEmpty();
    await expect(page.locator('#val-fps')).toHaveText('25 fps (PAL)');
  });

  test('non produce errori in console', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.reload();
    await page.waitForTimeout(300);
    expect(errors).toEqual([]);
  });
});

test.describe('Preset salvati', () => {
  test('il nome del preset viene trattato come testo, non come HTML', async ({ page }) => {
    const payload = '<img src=x onerror="window.__pwned=1">Corsa';
    await page.fill('#input-preset-name', payload);
    await page.click('button.btn-save-preset');

    await expect(page.locator('#container-saved-presets img')).toHaveCount(0);
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    await expect(page.locator('#container-saved-presets')).toContainText(payload);
  });

  test('ricaricare un preset ripristina anche il modello, non solo il brand', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await page.locator('#model-chips-container .btn-chip', { hasText: 'HERO 11 Black' }).click();
    await page.fill('#input-preset-name', 'Test GoPro 11');
    await page.click('button.btn-save-preset');

    await page.click('#brand-card-dji');
    await page.locator('#container-saved-presets .preset-tag-btn', { hasText: 'Test GoPro 11' }).click();

    // textContent e non innerText: il CSS applica text-transform: uppercase.
    await expect(page.locator('#model-indicator')).toHaveText('HERO 11 Black');
    await expect(page.locator('#brand-card-gopro')).toHaveClass(/active-gopro/);
    await expect(page.locator('#model-chips-container .btn-chip.selected')).toHaveCount(1);
  });

  test('i preset sopravvivono a un ricaricamento della pagina', async ({ page }) => {
    await page.fill('#input-preset-name', 'Giro serale');
    await page.click('button.btn-save-preset');
    await page.reload();
    await expect(page.locator('#container-saved-presets')).toContainText('Giro serale');
  });
});

test.describe('Motore di calcolo', () => {
  test('scarsa luce piu sport genera un conflitto risolvibile', async ({ page }) => {
    await page.locator('#scenario-chips-container .btn-chip', { hasText: 'Bici / Sport' }).click();
    await page.locator('#scenario-chips-container .btn-chip', { hasText: 'Notturno' }).click();

    await expect(page.locator('#container-conflicts')).toContainText('Framerate');
    await page.locator('.btn-compromise', { hasText: 'Azione' }).click();
    await expect(page.locator('#val-fps')).toHaveText('50 fps (PAL)');
    await expect(page.locator('#val-nd')).toContainText('NO ND');

    await page.locator('.btn-compromise', { hasText: 'Luce' }).click();
    await expect(page.locator('#val-fps')).toHaveText('25 fps (PAL)');
  });

  test('il profilo Endurance abbassa fps e bitrate', async ({ page }) => {
    await page.locator('#scenario-chips-container .btn-chip', { hasText: 'Bici / Sport' }).click();
    await expect(page.locator('#val-fps')).toHaveText('50 fps (PAL)');

    await page.locator('#panel-wizard .btn-radio', { hasText: 'Endurance' }).click();
    await expect(page.locator('#val-fps')).toHaveText('25 fps (PAL)');
    // Action 6: 120 Mbps dimezzati dal profilo Endurance.
    await expect(page.locator('#metric-bitrate')).toContainText('~60 Mbps');
  });

  test('NTSC produce i framerate della famiglia 30', async ({ page }) => {
    await page.locator('#panel-wizard .btn-radio', { hasText: 'NTSC' }).click();
    await expect(page.locator('#val-fps')).toHaveText('30 fps (NTSC)');
  });

  test('la modalita subacquea rimuove gli ND e alza il bilanciamento del bianco', async ({ page }) => {
    await page.locator('#panel-wizard .btn-radio', { hasText: "Sott'Acqua" }).click();
    await expect(page.locator('#val-nd')).toContainText('RIMUOVERE ND');
    await expect(page.locator('#val-wb')).toContainText('6500K');
  });

  test('il preset universale applica il setup multisport', async ({ page }) => {
    await page.locator('.preset-tag-btn', { hasText: 'Triathlon' }).click();
    await expect(page.locator('#val-fps')).toHaveText('50 fps (PAL)');
    await expect(page.locator('#res-pills')).toContainText('Sport');
  });

  test('la modalita foto non cita setup personali nel rigging', async ({ page }) => {
    await page.locator('#panel-wizard .btn-radio', { hasText: 'Foto' }).click();
    await page.locator('#scenario-chips-container .btn-chip', { hasText: 'Bici / Sport' }).click();
    await expect(page.locator('#rigging-text')).not.toContainText(/carbonio/i);
    await expect(page.locator('#val-color')).toContainText('RAW');
  });
});

test.describe('Coerenza fra wizard e calcolatore ND', () => {
  test('a 30 fps in pieno sole entrambi indicano ND64 / ND128', async ({ page }) => {
    await expect(page.locator('#val-fps')).toHaveText('25 fps (PAL)');
    const wizardNd = await page.locator('#val-nd').textContent();
    expect(wizardNd).toContain('ND64 / ND128');

    await page.locator('.tab-btn', { hasText: 'Rigging & Calc' }).click();
    await page.locator('#panel-calc .btn-radio', { hasText: '30 FPS' }).click();
    await expect(page.locator('#calc-result-shutter')).toHaveText('1/60 s');
    await expect(page.locator('#calc-result-nd')).toContainText('ND64 / ND128');
  });

  test('a framerate alti serve meno densita di ND', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Rigging & Calc' }).click();
    await page.locator('#panel-calc .btn-radio', { hasText: '120 FPS' }).click();
    await expect(page.locator('#calc-result-shutter')).toHaveText('1/240 s');
    await expect(page.locator('#calc-result-nd')).toContainText('ND16 / ND32');
  });
});

test.describe('Guida editing', () => {
  test('non lascia trapelare markdown grezzo', async ({ page }) => {
    await page.locator('.tab-btn', { hasText: 'Editing & Vis' }).click();
    await page.locator('#panel-editing .btn-chip', { hasText: 'Audio & Vento' }).click();

    await expect(page.locator('#edit-export-list')).not.toContainText('**');
    await expect(page.locator('#edit-export-list b', { hasText: '-1 dB' })).toHaveCount(1);
  });

  test('si adatta al brand selezionato', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await page.locator('.tab-btn', { hasText: 'Editing & Vis' }).click();
    await expect(page.locator('#editing-app-header')).toContainText('GoPro Quik');
  });
});

test.describe('PWA', () => {
  test('il manifest referenzia solo icone locali e raggiungibili', async ({ page, request }) => {
    const manifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('./')).toBe(true);
      const res = await request.get('/' + icon.src.replace(/^\.\//, ''));
      expect(res.status()).toBe(200);
      expect((await res.body()).length).toBeGreaterThan(0);
    }
  });

  test('la versione del pacchetto e quella della cache restano allineate', async () => {
    // Se cambia il contenuto ma non il nome della cache, i browser restano
    // sulle vecchie copie degli asset statici.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const major = pkg.version.split('.')[0];
    expect(sw).toContain(`-v${major}-cache`);
  });

  test('la versione del formato dei preset segue quella del pacchetto', async () => {
    // Il file esportato porta la versione del formato: se resta indietro,
    // un domani non si distingue piu' un file vecchio da uno nuovo.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const major = Number(pkg.version.split('.')[0]);
    expect(html).toContain(`const PRESET_SCHEMA_VERSION = ${major};`);
  });

  test('il nome dell app e coerente ovunque', async ({ page }) => {
    const manifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
    expect(manifest.name).toBe('ReadyClickShot');
    await expect(page).toHaveTitle(/ReadyClickShot/);
    await expect(page.locator('.app-title')).toContainText('ReadyClickShot');
    expect(await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content'))
      .toBe('ReadyClickShot');
  });
});

test.describe('Service worker', () => {
  test('serve subito la nuova versione dopo un deploy', async ({ page, request }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);

    // Simula un deploy: da qui in poi il server aggiunge un meta riconoscibile.
    // Il marcatore non sta nel <title> perché l'app lo riscrive secondo la lingua.
    await request.get('/__test/marker?value=DEPLOY-MARKER');
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await page.getAttribute('meta[name="x-deploy-marker"]', 'content'))
        .toBe('DEPLOY-MARKER');
    } finally {
      await request.get('/__test/marker?value=');
    }
  });

  test('offline continua a servire l app dalla cache', async ({ page, context }) => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(300);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
      const modelliDji = await page.evaluate(() => Object.keys(cameraModelsData.dji).length);
      await expect(page.locator('#model-chips-container .btn-chip')).toHaveCount(modelliDji);
    } finally {
      await context.setOffline(false);
    }
  });
});

test.describe('Tema', () => {
  test('la scelta del tema sopravvive al ricaricamento', async ({ page }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
    // Il checkbox e' visivamente nascosto dietro lo slider: si clicca l'etichetta.
    await page.locator('.theme-switch').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#theme-toggle')).toBeChecked();
  });
});

test.describe('Accessibilita', () => {
  test('non resta alcun gestore inline nel markup', async ({ page }) => {
    const inline = await page.evaluate(() =>
      document.querySelectorAll('[onclick], [oninput], [onchange]').length);
    expect(inline).toBe(0);
  });

  test('le brand card sono bottoni raggiungibili da tastiera', async ({ page }) => {
    const card = page.locator('#brand-card-gopro');
    await expect(card).toHaveJSProperty('tagName', 'BUTTON');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#brand-card-dji')).toHaveAttribute('aria-pressed', 'false');
  });

  test('aria-pressed segue la selezione dei controlli', async ({ page }) => {
    const sport = page.locator('[data-action="toggleScenario"][data-value="sport"]');
    await expect(sport).toHaveAttribute('aria-pressed', 'false');
    await sport.click();
    await expect(sport).toHaveAttribute('aria-pressed', 'true');

    const foto = page.locator('[data-action="setMode"][data-value="foto"]');
    await foto.click();
    await expect(foto).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-action="setMode"][data-value="video"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('le schede espongono la semantica tab/tabpanel', async ({ page }) => {
    await expect(page.locator('[role="tablist"]')).toHaveCount(1);
    await expect(page.locator('[role="tab"]')).toHaveCount(4);
    await expect(page.locator('#tab-wizard')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-calc')).toHaveAttribute('hidden', '');

    await page.locator('#tab-calc').click();
    await expect(page.locator('#tab-calc')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-calc')).not.toHaveAttribute('hidden', '');
    await expect(page.locator('#panel-wizard')).toHaveAttribute('hidden', '');
  });

  test('il tooltip si apre con un tap e si chiude con Escape', async ({ page }) => {
    const tip = page.locator('.tooltip').first();
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
    await tip.click();
    await expect(tip).toHaveAttribute('aria-expanded', 'true');
    await expect(tip.locator('.tooltip-text')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(tip).toHaveAttribute('aria-expanded', 'false');
  });

  test('lo zoom non e bloccato dal viewport', async ({ page }) => {
    const content = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(content).not.toContain('user-scalable=no');
    expect(content).not.toContain('maximum-scale');
    expect(content).toContain('viewport-fit=cover');
  });
});

test.describe('Safe area (notch)', () => {
  test('header e barra inferiore rispettano gli inset', async ({ page }) => {
    // Sopra i 768px la barra diventa sticky in alto e non ha piu' inset
    // inferiore: la verifica ha senso sul layout mobile.
    await page.setViewportSize({ width: 390, height: 844 });
    const before = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.app-header')).paddingTop,
      nav: getComputedStyle(document.querySelector('.tab-nav')).paddingBottom
    }));

    // Gli inset reali non sono simulabili dal browser di test: si sostituisce
    // il valore delle variabili per verificare che il layout li consumi.
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--safe-top', '47px');
      document.documentElement.style.setProperty('--safe-bottom', '34px');
    });
    const after = await page.evaluate(() => ({
      header: getComputedStyle(document.querySelector('.app-header')).paddingTop,
      nav: getComputedStyle(document.querySelector('.tab-nav')).paddingBottom
    }));

    expect(parseFloat(after.header) - parseFloat(before.header)).toBeCloseTo(47, 0);
    expect(parseFloat(after.nav) - parseFloat(before.nav)).toBeCloseTo(34, 0);
  });
});

test.describe('Condivisione e copia', () => {
  test('il link del setup ricostruisce la configurazione', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await page.locator('#model-chips-container .btn-chip', { hasText: 'HERO 11 Black' }).click();
    await page.locator('#scenario-chips-container .btn-chip', { hasText: 'Bici / Sport' }).click();
    await page.locator('#panel-wizard .btn-radio', { hasText: 'NTSC' }).click();

    await page.locator('[data-action="copyShareLink"]').click();
    await expect(page.locator('#toast')).toContainText('copiato');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('b=gopro');
    expect(link).toContain('m=hero11');

    // Il link va aperto in una pagina nuova, come farebbe chi lo riceve.
    const fresh = await page.context().newPage();
    await fresh.goto(link);
    await expect(fresh.locator('#model-indicator')).toHaveText('HERO 11 Black');
    await expect(fresh.locator('#val-fps')).toHaveText('60 fps (NTSC)');
    await expect(fresh.locator('#brand-card-gopro')).toHaveClass(/active-gopro/);
    await fresh.close();
  });

  test('copia impostazioni produce un riepilogo leggibile', async ({ page }) => {
    await page.locator('[data-action="copySettings"]').click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('DJI Osmo Action 6');
    expect(text).toContain('Framerate: 25 fps (PAL)');
    expect(text).toContain('Filtro ND: ND64 / ND128');
  });
});

test.describe('Export e import dei preset', () => {
  test('esporta i preset salvati come JSON', async ({ page }) => {
    await page.fill('#input-preset-name', 'Discesa');
    await page.click('button.btn-save-preset');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-action="exportPresets"]').click()
    ]);
    expect(download.suggestedFilename()).toBe('camstudio-presets.json');

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(parsed.presets).toHaveLength(1);
    expect(parsed.presets[0].name).toBe('Discesa');
  });

  test('importa i preset da un file e scarta cio che non ha la forma attesa', async ({ page }) => {
    const payload = JSON.stringify({
      presets: [
        { name: 'Da file', scenarios: ['sport'], brand: 'gopro', modelKey: 'hero13', luce: 'sole' },
        { rumore: true }
      ]
    });
    await page.setInputFiles('#input-import-presets', {
      name: 'presets.json', mimeType: 'application/json', buffer: Buffer.from(payload)
    });

    await expect(page.locator('#toast')).toContainText('1 preset importati');
    await expect(page.locator('#container-saved-presets')).toContainText('Da file');

    await page.locator('.preset-tag-btn', { hasText: 'Da file' }).click();
    await expect(page.locator('#model-indicator')).toHaveText('HERO 13 Black');
  });

  test('un file non valido non rompe l elenco', async ({ page }) => {
    await page.setInputFiles('#input-import-presets', {
      name: 'rotto.json', mimeType: 'application/json', buffer: Buffer.from('{ non json')
    });
    await expect(page.locator('#toast')).toContainText('non valido');
    await expect(page.locator('#container-saved-presets')).toContainText('Nessun preset salvato');
  });
});

test.describe('Preset con valori fuori dominio', () => {
  // Il file importato e' l'unico ingresso non fidato che finisce in
  // localStorage, e la forma puo' essere giusta mentre i valori non lo sono:
  // il link condiviso li scartava gia', il preset li accettava.
  const FUORI_DOMINIO = JSON.stringify({
    presets: [{
      name: 'Rotto',
      scenarios: ['non-esiste', 'sport'],
      mode: 'modo-inventato',
      luce: 'buio-pesto',
      region: 'secam',
      sub: 'spazio',
      bitrateProf: 'ultra-mega',
      brand: 'dji'
    }]
  });

  async function importa(page) {
    await page.setInputFiles('#input-import-presets', {
      name: 'presets.json', mimeType: 'application/json', buffer: Buffer.from(FUORI_DOMINIO)
    });
    await expect(page.locator('#container-saved-presets')).toContainText('Rotto');
  }

  async function importaEApplica(page) {
    await importa(page);
    await page.locator('.preset-tag-btn', { hasText: 'Rotto' }).click();
  }

  test('i valori fuori dominio ripiegano sui default', async ({ page }) => {
    await importaEApplica(page);
    const stato = await page.evaluate(() => ({
      mode: currentMode, luce: currentLuce, region: currentRegion,
      sub: currentSub, bp: currentBitrateProfile, scenarios: [...selectedScenarios]
    }));
    expect(stato).toEqual({
      mode: 'video', luce: 'sole', region: 'pal',
      sub: 'fuori', bp: 'high', scenarios: ['sport']
    });
  });

  test('nessun gruppo di controlli resta senza selezione', async ({ page }) => {
    await importaEApplica(page);
    // Un valore fuori dominio non ha un bottone corrispondente: il gruppo
    // resterebbe tutto spento mentre i risultati sono gia' calcolati.
    for (const action of ['setMode', 'setLuce', 'setRegion', 'setSub', 'setBitrateProf']) {
      await expect(page.locator(`[data-action="${action}"][aria-pressed="true"]`)).toHaveCount(1);
    }
  });

  test('lo scenario sconosciuto non arriva a schermo', async ({ page }) => {
    await importaEApplica(page);
    await expect(page.locator('body')).not.toContainText('undefined');
  });

  test('il link condiviso resta coerente con cio che si vede', async ({ page }) => {
    await importaEApplica(page);
    // Altrimenti chi riceve il link vede un setup diverso dal mittente:
    // applyStateFromHash scarta i valori invalidi, e il risultato cambia.
    const hash = await page.evaluate(() => new URL(buildShareUrl()).hash.replace(/^#/, ''));
    const params = new URLSearchParams(hash);
    expect(params.get('mode')).toBe('video');
    expect(params.get('l')).toBe('sole');
    expect(params.get('r')).toBe('pal');
    expect(params.get('sub')).toBe('fuori');
    expect(params.get('bp')).toBe('high');
    expect(params.get('s')).toBe('sport');
  });

  test('in localStorage non resta nulla fuori dominio', async ({ page }) => {
    await importa(page);
    const salvato = await page.evaluate(() => readPresets()[0]);
    expect(salvato).toMatchObject({
      name: 'Rotto', mode: 'video', luce: 'sole', region: 'pal',
      sub: 'fuori', bitrateProf: 'high', scenarios: ['sport'], brand: 'dji'
    });
  });

  test('un preset senza camera continua a valere per quella corrente', async ({ page }) => {
    await page.locator('[data-action="selectBrand"][data-value="gopro"]').click();
    await page.setInputFiles('#input-import-presets', {
      name: 'presets.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ presets: [{ name: 'Senza camera', scenarios: ['night'] }] }))
    });
    await page.locator('.preset-tag-btn', { hasText: 'Senza camera' }).click();
    expect(await page.evaluate(() => currentBrand)).toBe('gopro');
  });
});

test.describe('Autonomia batteria', () => {
  test('la stima dipende dal modello e dalla temperatura', async ({ page }) => {
    await page.locator('#tab-calc').click();
    const mite = await page.locator('#battery-result-time').textContent();
    expect(mite).toBe('~150 Minuti');
    await expect(page.locator('#battery-result-note')).toContainText('Action 6');

    await page.locator('#panel-calc .btn-radio', { hasText: 'Freddo' }).click();
    expect(await page.locator('#battery-result-time').textContent()).toBe('~90 Minuti');

    await page.locator('#tab-wizard').click();
    await page.click('#brand-card-gopro');
    await page.locator('#tab-calc').click();
    // GoPro MISSION 1 Pro: base piu' alta, stesso fattore di freddo.
    expect(await page.locator('#battery-result-time').textContent()).toBe('~115 Minuti');
  });
});

test.describe('Limite di ripresa (scheda contro batteria)', () => {
  // Scheda e batteria si esauriscono in momenti diversi: il vincolo vero e'
  // il piu' basso dei due, ed e' quello che va detto.
  test('con una scheda capiente il vincolo e la batteria', async ({ page }) => {
    await page.locator('#tab-calc').click();
    // Action 6 a 120 Mbps: 128 GB durano 142 min, meno della batteria, quindi
    // per far vincere la batteria serve salire di taglio. 256 GB danno 284 min.
    await page.click('[data-action="setCardSize"][data-value="256"]');
    await expect(page.locator('#limit-verdict')).toHaveText('La batteria');
    await expect(page.locator('#limit-detail')).toContainText('~150 minuti');
    await expect(page.locator('#limit-detail')).toContainText('batteria: 150 min');
  });

  test('con una scheda piccola il vincolo diventa la scheda', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await page.click('[data-action="setCardSize"][data-value="64"]');
    await expect(page.locator('#limit-verdict')).toHaveText('La scheda');
    await expect(page.locator('#limit-detail')).toContainText('~70 minuti');
  });

  test('il profilo Endurance allunga i minuti sulla scheda', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await page.click('[data-action="setCardSize"][data-value="64"]');
    const alto = await page.locator('#limit-detail').textContent();

    await page.locator('#tab-wizard').click();
    await page.click('[data-action="setBitrateProf"][data-value="eco"]');
    await page.locator('#tab-calc').click();
    const eco = await page.locator('#limit-detail').textContent();

    // Meta' bitrate, il doppio dei minuti: 120 Mbps -> 60 Mbps.
    expect(alto).toContain('scheda 64 GB: 71 min');
    expect(eco).toContain('scheda 64 GB: 142 min');
  });

  test('la capacita scelta sopravvive al ricaricamento', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await page.click('[data-action="setCardSize"][data-value="256"]');
    await page.reload();
    await page.locator('#tab-calc').click();
    await expect(page.locator('[data-action="setCardSize"][aria-pressed="true"]')).toHaveText('256 GB');
  });

  test('in modalita foto il limite non mostra un bitrate video stantio', async ({ page }) => {
    // Il bitrate lo produce solo il motore video: mostrarlo qui sarebbe un
    // numero che non c'entra con quello che si sta facendo.
    await page.click('[data-action="setMode"][data-value="foto"]');
    await page.locator('#tab-calc').click();
    await expect(page.locator('#limit-verdict')).toHaveText('—');
    await expect(page.locator('#limit-detail')).toContainText('modalità video');
  });
});

test.describe('Confronto fra camere', () => {
  test('senza scenari particolari ordina per bitrate', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await expect(page.locator('#compare-reason')).toContainText('In ordine di bitrate');
    const totale = await page.evaluate(() =>
      Object.values(cameraModelsData).reduce((n, b) => n + Object.keys(b).length, 0));
    await expect(page.locator('.compare-row')).toHaveCount(totale);
    // 240 Mbps: il bitrate piu' alto del catalogo.
    await expect(page.locator('.compare-row').first()).toContainText('MISSION 1 Pro');
  });

  test('la subacquea riordina per profondita', async ({ page }) => {
    await page.click('[data-action="setSub"][data-value="sub"]');
    await page.locator('#tab-calc').click();
    await expect(page.locator('#compare-reason')).toContainText('profondità');
    const prima = page.locator('.compare-row').first();
    // A parita' di profondita' (20 m) l'ordine di partenza e' quello di
    // uscita, quindi in testa sta la piu' recente delle DJI.
    await expect(prima).toContainText('Action 6');
    await expect(prima).toContainText('20 m');
  });

  test('i viaggi riordinano per autonomia', async ({ page }) => {
    await page.click('[data-action="toggleScenario"][data-value="travel"]');
    await page.locator('#tab-calc').click();
    await expect(page.locator('#compare-reason')).toContainText('autonomia');
    await expect(page.locator('.compare-row').first()).toContainText('185 min');
  });

  test('la camera attiva e evidenziata, e una sola', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await expect(page.locator('.compare-row[aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('.compare-row[aria-pressed="true"]')).toContainText('Action 6');
  });

  test('dal confronto si passa direttamente a un altro brand', async ({ page }) => {
    await page.locator('#tab-calc').click();
    // La prima riga per bitrate e' la MISSION 1 Pro, che e' GoPro: il click
    // deve cambiare anche il brand, non solo il modello.
    await page.locator('.compare-row').first().click();
    expect(await page.evaluate(() => currentBrand)).toBe('gopro');
    await page.locator('#tab-wizard').click();
    await expect(page.locator('#model-indicator')).toHaveText('MISSION 1 Pro');
  });
});

test.describe('Ordine dei modelli', () => {
  test('ogni modello dichiara una data di uscita', async ({ page }) => {
    // Senza released il modello finirebbe in un punto qualsiasi dell'elenco:
    // e' la dimenticanza che riporterebbe il disordine.
    const senzaData = await page.evaluate(() =>
      Object.entries(cameraModelsData).flatMap(([brand, models]) =>
        Object.entries(models)
          .filter(([, m]) => !/^\d{4}-\d{2}$/.test(String(m.released)))
          .map(([key]) => brand + '/' + key)));
    expect(senzaData).toEqual([]);
  });

  test('i chip vanno dal modello piu recente al piu vecchio', async ({ page }) => {
    for (const [carta, brand] of [['#brand-card-dji', 'dji'], ['#brand-card-gopro', 'gopro'], ['#brand-card-insta', 'insta360']]) {
      await page.click(carta);
      const date = await page.evaluate(b => [...document.querySelectorAll('#model-chips-container .btn-chip')]
        .map(c => cameraModelsData[b][c.dataset.value].released), brand);
      expect(date.length).toBeGreaterThan(1);
      expect([...date].sort().reverse()).toEqual(date);
    }
  });

  test('il modello predefinito di un brand e il suo piu recente', async ({ page }) => {
    for (const [carta, brand] of [['#brand-card-gopro', 'gopro'], ['#brand-card-insta', 'insta360'], ['#brand-card-dji', 'dji']]) {
      await page.click(carta);
      const atteso = await page.evaluate(b => {
        const models = cameraModelsData[b];
        return Object.keys(models).sort((x, y) => models[y].released.localeCompare(models[x].released))[0];
      }, brand);
      expect(await page.evaluate(() => currentModelKey)).toBe(atteso);
    }
  });

  test('all avvio e selezionata la camera piu recente, non una fissa', async ({ page }) => {
    await expect(page.locator('#model-indicator')).toHaveText('Action 6');
    await expect(page.locator('#model-chips-container .btn-chip').first()).toContainText('Action 6');
  });
});

test.describe('Camera predefinita (stellina)', () => {
  const stella = (page, modello) =>
    page.locator('#model-chips-container .btn-chip', { hasText: modello }).locator('.chip-star');

  test('la stellina segna la camera e lo conferma', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await expect(page.locator('#toast')).toContainText('HERO 11 Black è ora la camera predefinita');
    await expect(stella(page, 'HERO 11')).toHaveAttribute('aria-pressed', 'true');
  });

  test('ce ne puo essere una sola', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await stella(page, 'HERO 13').click();
    await expect(page.locator('.chip-star[aria-pressed="true"]')).toHaveCount(1);
    await expect(stella(page, 'HERO 13')).toHaveAttribute('aria-pressed', 'true');
  });

  test('toccarla di nuovo la toglie', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await stella(page, 'HERO 11').click();
    await expect(page.locator('#toast')).toContainText('Camera predefinita rimossa');
    await expect(page.locator('.chip-star[aria-pressed="true"]')).toHaveCount(0);
  });

  test('segnare una camera non la seleziona', async ({ page }) => {
    // La stellina dice "questa e' la mia", non "mostrami questa": sono due
    // gesti diversi e il click non deve scavalcare la selezione in corso.
    await page.click('#brand-card-gopro');
    const prima = await page.evaluate(() => currentModelKey);
    await stella(page, 'HERO 11').click();
    expect(await page.evaluate(() => currentModelKey)).toBe(prima);
  });

  test('l app si riapre sulla camera con la stellina', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await page.reload();
    await expect(page.locator('#model-indicator')).toHaveText('HERO 11 Black');
    expect(await page.evaluate(() => currentBrand)).toBe('gopro');
  });

  test('tornando al suo marchio ritrova quella con la stellina', async ({ page }) => {
    // Senza stellina il marchio proporrebbe la piu' recente, cioe' la
    // MISSION 1 Pro: la scelta esplicita deve battere la regola automatica.
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await page.click('#brand-card-dji');
    await page.click('#brand-card-gopro');
    expect(await page.evaluate(() => currentModelKey)).toBe('hero11');
  });

  test('sugli altri marchi resta valida la piu recente', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    await page.click('#brand-card-dji');
    expect(await page.evaluate(() => currentModelKey)).toBe('action6');
  });

  test('un link condiviso vince sulla stellina', async ({ page }) => {
    // Chi manda un link vuole far vedere il proprio setup, non il tuo.
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').click();
    const link = await page.evaluate(() => {
      currentBrand = 'insta360'; currentModelKey = 'x4';
      return buildShareUrl();
    });
    await page.goto(link);
    await page.reload();
    expect(await page.evaluate(() => currentBrand + '/' + currentModelKey)).toBe('insta360/x4');
  });

  test('si attiva anche da tastiera', async ({ page }) => {
    await page.click('#brand-card-gopro');
    await stella(page, 'HERO 11').focus();
    await page.keyboard.press('Enter');
    await expect(stella(page, 'HERO 11')).toHaveAttribute('aria-pressed', 'true');
  });

  test('una camera che non esiste piu non blocca l avvio', async ({ page }) => {
    // I cataloghi cambiano fra due versioni dell'app.
    await page.evaluate(() => localStorage.setItem('camstudio_default_camera',
      JSON.stringify({ brand: 'nikon', key: 'inesistente' })));
    await page.reload();
    await expect(page.locator('#model-chips-container .btn-chip')).not.toHaveCount(0);
    expect(await page.evaluate(() => starredCamera)).toBeNull();
  });
});

test.describe('Attacco, condivisione nativa e installazione', () => {
  test('l attacco segue il modello e vale anche in foto', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await expect(page.locator('#rigging-mount')).toContainText('Sgancio Mag. v2');

    await page.locator('#tab-wizard').click();
    await page.click('#brand-card-gopro');
    await page.click('[data-action="setMode"][data-value="foto"]');
    await page.locator('#tab-calc').click();
    await expect(page.locator('#rigging-mount')).toContainText('Linguette + Filetto 1/4"');
  });

  test('i bottoni progressivi compaiono solo se l API esiste', async ({ page }) => {
    // Non si promette una funzione che il browser non ha.
    const atteso = await page.evaluate(() => !!navigator.share);
    expect(await page.locator('#btn-share').isVisible()).toBe(atteso);
    // beforeinstallprompt non scatta senza i criteri di engagement.
    await expect(page.locator('#btn-install')).toBeHidden();
  });
});

test.describe('Shortcut del manifest', () => {
  test('il manifest dichiara una scorciatoia per ogni scheda', async ({ page }) => {
    const manifest = await page.evaluate(async () => (await fetch('./manifest.json')).json());
    expect(manifest.shortcuts.map(s => s.url)).toEqual([
      './index.html#tab=wizard', './index.html#tab=calc',
      './index.html#tab=editing', './index.html#tab=guide'
    ]);
  });

  test('aprire uno shortcut porta sulla scheda giusta', async ({ page }) => {
    await page.goto('/index.html#tab=guide');
    await page.reload();
    await expect(page.locator('.tab-btn.active')).toHaveAttribute('data-value', 'guide');
  });

  test('una scheda inesistente non svuota la pagina', async ({ page }) => {
    // switchTab senza convalida spegnerebbe tutti i pannelli.
    await page.goto('/index.html#tab=inesistente');
    await page.reload();
    await expect(page.locator('.tab-btn.active')).toHaveAttribute('data-value', 'wizard');
    await expect(page.locator('.panel:not([hidden])')).toHaveCount(1);
  });

  test('uno shortcut aperto con l app gia viva cambia scheda lo stesso', async ({ page }) => {
    // Il browser non ricarica se cambia solo l'hash: serve hashchange.
    await page.evaluate(() => { location.hash = 'tab=calc'; });
    await expect(page.locator('.tab-btn.active')).toHaveAttribute('data-value', 'calc');
  });
});

test.describe('Piè di pagina', () => {
  test('il profilo Instagram e raggiungibile e si apre in sicurezza', async ({ page }) => {
    const link = page.locator('.app-footer a');
    await expect(link).toHaveAttribute('href', 'https://www.instagram.com/shakemymids__');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toContainText('@shakemymids__');
  });
});

test.describe('Lingua inglese', () => {
  // navigator.language decide la lingua iniziale: qui si simula un browser
  // non italiano, che deve ricevere l'inglese.
  test.use({ locale: 'en-US' });

  test('un browser non italiano vede l app in inglese', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#container-saved-presets')).toContainText('No presets saved locally');
    await expect(page.locator('[data-action="copySettings"]')).toHaveText('📋 Copy settings');
    await expect(page.locator('#val-wb')).toHaveText('Manual 5500K');
  });

  test('l handle Instagram non si traduce, l etichetta si', async ({ page }) => {
    // @shakemymids__ e' un nome proprio, come RockSteady o D-Log M.
    await expect(page.locator('.app-footer')).toContainText('Made by');
    await expect(page.locator('.app-footer a')).toContainText('@shakemymids__');
  });

  test('il confronto camere e il limite di ripresa parlano inglese', async ({ page }) => {
    await page.locator('#tab-calc').click();
    await expect(page.locator('#compare-reason')).toContainText('Ranked by bitrate');
    await expect(page.locator('#limit-verdict')).toHaveText('Card space');
    await expect(page.locator('#rigging-mount')).toContainText('Camera mount');
  });

  test('i termini tecnici dei costruttori restano invariati', async ({ page }) => {
    // Sono le voci che l'utente legge nel menu della propria camera:
    // tradurle renderebbe il consiglio piu' difficile da seguire.
    await expect(page.locator('#val-stab')).toHaveText('RockSteady');
    await expect(page.locator('#val-nd')).toHaveText('ND64 / ND128');
    await expect(page.locator('#val-color')).toContainText('D-Log M');

    await page.click('#brand-card-gopro');
    await expect(page.locator('#val-stab')).toContainText('HyperSmooth');
  });

  test('il selettore riporta in italiano e la scelta persiste', async ({ page }) => {
    await expect(page.locator('#lang-label')).toHaveText('IT');
    await page.locator('#lang-switch').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page.locator('#lang-label')).toHaveText('EN');
    await expect(page.locator('#container-saved-presets')).toContainText('Nessun preset salvato');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  });

  test('il testo tradotto segue il ricalcolo dei risultati', async ({ page }) => {
    // Selettore per data-action: l'etichetta visibile qui e' in inglese.
    await page.locator('[data-action="setMode"][data-value="foto"]').click();
    await page.locator('[data-action="toggleScenario"][data-value="sport"]').click();
    await expect(page.locator('#rigging-text')).toContainText('Sport stills');
    await expect(page.locator('#val-color')).toHaveText('RAW format (.DNG)');
  });

  test('il link condiviso porta con se la lingua', async ({ page }) => {
    await page.locator('[data-action="copyShareLink"]').click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toContain('lang=en');
  });
});

test.describe('Lingua nel link condiviso', () => {
  test('un link con lang=en apre in inglese anche da browser italiano', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/index.html#b=dji&m=action5pro&mode=video&s=reel&l=sole&r=pal&sub=fuori&bp=high&lang=en`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#container-saved-presets')).toContainText('No presets saved locally');
  });

  test('senza parametro lang resta la lingua del browser', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/index.html#b=gopro&m=hero13&s=sport&lang=it`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    await expect(page.locator('#model-indicator')).toHaveText('HERO 13 Black');
  });
});

test.describe('Simulatore e obiettivi di editing', () => {
  // Prima il simulatore ignorava del tutto i chip di editing: era decorativo.
  // Porta la selezione esattamente sugli obiettivi indicati. Va prima
  // aggiunto e poi rimosso: l'app impone che almeno uno resti attivo.
  async function onlyGoal(page, wanted) {
    await page.locator('#tab-editing').click();
    const active = await page.evaluate(() =>
      [...document.querySelectorAll('[data-action="toggleEditGoal"][aria-pressed="true"]')].map(e => e.dataset.value));
    for (const g of wanted) {
      const btn = page.locator(`[data-action="toggleEditGoal"][data-value="${g}"]`);
      if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    }
    for (const g of active) {
      if (wanted.includes(g)) continue;
      const btn = page.locator(`[data-action="toggleEditGoal"][data-value="${g}"]`);
      if ((await btn.getAttribute('aria-pressed')) === 'true') await btn.click();
    }
  }

  test('cambiare obiettivo cambia davvero il simulatore', async ({ page }) => {
    await page.locator('#tab-editing').click();
    const before = await page.locator('.sim-inner-graded').evaluate(el => el.style.filter);

    await onlyGoal(page, ['underwater_color']);
    const after = await page.locator('.sim-inner-graded').evaluate(el => el.style.filter);
    expect(after).not.toBe(before);
  });

  test('il montaggio verticale mostra il ritaglio 9:16', async ({ page }) => {
    await onlyGoal(page, ['reel_fast']);
    await expect(page.locator('#sim-crop-guide')).toHaveClass(/visible/);
    await expect(page.locator('#sim-fx-graded')).toContainText('9:16');
    await expect(page.locator('#sim-fx-flat')).toContainText('16:9');

    await onlyGoal(page, ['dlog_lut']);
    await expect(page.locator('#sim-crop-guide')).not.toHaveClass(/visible/);
  });

  test('lo speed ramp congela il soggetto solo sul lato elaborato', async ({ page }) => {
    await onlyGoal(page, ['speed_ramp']);
    const blur = await page.evaluate(() => ({
      flat: document.querySelector('.sim-layer-flat').style.getPropertyValue('--subject-blur'),
      grad: document.querySelector('.sim-inner-graded').style.getPropertyValue('--subject-blur')
    }));
    expect(parseFloat(blur.flat)).toBeGreaterThan(0);
    expect(parseFloat(blur.grad)).toBe(0);
    await expect(page.locator('#sim-fx-graded')).toContainText('0.25x');
  });

  test('audio e vento mostrano i due livelli a confronto', async ({ page }) => {
    await onlyGoal(page, ['audio_clean']);
    await expect(page.locator('#sim-fx-graded .sim-meter-clean')).toHaveCount(1);
    await expect(page.locator('#sim-fx-flat .sim-meter-dirty')).toHaveCount(1);
    await expect(page.locator('#sim-fx-graded')).toContainText('Low-cut');
  });

  test('il colore subacqueo agisce anche senza scenario in immersione', async ({ page }) => {
    // La dominante non dipende dal selettore "Sott'Acqua" della scheda 1.
    await onlyGoal(page, ['underwater_color']);
    const filter = await page.locator('.sim-layer-flat').evaluate(el => el.style.filter);
    expect(filter).toContain('hue-rotate(140deg)');
    await expect(page.locator('#sim-tag-graded-text')).toHaveText('AQUA RESTORE');
  });

  test('la didascalia dice cosa si sta confrontando', async ({ page }) => {
    await onlyGoal(page, ['dlog_lut']);
    await expect(page.locator('#sim-sub-right')).toContainText('grading');

    await onlyGoal(page, ['speed_ramp']);
    await expect(page.locator('#sim-sub-right')).toContainText('speed ramp');

    await expect(page.locator('#sim-sub-left')).toContainText('camera');
  });
});

test.describe('Coerenza visiva', () => {
  test('radio e chip selezionati usano lo stesso colore', async ({ page }) => {
    // Prima i radio erano cyan e i chip teal: due colori per lo stesso
    // significato, affiancati nella stessa scheda.
    const chip = await page.locator('.btn-chip.selected').first()
      .evaluate(el => getComputedStyle(el).backgroundColor);
    await expect(page.locator('.btn-radio.active').first()).toHaveCSS('background-color', chip);
  });

  test('il testo sopra il colore del brand resta leggibile', async ({ page }) => {
    // Il giallo Insta360 col bianco dava 1.92:1; ora l'inchiostro segue il brand.
    const read = () => document.documentElement.style.getPropertyValue('--brand-ink').trim();

    await page.click('#brand-card-insta');
    expect(await page.evaluate(read)).toBe('#0f172a');

    await page.click('#brand-card-gopro');
    expect(await page.evaluate(read)).toBe('#ffffff');

    await page.click('#brand-card-dji');
    expect(await page.evaluate(read)).toBe('#0f172a');
  });

  test('il colore del brand raggiunge tutti i controlli selezionati', async ({ page }) => {
    await page.click('#brand-card-gopro');
    // toHaveCSS riprova finché la transizione di 0.3s non è conclusa.
    await expect(page.locator('.btn-radio.active').first())
      .toHaveCSS('background-color', 'rgb(37, 99, 235)');
  });

  test('su desktop la navigazione sta sopra il contenuto', async ({ page }) => {
    // Era sticky ma ultima nel DOM, quindi finiva in fondo alla pagina.
    await page.setViewportSize({ width: 1280, height: 900 });
    const nav = await page.locator('.tab-nav').boundingBox();
    const container = await page.locator('.container').boundingBox();
    expect(nav.y).toBeLessThan(container.y);
  });

  test('su mobile la navigazione resta ancorata in basso', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const pos = await page.evaluate(() => {
      const nav = document.querySelector('.tab-nav');
      return { position: getComputedStyle(nav).position, bottom: nav.getBoundingClientRect().bottom };
    });
    expect(pos.position).toBe('fixed');
    expect(pos.bottom).toBeCloseTo(844, -1);
  });

  test('non restano riferimenti a variabili inesistenti', async () => {
    // Un var(--x) senza dichiarazione non fallisce rumorosamente: l'elemento
    // eredita un colore qualsiasi. È il caso che aveva colpito --teal.
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    // Con un valore di ripiego, var(--x, y) è legittimo anche senza dichiarazione.
    const used = [...html.matchAll(/var\(--([a-z0-9-]+)\s*(,?)/g)]
      .filter(m => m[2] !== ',').map(m => m[1]);
    // Le dichiarazioni possono stare a inizio riga o in blocchi su una riga sola.
    const declared = new Set([...html.matchAll(/--([a-z0-9-]+)\s*:/g)].map(m => m[1]));
    const missing = [...new Set(used)].filter(v => !declared.has(v));
    expect(missing).toEqual([]);
  });
});


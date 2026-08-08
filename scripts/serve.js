#!/usr/bin/env node
// Server statico minimale, senza dipendenze, usato sia per provare l'app in
// locale sia come webServer della suite Playwright.
//
//   node scripts/serve.js [porta]
//
// Serve su http:// e non su file://, condizione necessaria perché il service
// worker possa registrarsi.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8'
};

// Marcatore iniettato su richiesta dei test per simulare un deploy e
// verificare che il service worker serva subito la versione nuova. Va in un
// meta e non nel <title>, che l'app riscrive secondo la lingua scelta.
let deployMarker = '';

// Il browser cerca aggiornamenti confrontando i byte di sw.js. Per provare il
// flusso di aggiornamento serve poterlo cambiare senza toccare il file: questo
// marcatore viene appeso in coda al worker.
let swBump = '';

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/__test/marker') {
    deployMarker = url.searchParams.get('value') || '';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (url.pathname === '/__test/sw-bump') {
    swBump = url.searchParams.get('value') || '';
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = path.join(ROOT, rel);

  // Impedisce di uscire dalla radice del progetto con percorsi tipo ../
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found: ' + rel);
  }

  const ext = path.extname(file);
  let body = fs.readFileSync(file);
  if (ext === '.html' && deployMarker) {
    body = Buffer.from(body.toString('utf8').replace(
      '</head>', `<meta name="x-deploy-marker" content="${deployMarker}"></head>`));
  }
  if (rel.endsWith('sw.js') && swBump) {
    body = Buffer.from(body.toString('utf8') + `\n// versione di prova: ${swBump}\n`);
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    // Niente caching HTTP: in test vogliamo osservare il comportamento del
    // service worker, non quello della cache del browser.
    'Cache-Control': 'no-store'
  });
  res.end(body);
});

server.listen(PORT, () => {
  console.log(`ReadyClickShot in ascolto su http://localhost:${PORT}`);
});


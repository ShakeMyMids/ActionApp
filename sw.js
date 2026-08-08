// ReadyClickShot - Service Worker
// Strategia:
//   - HTML (navigazioni + index.html): NETWORK-FIRST. L'app è un singolo file,
//     quindi la cache-first bloccherebbe l'utente su una versione vecchia per
//     sempre. La cache resta come fallback offline.
//   - Asset statici (icone, manifest): CACHE-FIRST con aggiornamento in background.
// La versione sta qui e non solo in index.html per una ragione pratica: il
// browser cerca aggiornamenti confrontando i byte di questo file. Se cambiasse
// solo index.html, sw.js resterebbe identico e l'aggiornamento non verrebbe
// mai annunciato. Legandola alla versione del pacchetto, ogni rilascio muove
// questo file e l'app se ne accorge.
const APP_VERSION = '13.4.0';
const CACHE_NAME = `readyclickshot-v${APP_VERSION}-cache`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll fallisce in blocco se una sola richiesta va male: aggiungiamo
      // le risorse una a una così l'install non salta per un asset opzionale.
      .then(cache => Promise.all(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      ))
  );
  // Niente skipWaiting automatico: la versione nuova resta in attesa e l'app
  // mostra il pulsante di aggiornamento. Sostituire il worker sotto i piedi
  // dell'utente vorrebbe dire ricaricare la pagina mentre sta leggendo le
  // impostazioni davanti alla camera.
});

// L'app chiede di passare alla versione nuova quando l'utente lo decide.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  return new URL(request.url).pathname.endsWith('.html');
}

// Rete per prima, con la copia in cache come rete di sicurezza offline.
function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request)
      .then(cached => cached || caches.match('./index.html')));
}

// Cache per prima, ma rinfresca in background per la visita successiva.
function cacheFirst(request) {
  return caches.match(request).then(cached => {
    const network = fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => cached);
    return cached || network;
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(isHtmlRequest(request) ? networkFirst(request) : cacheFirst(request));
});

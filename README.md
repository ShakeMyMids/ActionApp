# Action Cam Studio

[![Test](https://github.com/ShakeMyMids/ActionApp/actions/workflows/test.yml/badge.svg)](https://github.com/ShakeMyMids/ActionApp/actions/workflows/test.yml)

PWA bilingue (italiano/inglese) che calcola le impostazioni di ripresa
consigliate per action cam **DJI Osmo**, **GoPro HERO** e **Insta360**, partendo
dallo scenario reale invece che da una tabella di preset fissi.

Scegli camera, modalità (video / foto / timelapse), situazioni di ripresa, luce e
profilo energetico: l'app calcola risoluzione, framerate, otturatore, filtro ND,
FOV, profilo colore, stabilizzazione, ISO, bilanciamento del bianco, consumo di
memoria e suggerimenti di rigging.

## Cosa la distingue

**Gestione esplicita dei conflitti.** Alcune combinazioni sono in contraddizione:
girare di notte chiede framerate bassi per raccogliere luce, girare sport ne
chiede di alti per congelare l'azione. L'app non sceglie di nascosto — mostra il
conflitto e ti fa decidere la priorità, poi ricalcola tutto di conseguenza.

**Simulatore visivo.** Un confronto a tendina fra immagine LOG e immagine gradata,
che riflette le impostazioni correnti: il rumore cresce alzando gli ISO, il motion
blur compare quando otturatore e movimento lo giustificano.

**Preset locali.** Salvi una configurazione ricorrente e la richiami con un tocco.
Restano nel browser, non lasciano il dispositivo — e puoi esportarli in JSON per
riportarli su un altro telefono.

**Setup condivisibile.** «Copia link setup» produce un URL che contiene l'intera
configurazione: chi lo apre vede esattamente le tue impostazioni. «Copia
impostazioni» genera invece un riepilogo testuale da incollare nelle note, comodo
da consultare davanti alla camera.

## Struttura

```
index.html          l'app: markup, stili e logica in un solo file
sw.js               service worker (network-first sull'HTML, cache-first sugli asset)
manifest.json       manifest PWA
icons/              icone 192 e 512, incluse le varianti maskable
scripts/serve.js    server statico senza dipendenze, per lo sviluppo e i test
tests/              suite Playwright
.github/workflows/  CI: la suite gira a ogni push e su ogni pull request
```

Nessun framework, nessun passo di build: `index.html` è direttamente ciò che gira.

## Avvio in locale

```bash
npm start
```

poi apri http://localhost:8080.

Serve un server HTTP: aprendo il file con doppio clic (`file://`) il service worker
non si registra e la modalità offline non è verificabile. `npm start` non richiede
alcuna dipendenza — è Node puro.

## Test

```bash
npm install
npx playwright install chromium    # solo la prima volta
npm test
```

43 test end-to-end, eseguiti su due profili — desktop e mobile (Pixel 7) — per un
totale di 86 esecuzioni. Coprono inizializzazione, motore di calcolo, escaping e
persistenza dei preset, export/import, condivisione via link, accessibilità
(semantica tab, `aria-pressed`, tastiera), safe area del notch, autonomia della
batteria, traduzioni e scelta della lingua dal browser, comportamento PWA e
service worker (aggiornamento dopo un deploy e fallback offline).

Per eseguire un solo profilo:

```bash
npx playwright test --project=mobile
```

Se hai già un Chromium sul sistema e vuoi evitarne il download:

```bash
PW_CHROMIUM_PATH=/percorso/di/chrome npm test
```

## Deploy

Il sito è servito da GitHub Pages sul branch `main`: ogni push ricostruisce e
pubblica, senza altri passaggi.

Il service worker usa una strategia **network-first sull'HTML**, quindi gli
aggiornamenti arrivano al primo caricamento utile invece di restare bloccati
dietro la cache. Gli asset statici usano cache-first con aggiornamento in
background. Cambiando `CACHE_NAME` in `sw.js` si forza lo svuotamento delle
cache vecchie.

## Lingue

L'interfaccia è disponibile in **italiano e inglese**. La lingua iniziale viene
scelta da `navigator.language`: italiano per chi naviga in italiano, inglese per
tutti gli altri. Il pulsante `IT`/`EN` nell'intestazione la cambia, e la scelta
viene ricordata. Anche il link condiviso porta con sé la lingua (`&lang=en`),
così chi lo riceve vede l'app come la vedevi tu.

La chiave di traduzione **è il testo italiano stesso**:

```js
t('<b>🚴 Corsa / Bici:</b> Supporto a pettorina o out-front mount. Fissa saldamente.')
```

Nel markup vale lo stesso, tramite attributi marcatori:

```html
<span data-i18n>Luce Ambientale</span>
<div class="ref-details" data-i18n-html><b>Setting:</b> …</div>
<input data-i18n-placeholder="Salva setup (es. Corsa Luce)...">
```

Ne discendono tre proprietà utili: l'italiano resta leggibile nel sorgente senza
dizionario, non ci sono identificatori da inventare, e una voce mancante mostra
l'italiano invece di una chiave grezza.

**Cosa non va tradotto**: i nomi commerciali e le voci di menu delle camere —
`RockSteady`, `HyperSmooth`, `FlowState`, `D-Log M`, `ND64`. Sono esattamente ciò
che l'utente legge sul proprio dispositivo: tradurli renderebbe il consiglio più
difficile da seguire, non più chiaro. C'è un test che lo verifica.

**Per aggiungere una lingua**: duplica l'oggetto `EN` in `index.html`,
traducine i valori e aggiungi il codice a `SUPPORTED_LANGS`. Le chiavi restano
le stesse.

## Accessibilità

I controlli sono `<button>` veri, raggiungibili da tastiera, con `aria-pressed`
allineato alla selezione; le schede espongono la semantica `tab`/`tabpanel`; i
tooltip si aprono con tap, mouse o tastiera e si chiudono con `Esc`. Lo zoom a
pizzico non è bloccato. Il layout rispetta le safe area, quindi in standalone
sul telefono nulla finisce sotto il notch o la home indicator.

## Compatibilità

Browser moderni con supporto a service worker e `localStorage`. Se `localStorage`
non è disponibile (per esempio in navigazione privata su Safari) l'app continua a
funzionare, perdendo solo la persistenza di tema e preset. La copia negli appunti
usa `navigator.clipboard` dove disponibile, con ripiego su `execCommand`.

## Licenza

[MIT](LICENSE).

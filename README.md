# ReadyClickShot

[![Test](https://github.com/ShakeMyMids/ActionApp/actions/workflows/test.yml/badge.svg)](https://github.com/ShakeMyMids/ActionApp/actions/workflows/test.yml)

PWA bilingue (italiano/inglese) che calcola le impostazioni di ripresa
consigliate per action cam **DJI Osmo**, **GoPro** e **Insta360**, partendo
dallo scenario reale invece che da una tabella di preset fissi.

Il catalogo copre **15 modelli**: Osmo Action 6, 5 Pro, 4, 3 e Osmo Nano per DJI;
HERO 13, 12, 11 e 10/9 Black, MISSION 1 Pro e MAX2 per GoPro; Ace Pro 2, X5, X4 e
GO Ultra per Insta360.

Scegli camera, modalità (video / foto / timelapse), situazioni di ripresa, luce e
profilo energetico: l'app calcola risoluzione, framerate, otturatore, filtro ND,
FOV, profilo colore, stabilizzazione, ISO, bilanciamento del bianco, consumo di
memoria e suggerimenti di rigging.

## Cosa la distingue

**Gestione esplicita dei conflitti.** Alcune combinazioni sono in contraddizione:
girare di notte chiede framerate bassi per raccogliere luce, girare sport ne
chiede di alti per congelare l'azione. L'app non sceglie di nascosto — mostra il
conflitto e ti fa decidere la priorità, poi ricalcola tutto di conseguenza.

**Simulatore visivo.** Un confronto a tendina fra ciò che esce dalla camera e il
risultato dopo l’editing. Riflette sia le condizioni di ripresa — il rumore cresce
alzando gli ISO, il motion blur compare quando otturatore e movimento lo
giustificano — sia gli obiettivi di post-produzione scelti: il montaggio verticale
mostra quanto resta davvero dell’inquadratura in 9:16, lo speed ramp congela il
soggetto sul lato elaborato, il colore subacqueo applica e poi corregge la
dominante, il trattamento audio confronta i livelli con e senza vento.

**La tua camera.** La stellina sul modello lo segna come predefinito: l'app si
apre su quello, e tornando al suo marchio ritrova quello invece del più recente.
Serve perché la camera più nuova non è quella che possiedi — il catalogo si
aggiorna, la tua attrezzatura no. Un link condiviso continua però a vincere sulla
stellina: chi te lo manda vuole farti vedere il suo setup, non il tuo.

**Preset locali.** Salvi una configurazione ricorrente e la richiami con un tocco.
Restano nel browser, non lasciano il dispositivo — e puoi esportarli in JSON per
riportarli su un altro telefono.

**Quanto giri davvero.** L'app sa quanto dura la batteria e quanti GB al minuto
consuma il setup scelto, ma sono due numeri che da soli non rispondono alla
domanda vera: *mi ferma prima la scheda o la batteria?* Scegliendo la capacità
della MicroSD il confronto diventa esplicito, e cambia sotto gli occhi quando
alzi gli fps o passi al profilo Endurance. L'autonomia dichiarata è a 1080p/30,
e l'app lo dice invece di far finta che i due numeri siano confrontabili alla pari.

**Quale camera porto.** Chi possiede più di una action cam non deve scegliere le
impostazioni, deve scegliere la camera. Il confronto ordina tutti i modelli sul
criterio che conta per la ripresa in corso — profondità sott'acqua, autonomia in
viaggio, bitrate con poca luce — e dichiara perché sono in quell'ordine. Si
ordina solo su dati numerici inequivocabili: una classifica costruita sulla
risoluzione massima sembrerebbe precisa senza esserlo, perché «8K a 30 fps» non è
peggio di «4K a 120 fps», dipende da cosa stai girando.

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

## I dati delle camere

Risoluzione massima, profilo colore, profondità senza custodia e risoluzione foto
sono le specifiche dichiarate dai costruttori. `bitrate` e `batteryMin` sono invece
**stime su scala interna**: l'autonomia dichiarata è misurata in modalità endurance
a 24 fps e non è quello che ottieni sul campo, quindi vale circa il 60% del valore
ufficiale, e il bitrate è quello in alta qualità del modo di punta, non il picco
raggiungibile con firmware modificati.

Che la scala resti la stessa conta più del singolo numero, perché il confronto fra
camere ordina proprio su quei campi: mescolare un dato di marketing con una stima
prudente produrrebbe una classifica falsata. Aggiungendo un modello, segui la
convenzione documentata sopra `cameraModelsData`.

L'elenco dei modelli è ordinato **dal più recente al più vecchio**, e il primo di
ogni marchio è quello proposto all'avvio, salvo che tu abbia scelto la tua. L'ordine non dipende però da come i
modelli sono scritti nel sorgente: viene dal campo `released` (`AAAA-MM`), che
ogni voce deve avere. Così aggiungerne uno non richiede di infilarlo nel punto
giusto — basta la data, e l'elenco si risistema da solo. C'è un test che fallisce
se una voce resta senza.

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
npm ci
npx playwright install chromium    # solo la prima volta
npm test
```

110 test end-to-end, eseguiti su due profili — desktop e mobile (Pixel 7) — per un
totale di 220 esecuzioni. Coprono inizializzazione, motore di calcolo, escaping e
persistenza dei preset, export/import (compresi i file con valori fuori dominio),
limite di ripresa, confronto fra camere, condivisione via link, accessibilità
(semantica tab, `aria-pressed`, tastiera), safe area del notch, autonomia della
batteria, reattività del simulatore agli obiettivi di editing, traduzioni e scelta
della lingua dal browser, comportamento PWA, shortcut del manifest e service
worker (aggiornamento dopo un deploy e fallback offline).

Il `package-lock.json` è versionato e la CI installa con `npm ci`, così una nuova
release di Playwright non entra da sola in un'esecuzione.

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
background.

La versione sta in `sw.js` oltre che in `package.json` e in `index.html`, e i tre
valori devono coincidere — c'è un test che lo verifica. Non è una ripetizione
inutile: il browser cerca aggiornamenti confrontando i byte di `sw.js`, quindi se
cambiasse solo `index.html` l'aggiornamento non verrebbe mai annunciato. Il nome
della cache deriva dalla versione, così ogni rilascio svuota da sé le cache
vecchie.

Il worker nuovo **non prende il posto da solo**: resta in attesa e l'app mostra
il pulsante «Aggiorna». Sostituirlo sotto i piedi dell'utente vorrebbe dire
ricaricare la pagina mentre sta leggendo le impostazioni davanti alla camera.

**Rilasciando una versione** aggiorna i tre numeri e aggiungi una voce a
`CHANGELOG` in `index.html`: è quello che l'utente vede aprendo le novità, e un
test fallisce se la prima voce non è la versione in corso.

## Installazione e aggiornamenti

Il pulsante **Installa** nell'intestazione compare solo quando c'è davvero
qualcosa da installare: non ad app già installata, e non dove il browser non lo
permette. Su Chrome, Edge e Android usa `beforeinstallprompt` e installa in un
tocco; su Safari per iPhone quell'evento non esiste e l'installazione resta un
gesto manuale, quindi lì il pulsante apre le istruzioni invece di fingere di
fare qualcosa.

Quando un rilascio è pronto compare **Aggiorna**. Toccandolo il worker in attesa
prende il posto del vecchio e la pagina si ricarica; subito dopo si apre
l'elenco delle novità, che vive in `CHANGELOG` dentro `index.html` per restare
leggibile anche offline. Le novità si mostrano solo a chi arriva da una versione
precedente: alla prima visita non è cambiato niente.

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

## Colore

Un solo colore indica «selezionato»: quello del brand attivo, che cambia con la
camera scelta (teal DJI, blu GoPro, giallo Insta360). Le intestazioni di sezione
sono neutre, così l’accento resta riservato a ciò che è interattivo. Gli altri
colori hanno un significato preciso e non decorativo: indigo per i preset, ambra
per la batteria, verde per un esito positivo, rosso per un avviso, cyan per
l’acqua.

Il testo sopra il colore del brand usa `--brand-ink`, scelto sul contrasto
misurato invece che a occhio: scuro su teal (7,2:1) e su giallo (9,3:1), bianco
su blu GoPro (5,2:1). Col bianco fisso, il giallo Insta360 dava 1,9:1.

## Tipografia

Due famiglie con ruoli distinti. **Space Grotesk** (peso variabile 400–700) porta
il carattere dove si vede — nome dell’app, intestazioni, valori calcolati, numeri
grandi, navigazione — mentre il testo di lettura resta sul font di sistema, più
familiare sulle distanze lunghe.

Il font è **incorporato come data URI** (sottoinsieme latino, 22 KB): l’app deve
restare utilizzabile offline, e un font remoto sparirebbe proprio quando serve, in
mezzo al nulla. È distribuito con SIL Open Font License 1.1.

I valori della matrice usano `font-variant-numeric: tabular-nums`: le cifre hanno
tutte la stessa larghezza, così le colonne non ballano a ogni ricalcolo.

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

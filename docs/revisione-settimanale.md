# Revisione settimanale automatica

Questo documento è il mandato operativo della sessione automatica che gira una
volta a settimana su ReadyClickShot. Ogni esecuzione parte da zero, in un
container nuovo, senza memoria delle sessioni precedenti: quello che c'è scritto
qui è tutto il contesto che l'agente ha. Se cambia il modo di lavorare sul
progetto, va cambiato prima di tutto questo file.

## Cosa deve produrre l'esecuzione

Una PR sola, quando c'è davvero qualcosa da cambiare. Se la settimana non ha
prodotto nulla di concreto — nessun bug, nessuna falla, nessuna miglioria
sensata — la risposta corretta è **non aprire nulla** e dirlo. Una PR vuota a
settimana è rumore che fa perdere fiducia in tutte le altre.

Nessun merge automatico. La PR resta aperta e la decisione è di chi mantiene il
progetto.

## L'ordine di priorità

1. **Falle di sicurezza e perdita di dati.** Input non fidati trattati come
   fidati, stato persistente che si può corrompere da fuori, endpoint del server
   di sviluppo esposti.
2. **Bug che danno risultati sbagliati all'utente.** L'app dice numeri a chi ha
   la camera in mano: un'impostazione incoerente è peggio di un'interfaccia
   brutta.
3. **Dati del catalogo obsoleti.** Modelli nuovi usciti, specifiche cambiate.
4. **Migliorie e funzioni nuove**, solo se motivate da come l'app viene usata
   davvero e non dal desiderio di aggiungere qualcosa.

Le prime tre categorie hanno sempre la precedenza. Se in una settimana c'è un
bug di calcolo e un'idea per una funzione nuova, si sistema il bug e si annota
l'idea nella descrizione della PR, senza implementarla di nascosto insieme.

## Il metodo, che non è negoziabile

**Riprodurre prima di affermare.** Nessun problema viene segnalato perché
"sembra". Si scrive il caso che lo dimostra e lo si esegue. Se non si riesce a
riprodurlo, non è un problema: è un sospetto, e va scritto come tale.

**Ogni test nuovo deve fallire contro il difetto.** Dopo aver scritto la
correzione e il test, si rimette temporaneamente il codice rotto e si verifica
che il test diventi rosso. Un test che passa sia prima che dopo non sta
verificando quello che si crede.

**Mai inventare specifiche di una camera.** Risoluzioni, framerate, profili
colore, durata batteria: si cercano alla fonte. Se il dato non si trova, il
modello non entra nel catalogo. Un dato inventato in un'app di impostazioni è un
danno diretto a chi la usa.

**La suite intera deve passare.** `npx playwright test` su entrambi i progetti
(`chromium` e `mobile`), non solo sui file toccati.

## Convenzioni del progetto

- `index.html` è l'app intera: markup, stile e logica in un file solo. Nessun
  framework, nessuna build. Va tenuto così.
- Commenti e nomi dei test in italiano, come il resto del repository.
- Ogni stringa visibile all'utente aggiunta in italiano ha bisogno della voce
  corrispondente nel dizionario `EN`, e del marcatore giusto (`data-i18n`,
  `data-i18n-html`, `data-i18n-placeholder`, `data-i18n-aria-label`).
- Gli input non fidati sono tre e vanno sempre validati con lista di permessi,
  mai con controllo di verità: hash del link condiviso, JSON dei preset
  importati, `localStorage`. Per leggere una chiave da un oggetto si usa
  `hasOwn()`, non `obj[k]`, altrimenti `constructor` e `toString` passano.
- Se cambia la versione, si allineano `package.json`, `sw.js` (`APP_VERSION`) e
  `index.html`, e si aggiunge la voce nel `CHANGELOG` dentro `index.html`. La
  versione in `sw.js` non è decorativa: è ciò che fa accorgere il browser che
  c'è un aggiornamento.
- **Qualunque modifica al blocco di script inline di `index.html` richiede
  `npm run csp`.** La Content-Security-Policy dichiara l'hash di quello script:
  se l'hash resta indietro, il browser rifiuta di eseguire l'app intera. In
  locale la suite se ne accorge, in produzione sarebbe una pagina bianca.
- Se cambia il marchio nell'intestazione, si rigenerano le icone con
  `npm run icone`. Le due copie del disegno devono restare identiche, e c'è un
  test che lo verifica.

## Prima si consegna, poi si racconta

L'ordine non è negoziabile, ed è nato da un fallimento reale: una revisione ha
prodotto quattro correzioni valide, ha scritto una bella descrizione della pull
request, e non ha mai spinto il branch. Il container è stato riciclato e il
lavoro è sparito. La descrizione, da sola, non è il lavoro.

Quindi, appena i test passano e prima di scrivere una sola riga di descrizione:

```bash
git push -u origin claude/revisione-settimanale
git ls-remote --heads origin claude/revisione-settimanale   # deve stampare il branch
```

Se la seconda riga non stampa nulla, la spinta non è avvenuta: risolvi quello
prima di fare altro. Nessun documento, nessun artefatto, nessun riepilogo vale
finché il codice non è su GitHub — è l'unica cosa che sopravvive alla fine della
sessione.

## Cosa raccontare nella PR

La descrizione serve a chi legge fra sei mesi, non a chi ha appena scritto il
codice. Per ogni voce: cosa non andava, come lo si è dimostrato, cosa si è
cambiato. Se una cosa è stata guardata e lasciata com'era, vale la pena dirlo —
"controllato, va bene" evita che venga ricontrollata la settimana dopo.

Le idee non implementate vanno in fondo, separate, come proposte da approvare.

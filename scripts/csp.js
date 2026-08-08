// Ricalcola l'hash della Content-Security-Policy in index.html.
//
//   npm run csp            riscrive l'hash nel <meta>
//   npm run csp -- --check esce con 1 se l'hash non corrisponde (usato dal test)
//
// L'app è un file solo con tutta la logica in un <script> inline. Per non
// scrivere 'unsafe-inline' in script-src — che vanificherebbe metà della CSP,
// perché lascerebbe passare anche gli handler inline iniettati — la policy
// dichiara l'hash SHA-256 di quel blocco. Il prezzo è che l'hash va rigenerato
// a ogni modifica dello script, e senza rete di sicurezza sarebbe una trappola:
// l'app smetterebbe di funzionare in modo silenzioso, ma solo in produzione.
// Da qui il --check nella suite.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', 'index.html');
const TAG_CSP = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(">)/;
const HASH_NELLA_POLICY = /'sha256-[^']*'/;

// Un commento HTML che nomina il tag di apertura verrebbe scambiato per il tag
// vero. Qui il contenuto dei commenti diventa spazi — stessa lunghezza, così le
// posizioni restano valide — e la ricerca avviene sulla copia ripulita, mentre
// il testo da sottoporre a hash si ritaglia dall'originale.
function senzaCommenti(html) {
  return html.replace(/<!--[\s\S]*?-->/g, commento =>
    commento.replace(/[^\n]/g, ' '));
}

// Il browser calcola l'hash sul testo esatto fra i due tag, byte per byte.
function scriptInline(html) {
  const ripulito = senzaCommenti(html);
  const blocchi = [...ripulito.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  if (blocchi.length !== 1) {
    throw new Error(
      `Atteso 1 blocco di script inline, trovati ${blocchi.length}. ` +
      'Con più blocchi servono più hash: aggiorna questo script prima di dividere il codice.'
    );
  }
  const inizio = blocchi[0].index + blocchi[0][0].indexOf('>') + 1;
  return html.slice(inizio, inizio + blocchi[0][1].length);
}

function hashAtteso(html) {
  const digest = crypto.createHash('sha256').update(scriptInline(html), 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

function policyCorrente(html) {
  const trovato = html.match(TAG_CSP);
  if (!trovato) throw new Error('Nessun <meta http-equiv="Content-Security-Policy"> in index.html.');
  return trovato[2];
}

function main() {
  const soloControllo = process.argv.includes('--check');
  const html = fs.readFileSync(FILE, 'utf8');
  const atteso = hashAtteso(html);
  const policy = policyCorrente(html);

  if (!HASH_NELLA_POLICY.test(policy)) {
    throw new Error("La direttiva script-src non contiene un token 'sha256-...' da aggiornare.");
  }

  if (policy.includes(atteso)) {
    console.log(`CSP allineata: ${atteso}`);
    return;
  }

  if (soloControllo) {
    console.error(`CSP disallineata.\n  nel file: ${policy.match(HASH_NELLA_POLICY)[0]}\n  atteso:   ${atteso}\n  esegui:   npm run csp`);
    process.exit(1);
  }

  const aggiornato = html.replace(TAG_CSP, (_, apertura, valore, chiusura) =>
    apertura + valore.replace(HASH_NELLA_POLICY, atteso) + chiusura);
  fs.writeFileSync(FILE, aggiornato);
  console.log(`CSP aggiornata: ${atteso}`);
}

// Riusato dai test, che ricalcolano l'hash sullo stesso file servito.
module.exports = { hashAtteso, policyCorrente, scriptInline, FILE };

if (require.main === module) {
  try {
    main();
  } catch (errore) {
    console.error(errore.message);
    process.exit(1);
  }
}

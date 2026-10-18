// Reine Spiellogik – wird vom Browser, vom Prüfskript und von den Tests genutzt.

export const MAX_ZAHL = 500;
export const TIPP_AB = 2;

export function normalisiere(text) {
  return text.normalize('NFC').toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .replace(/[_\-\s/\\]+/g, ' ')
    .trim();
}

export function findeBilder(pfade, suchwoerter) {
  const woerter = suchwoerter.map(normalisiere).filter(Boolean);
  return pfade.filter(p => woerter.some(w => normalisiere(p).includes(w)));
}

// Kleiner Parser statt eval: prüft jede Zahl und jedes Zwischenergebnis.
export function rechne(rechnung) {
  const tokens = String(rechnung).match(/\d+|[+\-*/()]|\S/g) ?? [];
  let i = 0;
  const pruefe = (wert, was) => {
    if (!Number.isInteger(wert)) throw new Error(`${was} geht nicht ohne Rest auf`);
    if (wert < 0) throw new Error(`${was} ist negativ`);
    if (wert > MAX_ZAHL) throw new Error(`${was} ist größer als ${MAX_ZAHL}`);
    return wert;
  };
  const faktor = () => {
    const t = tokens[i++];
    if (t === '(') {
      const wert = ausdruck();
      if (tokens[i++] !== ')') throw new Error('Klammer fehlt');
      return wert;
    }
    if (/^\d+$/.test(t ?? '')) return pruefe(Number(t), `Zahl ${t}`);
    throw new Error(t === undefined ? 'Rechnung unvollständig' : `Unerwartetes Zeichen "${t}"`);
  };
  const term = () => {
    let wert = faktor();
    while (tokens[i] === '*' || tokens[i] === '/') {
      const op = tokens[i++], rechts = faktor();
      wert = pruefe(op === '*' ? wert * rechts : wert / rechts, `${wert} ${op} ${rechts}`);
    }
    return wert;
  };
  const ausdruck = () => {
    let wert = term();
    while (tokens[i] === '+' || tokens[i] === '-') {
      const op = tokens[i++], rechts = term();
      wert = pruefe(op === '+' ? wert + rechts : wert - rechts, `${wert} ${op} ${rechts}`);
    }
    return wert;
  };
  try {
    const wert = ausdruck();
    if (i < tokens.length) throw new Error(`Unerwartetes Zeichen "${tokens[i]}"`);
    return { wert };
  } catch (e) {
    return { fehler: e.message };
  }
}

export function istRichtig(eingabe, loesung) {
  const e = String(eingabe).trim();
  return /^\d+$/.test(e) && Number(e) === loesung;
}

export function punkteFuer(fehlversuche) {
  return fehlversuche < TIPP_AB ? 15 : 10;
}

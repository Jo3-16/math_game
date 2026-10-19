// Reine Spiellogik – wird vom Browser, vom Prüfskript und von den Tests genutzt.

export const MAX_ZAHL = 500;
export const TIPP_AB = 2;

export function normalisiere(text) {
  return text.normalize('NFC').toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .replace(/[_\-\s/\\]+/g, ' ')
    .trim();
}

// Suchwort mit "/" am Ende ("x-wing/") trifft nur Bilder im gleichnamigen Ordner, sonst: Pfad enthält Suchwort.
export function findeBilder(pfade, suchwoerter) {
  const ordner = suchwoerter.filter(w => w.endsWith('/')).map(w => normalisiere(w.slice(0, -1)));
  const woerter = suchwoerter.filter(w => !w.endsWith('/')).map(normalisiere).filter(Boolean);
  return pfade.filter(p => ordner.includes(normalisiere(p.split('/')[0])) && p.includes('/')
    || woerter.some(w => normalisiere(p).includes(w)));
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

// Spielstand: { name, kapitel: { [id]: { geloest, punkte, fertig } }, abzeichen: [id] }
export const STANDARD_NAME = 'C3-Jo';

export function leererStand() {
  return { name: STANDARD_NAME, kapitel: {}, abzeichen: [] };
}

// Setzt den Spielernamen (gekürzt, nie leer); ohne neuen Namen wird nur ein fehlender ergänzt.
export function mitName(stand, neuerName = stand.name) {
  const name = String(neuerName ?? '').trim().slice(0, 20) || STANDARD_NAME;
  return { ...stand, name };
}

export function kapitelStatus(stand, kapitelIds) {
  let offenVergeben = false;
  return kapitelIds.map(id => {
    if (stand.kapitel[id]?.fertig) return 'fertig';
    if (offenVergeben) return 'gesperrt';
    offenVergeben = true;
    return 'offen';
  });
}

export function aufgabeGeloest(stand, kapitelId, anzahlAufgaben, fehlversuche) {
  const neu = structuredClone(stand);
  const k = neu.kapitel[kapitelId] ??= { geloest: 0, punkte: 0, fertig: false };
  k.geloest += 1;
  k.punkte += punkteFuer(fehlversuche);
  if (k.geloest >= anzahlAufgaben) {
    k.fertig = true;
    if (!neu.abzeichen.includes(kapitelId)) neu.abzeichen.push(kapitelId);
  }
  return neu;
}

export function gesamtPunkte(stand) {
  return Object.values(stand.kapitel).reduce((summe, k) => summe + k.punkte, 0);
}

export const BONUS_PUNKTE = 20;

const RAENGE = [
  { name: 'Jüngling', symbol: '🌱', ab: 0 },
  { name: 'Padawan', symbol: '🟢', ab: 150 },
  { name: 'Jedi-Ritter', symbol: '⚔️', ab: 500 },
  { name: 'Jedi-Meister', symbol: '🧙', ab: 1000 },
];

export function rang(punkte) {
  const i = RAENGE.findLastIndex(r => punkte >= r.ab);
  const naechster = RAENGE[i + 1];
  return { name: RAENGE[i].name, symbol: RAENGE[i].symbol, naechster: naechster ? { name: naechster.name, ab: naechster.ab } : null };
}

// 3 Sterne: alles ohne Tipp, 2: mindestens die Hälfte, sonst 1.
export function sterneFuer(ohneTipp, anzahl) {
  if (ohneTipp >= anzahl) return 3;
  return ohneTipp * 2 >= anzahl ? 2 : 1;
}

// Sterne eines fertigen Kapitels: gespeicherte Bestleistung oder aus den Punkten des ersten Durchlaufs.
export function kapitelSterne(k, anzahl) {
  if (!k?.fertig) return 0;
  const punkte = k.punkte - (k.bonus ? BONUS_PUNKTE : 0);
  const ohneTipp = Math.max(0, Math.round((punkte - 10 * anzahl) / 5));
  return Math.max(k.sterne ?? 0, sterneFuer(ohneTipp, anzahl));
}

export function mitSternen(stand, kapitelId, sterne) {
  const neu = structuredClone(stand);
  const k = neu.kapitel[kapitelId];
  k.sterne = Math.max(k.sterne ?? 0, sterne);
  return neu;
}

export function bonusGeloest(stand, kapitelId) {
  const neu = structuredClone(stand);
  const k = neu.kapitel[kapitelId];
  if (!k.bonus) {
    k.bonus = true;
    k.punkte += BONUS_PUNKTE;
  }
  return neu;
}

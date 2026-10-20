// Reine Spiellogik – wird vom Browser, vom Prüfskript und von den Tests genutzt.

export const MAX_ZAHL = 500;
export const MAX_EINHEITEN = 9999; // Einheiten-Aufgaben dürfen größer werden (km ↔ m)
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
export function rechne(rechnung, max = MAX_ZAHL) {
  const tokens = String(rechnung).match(/\d+|[+\-*/()]|\S/g) ?? [];
  let i = 0;
  const pruefe = (wert, was) => {
    if (!Number.isInteger(wert)) throw new Error(`${was} geht nicht ohne Rest auf`);
    if (wert < 0) throw new Error(`${was} ist negativ`);
    if (wert > max) throw new Error(`${was} ist größer als ${max}`);
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

export const RAENGE = [
  { name: 'Jüngling', symbol: '🌱', ab: 0 },
  { name: 'Padawan', symbol: '🟢', ab: 200 },
  { name: 'Jedi-Ritter', symbol: '⚔️', ab: 600 },
  { name: 'Jedi-Meister', symbol: '🧙', ab: 1200 },
  { name: 'Großmeister', symbol: '🌟', ab: 2000 },
];
// Grenzen bis Oktober 2026 – nur für Spielstände ohne gespeicherten Rang, damit niemand absteigt.
const ALTE_GRENZEN = [0, 150, 500, 1000];

const rangIndexFuer = (punkte, grenzen) => grenzen.findLastIndex(ab => punkte >= ab);

// Rang aus Punkten – aber nie unter dem schon erreichten Rang (mindestens = gespeicherter Index).
export function rang(punkte, mindestens = 0) {
  const i = Math.max(rangIndexFuer(punkte, RAENGE.map(r => r.ab)), mindestens);
  const naechster = RAENGE[i + 1];
  return { index: i, name: RAENGE[i].name, symbol: RAENGE[i].symbol, naechster: naechster ? { name: naechster.name, symbol: naechster.symbol, ab: naechster.ab } : null };
}

// Merkt den höchsten erreichten Rang im Spielstand (stand.rangIndex), damit er nie sinkt.
export function mitRang(stand) {
  const punkte = gesamtPunkte(stand);
  const bisher = stand.rangIndex ?? rangIndexFuer(punkte, ALTE_GRENZEN);
  return { ...stand, rangIndex: rang(punkte, bisher).index };
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

// Rest-Aufgaben: „Ausdruck / Zahl“ – links ohne ungeklammertes + oder −, rechts eine Zahl.
export function rechneMitRest(rechnung) {
  const s = String(rechnung);
  const ops = [];
  let tiefe = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') tiefe++;
    else if (s[i] === ')') tiefe--;
    else if (tiefe === 0 && '+-*/'.includes(s[i])) ops.push({ op: s[i], i });
  }
  if (ops.at(-1)?.op !== '/') return { fehler: 'Rest-Aufgabe muss mit „/ Zahl“ enden' };
  if (ops.some(o => o.op === '+' || o.op === '-')) return { fehler: 'Plus/Minus links vom Teilen in Klammern setzen' };
  const rechts = s.slice(ops.at(-1).i + 1).trim();
  if (!/^\d+$/.test(rechts)) return { fehler: 'Der Teiler muss eine Zahl sein' };
  const links = rechne(s.slice(0, ops.at(-1).i));
  if (links.fehler) return links;
  const teiler = Number(rechts);
  if (teiler === 0) return { fehler: 'Teilen durch 0' };
  if (teiler > MAX_ZAHL) return { fehler: `Zahl ${teiler} ist größer als ${MAX_ZAHL}` };
  return { wert: Math.floor(links.wert / teiler), rest: links.wert % teiler };
}

export const RECHENART_NAMEN = {
  mal: 'Malnehmen', geteilt: 'Teilen', rest: 'Teilen mit Rest', plusminus: 'Plus & Minus',
  einheiten: 'Größen & Einheiten', raetsel: 'Bonus-Rätsel',
};

export function rechenarten(aufgabe) {
  if (aufgabe.art) return [aufgabe.art];
  if (aufgabe.rest !== undefined) return ['rest'];
  if (!aufgabe.rechnung) return ['raetsel'];
  const arten = [];
  if (aufgabe.rechnung.includes('*')) arten.push('mal');
  if (aufgabe.rechnung.includes('/')) arten.push('geteilt');
  if (/[+-]/.test(aufgabe.rechnung)) arten.push('plusminus');
  return arten;
}

// Fehlerstatistik: je Rechenart gelöste Aufgaben, Fehlversuche, Aufgaben mit Tipp; je Aufgabe die Fehlversuche.
export function mitStatistik(stand, arten, fehlversuche, schluessel) {
  const neu = structuredClone(stand);
  const st = neu.statistik ??= { arten: {}, aufgaben: {} };
  for (const art of arten) {
    const a = st.arten[art] ??= { aufgaben: 0, fehlversuche: 0, mitTipp: 0 };
    a.aufgaben++;
    a.fehlversuche += fehlversuche;
    if (fehlversuche >= TIPP_AB) a.mitTipp++;
  }
  if (schluessel && fehlversuche) st.aufgaben[schluessel] = (st.aufgaben[schluessel] ?? 0) + fehlversuche;
  return neu;
}

// --- Flugsimulator: Zufallsaufgaben ---
export const SIMULATOR_ARTEN = [
  { id: 'mal', name: 'Einmaleins' },
  { id: 'geteilt', name: 'Teilen' },
  { id: 'rest', name: 'Teilen mit Rest' },
  { id: 'plusminus', name: 'Plus & Minus bis 999' },
  { id: 'einheiten', name: 'Größen & Einheiten' },
];

const zahl = (zufall, von, bis) => von + Math.floor(zufall() * (bis - von + 1));
const eins = (zufall, liste) => liste[Math.floor(zufall() * liste.length)];

export function erzeugeAufgabe(art, zufall = Math.random) {
  if (art === 'mal') {
    const a = zahl(zufall, 2, 10), b = zahl(zufall, 2, 10);
    const [geschichte, frage, bild] = eins(zufall, [
      [`${a} Staffeln mit je ${b} X-Wings starten zum Übungsflug.`, 'Wie viele X-Wings starten?', ['x-wing/']],
      [`R2-D2 prüft ${a} Kisten mit je ${b} Ersatzteilen.`, 'Wie viele Ersatzteile prüft er?', ['r2-d2']],
      [`${a} Trupps mit je ${b} Sturmtruppen marschieren vorbei.`, 'Wie viele Sturmtruppen sind es?', ['sturmtruppen']],
    ]);
    return { art, geschichte, frage, bild, rechnung: `${a} * ${b}`, loesung: a * b, tipp: `${a} mal ${b} – das Einmaleins mit ${b} dir hilft.` };
  }
  if (art === 'geteilt' || art === 'rest') {
    let b, q;
    do { b = zahl(zufall, 2, art === 'rest' ? 9 : 10); q = zahl(zufall, 2, 10); } while (q === b);
    const r = art === 'rest' ? zahl(zufall, 1, b - 1) : 0;
    const a = b * q + r;
    if (art === 'geteilt') {
      const [geschichte, frage, bild] = eins(zufall, [
        [`${a} Rebellen werden gerecht auf ${b} Transporter verteilt.`, 'Wie viele Rebellen sind in jedem Transporter?', ['transporter']],
        [`Wicket teilt ${a} Beeren gerecht unter ${b} Ewoks auf.`, 'Wie viele Beeren bekommt jeder Ewok?', ['ewoks/']],
      ]);
      return { art, geschichte, frage, bild, rechnung: `${a} / ${b}`, loesung: q, tipp: `Welche Zahl mal ${b} ergibt ${a}, hmm?` };
    }
    const [geschichte, frage, bild] = eins(zufall, [
      [`${a} Rebellen sollen Gruppen zu je ${b} bilden.`, 'Wie viele volle Gruppen gibt es – und wie viele Rebellen bleiben übrig?', ['rebellenbasis']],
      [`Chewbacca packt ${a} Werkzeuge in Kisten. In jede Kiste passen ${b}.`, 'Wie viele Kisten werden voll – und wie viele Werkzeuge bleiben übrig?', ['chewbacca/']],
    ]);
    return { art, geschichte, frage, bild, rechnung: `${a} / ${b}`, loesung: q, rest: r, tipp: `Wie oft passt die ${b} ganz hinein? Was übrig bleibt, der Rest ist.` };
  }
  if (art === 'plusminus') {
    const tipp = 'Erst die Hunderter, dann die Zehner, dann die Einer du rechnen musst.';
    if (zufall() < 0.5) {
      const a = zahl(zufall, 20, 800), b = zahl(zufall, 10, MAX_PLUSMINUS - a);
      return { art, geschichte: `Der Millennium Falcon fliegt ${a} Kilometer und danach noch ${b} Kilometer.`, frage: 'Wie viele Kilometer fliegt er insgesamt?', bild: ['millennium-falcon/'], rechnung: `${a} + ${b}`, loesung: a + b, tipp };
    }
    const a = zahl(zufall, 60, MAX_PLUSMINUS), b = zahl(zufall, 10, a - 1);
    return { art, geschichte: `Ein Sternzerstörer hat ${a} Energiepunkte. ${b} davon werden zerstört.`, frage: 'Wie viele Energiepunkte bleiben übrig?', bild: ['sternzerstörer/'], rechnung: `${a} - ${b}`, loesung: a - b, tipp };
  }
  if (art === 'einheiten') {
    const typ = zahl(zufall, 0, 2);
    if (typ === 0) {
      const m = zahl(zufall, 1, 7), s = zahl(zufall, 1, 59);
      return { art, geschichte: `Der Sprung in den Hyperraum dauert ${m} Minuten und ${s} Sekunden.`, frage: 'Wie viele Sekunden sind das?', bild: ['hyperraum'], rechnung: `${m} * 60 + ${s}`, loesung: m * 60 + s, tipp: 'Eine Minute hat 60 Sekunden. Erst die Minuten umrechnen, dann die Sekunden dazu.' };
    }
    if (typ === 1) {
      const h = zahl(zufall, 2, 8);
      return { art, geschichte: `Der Flug nach Tatooine dauert ${h} Stunden.`, frage: 'Wie viele Minuten sind das?', bild: ['tatooine/'], rechnung: `${h} * 60`, loesung: h * 60, tipp: 'Eine Stunde hat 60 Minuten. Mal rechnen du musst.' };
    }
    const m = zahl(zufall, 1, 4), cm = zahl(zufall, 1, 99);
    return { art, geschichte: `Ein Kabel für den X-Wing ist ${m} Meter und ${cm} Zentimeter lang.`, frage: 'Wie viele Zentimeter sind das?', bild: ['x-wing/'], rechnung: `${m} * 100 + ${cm}`, loesung: m * 100 + cm, tipp: 'Ein Meter hat 100 Zentimeter. Erst die Meter umrechnen, dann die Zentimeter dazu.' };
  }
  throw new Error(`Unbekannte Rechenart ${art}`);
}

// Alte Spielstände nutzten "NN-name" als Kapitel-Kennung – heute ist es nur "name".
const ohneNummer = id => id.replace(/^\d+-/, '');
export function migriereStand(stand) {
  const neu = structuredClone(stand);
  neu.kapitel = Object.fromEntries(Object.entries(neu.kapitel ?? {}).map(([id, k]) => [ohneNummer(id), k]));
  neu.abzeichen = (neu.abzeichen ?? []).map(ohneNummer);
  if (neu.statistik?.aufgaben) {
    neu.statistik.aufgaben = Object.fromEntries(Object.entries(neu.statistik.aufgaben).map(([s, n]) => [ohneNummer(s), n]));
  }
  return neu;
}

export const MAX_PLUSMINUS = 999;

// Zahlenraum je Aufgabe: reine Plus/Minus-Aufgaben bis 999, Einheiten bis 9999, alles andere bis 500.
export function maxFuer(aufgabe) {
  if (aufgabe.art === 'einheiten') return MAX_EINHEITEN;
  const arten = rechenarten(aufgabe);
  return arten.length === 1 && arten[0] === 'plusminus' ? MAX_PLUSMINUS : MAX_ZAHL;
}

// Flugsimulator-Abzeichen: je Rechenart bei 5, 10, 20 und 40 gelösten Aufgaben.
export const SIMULATOR_STUFEN = [
  { ab: 5, name: 'Bronze', symbol: '🥉' },
  { ab: 10, name: 'Silber', symbol: '🥈' },
  { ab: 20, name: 'Gold', symbol: '🥇' },
  { ab: 40, name: 'Meister', symbol: '🏆' },
];

export const simulatorStufen = anzahl => SIMULATOR_STUFEN.filter(s => anzahl >= s.ab);

// Zählt eine gelöste Simulator-Aufgabe; liefert das dabei neu erreichte Abzeichen (oder null).
export function simulatorAufgabeGeloest(stand, art) {
  const anzahl = (stand.simulatorGeloest?.[art] ?? 0) + 1;
  return {
    stand: { ...stand, simulatorGeloest: { ...stand.simulatorGeloest, [art]: anzahl } },
    neuesAbzeichen: SIMULATOR_STUFEN.find(s => s.ab === anzahl) ?? null,
  };
}

// Falsche Antworten je Aufgabe für die Admin-Statistik (die letzten 10).
export function mitFalscherAntwort(stand, schluessel, eingabe) {
  const neu = structuredClone(stand);
  const st = neu.statistik ??= { arten: {}, aufgaben: {} };
  st.falsch ??= {};
  st.falsch[schluessel] = [...(st.falsch[schluessel] ?? []), eingabe].slice(-10);
  return neu;
}

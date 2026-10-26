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
// spielbilder/ (Kapitel-Vorschau, Belohnung, Helfer, Simulator) ist nie Teil der Suche – die werden über ihren festen Pfad geladen.
export const FESTE_BILDER = 'spielbilder/';
export function findeBilder(pfade, suchwoerter) {
  const ordner = suchwoerter.filter(w => w.endsWith('/')).map(w => normalisiere(w.slice(0, -1)));
  const woerter = suchwoerter.filter(w => !w.endsWith('/')).map(normalisiere).filter(Boolean);
  return pfade.filter(p => !p.startsWith(FESTE_BILDER) && (
    ordner.includes(normalisiere(p.split('/')[0])) && p.includes('/')
    || woerter.some(w => normalisiere(p).includes(w))));
}

// Ein Bild je Aufgabe eines Kapitels, möglichst ohne Wiederholung (Zuordnung über Austauschpfade).
// Wo es nicht anders geht, bekommt eine Aufgabe ein schon vergebenes Bild; ohne Treffer null.
export function verteileBilder(pfade, aufgaben, zufall = Math.random) {
  const kandidaten = aufgaben.map(a => {
    const t = findeBilder(pfade, a.bild ?? []);
    for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(zufall() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
    return t;
  });
  const besitzer = new Map();
  const belege = (i, gesehen) => kandidaten[i].some(b => {
    if (gesehen.has(b)) return false;
    gesehen.add(b);
    if (besitzer.has(b) && !belege(besitzer.get(b), gesehen)) return false;
    besitzer.set(b, i);
    return true;
  });
  kandidaten.forEach((_, i) => belege(i, new Set()));
  const ergebnis = kandidaten.map(k => k[0] ?? null);
  for (const [b, i] of besitzer) ergebnis[i] = b;
  return ergebnis;
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

// Spielstand: { name, kapitel: { [id]: { geloest, punkte, fertig } }, abzeichen: [id], abzeichenDatum: { [id]: 'JJJJ-MM-TT' } }
export const STANDARD_NAME = 'C3-Jo';

export function leererStand() {
  return { name: STANDARD_NAME, kapitel: {}, abzeichen: [], rangListe: RANG_LISTE };
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

const tagVon = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function aufgabeGeloest(stand, kapitelId, anzahlAufgaben, fehlversuche, heute = new Date()) {
  const neu = structuredClone(stand);
  const k = neu.kapitel[kapitelId] ??= { geloest: 0, punkte: 0, fertig: false };
  k.geloest += 1;
  k.punkte += punkteFuer(fehlversuche);
  if (k.geloest >= anzahlAufgaben) {
    k.fertig = true;
    if (!neu.abzeichen.includes(kapitelId)) {
      neu.abzeichen.push(kapitelId);
      neu.abzeichenDatum = { ...neu.abzeichenDatum, [kapitelId]: tagVon(heute) };
    }
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
  { name: 'Jedi-Wächter', symbol: '🛡️', ab: 900 },
  { name: 'Jedi-Meister', symbol: '🧙', ab: 1200 },
  { name: 'Großmeister', symbol: '🌟', ab: 2000 },
];
// Grenzen bis Oktober 2026 – nur für Spielstände ohne gespeicherten Rang, damit niemand absteigt.
// Damals gab es den Jedi-Wächter (Index 3) noch nicht: ab 1000 Punkten war man gleich Jedi-Meister.
const ALTE_GRENZEN = [0, 150, 500, Infinity, 1000];
// Version der Rangliste im Spielstand: 2 = mit Jedi-Wächter zwischen Ritter und Meister.
const RANG_LISTE = 2;

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
  einheiten: 'Größen & Einheiten', raetsel: 'Bonus-Rätsel', logik: 'Logik-Rätsel', uhrzeit: 'Uhrzeiten', geld: 'Geld',
};

// Antworten in zwei Feldern: Lösung in Minuten bzw. Cent, eingegeben als Stunden : Minuten bzw. Euro , Cent.
export const ZWEI_FELDER = { uhrzeit: { faktor: 60, vor: ':', nach: 'Uhr' }, geld: { faktor: 100, vor: ',', nach: '€' } };

export function zweiteilig(wert, format) {
  const z = ZWEI_FELDER[format];
  return `${Math.floor(wert / z.faktor)}${z.vor}${String(wert % z.faktor).padStart(2, '0')} ${z.nach}`;
}

export const loesungText = a => (ZWEI_FELDER[a.format] ? zweiteilig(a.loesung, a.format) : a.loesung + (a.rest !== undefined ? ` Rest ${a.rest}` : ''));

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
  { id: 'plusminus', name: 'Plus & Minus' },
  { id: 'einheiten', name: 'Größen & Einheiten' },
  { id: 'logik', name: 'Logik-Rätsel' },
  { id: 'uhrzeit', name: 'Uhrzeiten' },
  { id: 'geld', name: 'Geld' },
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
      [`${a} Korvetten der Rebellen haben je ${b} Rettungskapseln an Bord.`, 'Wie viele Rettungskapseln sind es zusammen?', ['corellianische-korvette/']],
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
        [`${a} Rebellen gehen gerecht verteilt an Bord von ${b} Korvetten.`, 'Wie viele Rebellen sind auf jeder Korvette?', ['corellianische-korvette/']],
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
    const typ = zahl(zufall, 0, 3);
    if (typ === 0) {
      const m = zahl(zufall, 2, 7), s = zahl(zufall, 2, 59);
      const [geschichte, bild] = eins(zufall, [
        [`Der Sprung in den Hyperraum dauert ${m} Minuten und ${s} Sekunden.`, ['hyperraum']],
        [`R2-D2 repariert den Antrieb des X-Wings in ${m} Minuten und ${s} Sekunden.`, ['r2-d2']],
        [`Luke balanciert bei Yodas Training ${m} Minuten und ${s} Sekunden auf einer Hand.`, ['dagobah/']],
        [`Die Ewoks brauchen ${m} Minuten und ${s} Sekunden, um eine Falle aufzubauen.`, ['ewoks/']],
      ]);
      return { art, geschichte, frage: 'Wie viele Sekunden sind das?', bild, rechnung: `${m} * 60 + ${s}`, loesung: m * 60 + s, tipp: 'Eine Minute hat 60 Sekunden. Erst die Minuten umrechnen, dann die Sekunden dazu.' };
    }
    if (typ === 1) {
      const h = zahl(zufall, 2, 8), min = eins(zufall, [0, 0, zahl(zufall, 5, 55)]);
      const [flug, bild] = eins(zufall, [
        ['von Hoth nach Dagobah', ['dagobah/']], ['von Dagobah zur Wolkenstadt', ['wolkenstadt-bespin/']],
        ['von Tatooine zum Todesstern', ['todesstern/']], ['vom Todesstern nach Yavin 4', ['yavin-4/']],
        ['von Yavin 4 nach Hoth', ['hoth/']], ['von der Wolkenstadt zur Rebellenflotte', ['mon-calamari-cruiser/']],
        ['von der Rebellenflotte nach Endor', ['endor/']], ['von Alderaan nach Tatooine', ['tatooine/']],
      ]);
      const dauer = min ? `${h} Stunden und ${min} Minuten` : `${h} Stunden`;
      return { art, geschichte: `Der Flug ${flug} dauert ${dauer}.`, frage: 'Wie viele Minuten sind das?', bild,
        rechnung: min ? `${h} * 60 + ${min}` : `${h} * 60`, loesung: h * 60 + min,
        tipp: min ? 'Eine Stunde hat 60 Minuten. Erst die Stunden umrechnen, dann die Minuten dazu.' : 'Eine Stunde hat 60 Minuten. Mal rechnen du musst.' };
    }
    if (typ === 2) {
      const km = zahl(zufall, 1, 9), m = zahl(zufall, 10, 990);
      const [weg, bild] = eins(zufall, [
        ['Von Mos Eisley bis zur Farm der Lars-Familie', ['tatooine/']], ['Von der Echo-Basis bis zum Schildgenerator', ['hoth/']],
        ['Vom Landeplatz bis zum Baumdorf der Ewoks', ['ewoks/']], ['Vom Massassi-Tempel bis zum Dschungelfluss', ['yavin-4/']],
        ['Von Yodas Hütte bis zum Sumpf mit dem X-Wing', ['dagobah/']], ['Von der Landeplattform bis zur Karbonitkammer der Wolkenstadt', ['wolkenstadt-bespin/']],
        ['Über die Oberfläche des Todessterns bis zum Lüftungsschacht', ['todesstern/']],
      ]);
      return { art, geschichte: `${weg} sind es ${km} Kilometer und ${m} Meter.`, frage: 'Wie viele Meter sind das?', bild,
        rechnung: `${km} * 1000 + ${m}`, loesung: km * 1000 + m, tipp: 'Ein Kilometer hat 1000 Meter. Erst die Kilometer umrechnen, dann die Meter dazu.' };
    }
    const m = zahl(zufall, 1, 4), cm = zahl(zufall, 1, 99);
    const [ding, bild] = eins(zufall, [
      ['Das Laserkabel im Flügel eines X-Wings', ['x-wing/']], ['Das Abschleppseil eines Snowspeeders', ['snowspeeder/']],
      ['Ein Ersatzrohr für den Millennium Falcon', ['millennium-falcon/']], ['Das Datenkabel, an das R2-D2 sich anschließt,', ['r2-d2']],
      ['Das Seil einer Ewok-Falle', ['ewoks/']], ['Eine Antenne des Y-Wings', ['y-wing/']], ['Ein Metallträger, den Chewbacca schleppt,', ['chewbacca/']],
    ]);
    return { art, geschichte: `${ding} ist ${m} Meter und ${cm} Zentimeter lang.`, frage: 'Wie viele Zentimeter sind das?', bild, rechnung: `${m} * 100 + ${cm}`, loesung: m * 100 + cm, tipp: 'Ein Meter hat 100 Zentimeter. Erst die Meter umrechnen, dann die Zentimeter dazu.' };
  }
  if (art === 'uhrzeit') {
    const typ = zahl(zufall, 0, 2), d = zahl(zufall, 3, 19) * 5; // Flugdauer 15–95 Minuten
    const h = zahl(zufall, 7, 20), m = zahl(zufall, 0, 11) * 5;
    const [flug, bild] = eins(zufall, [
      ['von Hoth nach Dagobah', ['dagobah/']], ['von Dagobah zur Wolkenstadt', ['wolkenstadt-bespin/']],
      ['von Tatooine zum Todesstern', ['todesstern/']], ['vom Todesstern nach Yavin 4', ['yavin-4/']],
      ['von der Rebellenflotte nach Endor', ['endor/']], ['von Alderaan nach Tatooine', ['tatooine/']],
    ]);
    const uhr = (t) => zweiteilig(t, 'uhrzeit');
    if (typ === 0) {
      return { art, format: 'uhrzeit', geschichte: `Der Flug ${flug} startet um ${uhr(h * 60 + m)} und dauert ${d} Minuten.`, frage: 'Um wie viel Uhr kommt das Schiff an?', bild,
        rechnung: `${h} * 60 + ${m} + ${d}`, loesung: h * 60 + m + d, tipp: 'Erst bis zur vollen Stunde du rechnest. Dann die übrigen Minuten dazu.' };
    }
    if (typ === 1) {
      const d2 = zahl(zufall, 4, 30) * 5, ende = h * 60 + m + d2; // 20–150 Minuten
      return { art, geschichte: `Der Flug ${flug} startet um ${uhr(h * 60 + m)} und landet um ${uhr(ende)}.`, frage: 'Wie viele Minuten dauert der Flug?', bild,
        rechnung: `${Math.floor(ende / 60)} * 60 + ${ende % 60} - (${h} * 60 + ${m})`, loesung: d2,
        tipp: 'Bis zur nächsten vollen Stunde zuerst, dann die ganzen Stunden, dann die übrigen Minuten. Alles zusammenzählen du musst.' };
    }
    return { art, format: 'uhrzeit', geschichte: `Nach ${d} Minuten Flug ${flug} landet das Schiff um ${uhr(h * 60 + m)}.`, frage: 'Um wie viel Uhr ist es gestartet?', bild,
      rechnung: `${h} * 60 + ${m} - ${d}`, loesung: h * 60 + m - d, tipp: 'Rückwärts rechnen du musst. Erst zurück bis zur vollen Stunde, dann die übrigen Minuten.' };
  }
  if (art === 'geld') {
    const n = zahl(zufall, 2, 5), p = zahl(zufall, 3, 40) * 10; // Preis 0,30–4,00 €
    const euro = (c) => zweiteilig(c, 'geld');
    const [wer, ware, bild] = eins(zufall, [
      ['Luke', 'Gläser Blaue Milch', ['tatooine/']], ['Han Solo', 'Energiezellen', ['mos-eisley']],
      ['Onkel Owen', 'Ersatzteile bei den Jawas', ['jawa']], ['C-3PO', 'Dosen Öl', ['oelbad']],
      ['Chewbacca', 'Bantha-Würstchen', ['chewbacca/']], ['R2-D2', 'Schaltkreise', ['r2-d2']],
    ]);
    const geschichte = `${wer} kauft in Mos Eisley ${n} ${ware}. Eins kostet ${euro(p)}.`;
    if (zufall() < 0.5) {
      return { art, format: 'geld', geschichte, frage: 'Wie viel muss er zusammen bezahlen?', bild,
        rechnung: `${n} * ${p}`, loesung: n * p, tipp: 'Erst die Euro malnehmen, dann die Cent. Hundert Cent ein Euro sind.' };
    }
    const schein = [5, 10, 20, 50].find(e => e * 100 > n * p);
    return { art, format: 'geld', geschichte: `${geschichte} Er bezahlt mit einem ${schein}-Euro-Schein.`, frage: 'Wie viel Wechselgeld bekommt er zurück?', bild,
      rechnung: `${schein} * 100 - ${n} * ${p}`, loesung: schein * 100 - n * p, tipp: 'Erst ausrechnen, was alles kostet. Dann bis zum Schein du ergänzen musst.' };
  }
  if (art === 'logik') {
    // Tipps ohne Zahlen, damit sie nie die Lösung verraten.
    const typ = zahl(zufall, 0, 4);
    if (typ === 0) {
      const folge = eins(zufall, ['plus', 'minus', 'doppelt']);
      const s = folge === 'doppelt' ? zahl(zufall, 2, 10) : folge === 'plus' ? zahl(zufall, 2, 30) : zahl(zufall, 50, 120);
      const d = zahl(zufall, 2, folge === 'plus' ? 12 : 10);
      const glied = i => (folge === 'doppelt' ? s * 2 ** i : folge === 'plus' ? s + i * d : s - i * d);
      const zahlen = [0, 1, 2, 3].map(glied).join(', ');
      const [geschichte, bild] = eins(zufall, [
        [`R2-D2 piept eine geheime Zahlenfolge: ${zahlen}, …`, ['r2-d2']],
        [`Ein Funkspruch der Rebellen enthält diesen Code: ${zahlen}, …`, ['x-wing/']],
        [`Auf Darth Vaders Geheimcode stehen die Zahlen ${zahlen}, …`, ['darth-vader/']],
        [`Die Ewoks trommeln eine Botschaft: ${zahlen}, …`, ['ewoks/']],
        [`C-3PO entschlüsselt eine imperiale Nachricht: ${zahlen}, …`, ['c-3po/']],
        [`Die Tantive IV funkt einen geheimen Notruf: ${zahlen}, …`, ['corellianische-korvette/']],
      ]);
      return { art, geschichte, frage: 'Welche Zahl kommt als Nächstes?', bild,
        rechnung: folge === 'doppelt' ? `${glied(3)} * 2` : `${glied(3)} ${folge === 'plus' ? '+' : '-'} ${d}`, loesung: glied(4),
        tipp: 'Schau genau, wie von Zahl zu Zahl es sich verändert. Immer gleich es weitergeht.' };
    }
    if (typ === 1) {
      const a = zahl(zufall, 2, 5), x = zahl(zufall, 2, 20), b = zahl(zufall, 1, 20);
      const [wer, er, bild] = eins(zufall, [
        ['Yoda', 'Er', ['yoda/']], ['Obi-Wan', 'Er', ['obi-wan-kenobi/']], ['Prinzessin Leia', 'Sie', ['leia/']],
        ['Lando', 'Er', ['lando-calrissian/']], ['Han Solo', 'Er', ['han-solo/']],
      ]);
      return { art, geschichte: `${wer} denkt sich eine Zahl. ${er} nimmt sie mal ${a} und zählt dann ${b} dazu. Heraus kommt ${a * x + b}.`, frage: `Welche Zahl hat ${wer} sich gedacht?`, bild,
        rechnung: `(${a * x + b} - ${b}) / ${a}`, loesung: x, tipp: 'Rückwärts rechnen du musst: Was dazugezählt wurde, wieder wegnehmen. Dann teilen statt malnehmen.' };
    }
    if (typ === 2) {
      const k = zahl(zufall, 4, 12), y = zahl(zufall, 1, k - 1), beine = 2 * k + 2 * y;
      const [geschichte, frage, bild] = eins(zufall, [
        [`Auf einer Farm auf Tatooine sind Menschen und Banthas. Zusammen haben sie ${k} Köpfe und ${beine} Beine. Ein Mensch hat zwei Beine, ein Bantha vier.`, 'Wie viele Banthas sind auf der Farm?', ['tatooine/']],
        [`In einer imperialen Halle stehen AT-STs und AT-ATs. Zusammen haben sie ${k} Köpfe und ${beine} Beine. Ein AT-ST hat zwei Beine, ein AT-AT vier.`, 'Wie viele AT-ATs stehen in der Halle?', ['at-at/', 'at-st/']],
        [`Durch die Wüste ziehen Jawas mit ihren Dewbacks. Zusammen haben sie ${k} Köpfe und ${beine} Beine. Ein Jawa hat zwei Beine, ein Dewback vier.`, 'Wie viele Dewbacks sind es?', ['tatooine/']],      ]);
      return { art, geschichte, frage, bild,
        rechnung: `(${beine} - 2 * ${k}) / 2`, loesung: y, tipp: 'Gib zuerst jedem Kopf zwei Beine. Die übrigen Beine gehören denen mit vier Beinen – jeder hat zwei mehr.' };
    }
    if (typ === 3) {
      const a = eins(zufall, [2, 5, 10]), n = zahl(zufall, 3, 10);
      const [geschichte, frage, bild] = eins(zufall, [
        [`Die Landebahn der Rebellenbasis ist ${a * n} Meter lang. Alle ${a} Meter steht eine Lampe – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Lampen stehen an der Landebahn?', ['x-wing/']],
        [`Der Laserzaun um die Echo-Basis ist ${a * n} Meter lang. Alle ${a} Meter steht ein Pfosten – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Pfosten hat der Zaun?', ['hoth/']],
        [`Eine Brücke in der Wolkenstadt ist ${a * n} Meter lang. Alle ${a} Meter leuchtet eine Laterne – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Laternen hat die Brücke?', ['wolkenstadt-bespin/']],
        [`Die Hängebrücke im Ewok-Dorf ist ${a * n} Meter lang. Alle ${a} Meter brennt eine Fackel – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Fackeln brennen an der Brücke?', ['ewoks/']],
        [`Der Graben des Todessterns ist auf einem Stück ${a * n} Meter lang. Alle ${a} Meter steht ein Geschützturm – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Geschütztürme stehen dort?', ['todesstern/']],
        [`Ein Gang der Tantive IV ist ${a * n} Meter lang. Alle ${a} Meter ist eine Tür – auch ganz am Anfang und ganz am Ende.`, 'Wie viele Türen hat der Gang?', ['corellianische-korvette/']],
      ]);
      return { art, geschichte, frage, bild,
        rechnung: `${a * n} / ${a} + 1`, loesung: n + 1, tipp: 'Vorsicht, eine Falle das ist! Zähle erst die Abstände. Am Anfang auch einer steht.' };
    }
    const h = zahl(zufall, 5, 60), d = zahl(zufall, 2, 30), summe = 2 * h + d;
    // [Geschichte, Frage nach dem kleineren Teil, Frage nach dem größeren Teil, Bild]
    const [geschichte, frageKlein, frageGross, bild] = eins(zufall, [
      [`Han und Chewbacca haben zusammen ${summe} Credits. Chewbacca hat ${d} Credits mehr als Han.`, 'Wie viele Credits hat Han?', 'Wie viele Credits hat Chewbacca?', ['chewbacca/']],
      [`Die Rote und die Goldene Staffel feuern zusammen ${summe} Protonentorpedos ab. Die Rote Staffel feuert ${d} Torpedos mehr ab als die Goldene.`, 'Wie viele Torpedos feuert die Goldene Staffel ab?', 'Wie viele Torpedos feuert die Rote Staffel ab?', ['x-wing/', 'y-wing/']],
      [`Zwei Sternzerstörer haben zusammen ${summe} TIE-Jäger an Bord. Die Devastator hat ${d} TIE-Jäger mehr als die Avenger.`, 'Wie viele TIE-Jäger hat die Avenger?', 'Wie viele TIE-Jäger hat die Devastator?', ['sternzerstörer/']],
      [`Zwei Transporter bringen zusammen ${summe} Kisten Vorräte zur Echo-Basis. Der zweite Transporter hat ${d} Kisten mehr geladen als der erste.`, 'Wie viele Kisten hat der erste Transporter geladen?', 'Wie viele Kisten hat der zweite Transporter geladen?', ['transporter']],
      [`Ein X-Wing und ein Y-Wing fliegen zusammen ${summe} Kilometer auf Patrouille. Der X-Wing fliegt ${d} Kilometer weiter als der Y-Wing.`, 'Wie viele Kilometer fliegt der Y-Wing?', 'Wie viele Kilometer fliegt der X-Wing?', ['x-wing/', 'y-wing/']],
      [`Zwei Rebellenkreuzer haben zusammen ${summe} Piloten an Bord. Die Home One hat ${d} Piloten mehr als die Liberty.`, 'Wie viele Piloten hat die Liberty?', 'Wie viele Piloten hat die Home One?', ['mon-calamari-cruiser/']],
      [`R2-D2 und C-3PO reparieren zusammen ${summe} Schaltkreise. R2-D2 schafft ${d} Schaltkreise mehr als C-3PO.`, 'Wie viele Schaltkreise repariert C-3PO?', 'Wie viele Schaltkreise repariert R2-D2?', ['r2-d2', 'c-3po/']],
      [`Zwei Ewok-Dörfer sammeln zusammen ${summe} Beeren. Das Baumdorf sammelt ${d} Beeren mehr als das Walddorf.`, 'Wie viele Beeren sammelt das Walddorf?', 'Wie viele Beeren sammelt das Baumdorf?', ['ewoks/']],
      [`Zwei Trupps haben zusammen ${summe} Sturmtruppen. Im ersten Trupp sind ${d} Sturmtruppen mehr als im zweiten.`, 'Wie viele Sturmtruppen sind im zweiten Trupp?', 'Wie viele Sturmtruppen sind im ersten Trupp?', ['sturmtruppen']],
      [`Luke und Leia sammeln zusammen ${summe} Energiezellen für die Rebellen. Leia sammelt ${d} Energiezellen mehr als Luke.`, 'Wie viele Energiezellen sammelt Luke?', 'Wie viele Energiezellen sammelt Leia?', ['leia/', 'luke-skywalker/']],
      [`Der Millennium Falcon und ein TIE-Jäger feuern zusammen ${summe} Laserschüsse ab. Der Falcon feuert ${d} Schüsse mehr ab als der TIE-Jäger.`, 'Wie viele Schüsse feuert der TIE-Jäger ab?', 'Wie viele Schüsse feuert der Falcon ab?', ['millennium-falcon/', 'tie-fighter/']],
      [`Zwei Korvetten der Rebellen bringen zusammen ${summe} Rebellen in Sicherheit. Die Tantive IV rettet ${d} Rebellen mehr als die zweite Korvette.`, 'Wie viele Rebellen rettet die zweite Korvette?', 'Wie viele Rebellen rettet die Tantive IV?', ['corellianische-korvette/']],
    ]);
    const nachGross = zufall() < 0.5;
    return { art, geschichte, frage: nachGross ? frageGross : frageKlein, bild,
      rechnung: nachGross ? `(${summe} - ${d}) / 2 + ${d}` : `(${summe} - ${d}) / 2`, loesung: nachGross ? h + d : h,
      tipp: nachGross ? 'Nimm erst den Unterschied weg und halbiere gerecht. Dann den Unterschied wieder dazu du zählst.'
        : 'Nimm erst den Unterschied weg. Den Rest dann gerecht halbieren du musst.' };
  }
  throw new Error(`Unbekannte Rechenart ${art}`);
}

// Alte Spielstände nutzten "NN-name" als Kapitel-Kennung – heute ist es nur "name".
const ohneNummer = id => id.replace(/^\d+-/, '');
export function migriereStand(stand) {
  const neu = structuredClone(stand);
  neu.kapitel = Object.fromEntries(Object.entries(neu.kapitel ?? {}).map(([id, k]) => [ohneNummer(id), k]));
  neu.abzeichen = (neu.abzeichen ?? []).map(ohneNummer);
  // Rangliste 1 kannte den Jedi-Wächter nicht – gespeicherte Ränge ab Jedi-Meister rücken eins weiter.
  if ((neu.rangListe ?? 1) < 2 && neu.rangIndex >= 3) neu.rangIndex++;
  neu.rangListe = RANG_LISTE;
  if (neu.statistik?.aufgaben) {
    neu.statistik.aufgaben = Object.fromEntries(Object.entries(neu.statistik.aufgaben).map(([s, n]) => [ohneNummer(s), n]));
  }
  return neu;
}

export const MAX_PLUSMINUS = 999;

// Zahlenraum je Aufgabe: reine Plus/Minus-Aufgaben bis 999, Einheiten bis 9999, alles andere bis 500.
export function maxFuer(aufgabe) {
  if (['einheiten', 'uhrzeit', 'geld'].includes(aufgabe.art)) return MAX_EINHEITEN;
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

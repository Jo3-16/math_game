import {
  findeBilder, istRichtig, punkteFuer, TIPP_AB, leererStand, kapitelStatus, aufgabeGeloest, gesamtPunkte, mitName,
  rang, mitRang, RAENGE, sterneFuer, kapitelSterne, mitSternen, bonusGeloest, BONUS_PUNKTE,
  rechenarten, mitStatistik, erzeugeAufgabe, SIMULATOR_ARTEN, RECHENART_NAMEN, migriereStand,
  SIMULATOR_STUFEN, simulatorAufgabeGeloest, mitFalscherAntwort,
} from './logik.js';

const $ = id => document.getElementById(id);
const ANSICHTEN = ['auswahl', 'uebersicht', 'aufgabe', 'ruhmeshalle', 'galerie', 'simulator', 'statistik', 'archiv'];
// Admin-Modus (/admin): alle Kapitel offen, Aufgaben überspringen, Lösung sichtbar, nichts wird gespeichert.
const ADMIN = location.pathname === '/admin';

let welt, weltId, stand;
let kapitelIndex, aufgabeIndex, fehlversuche, wiederholung, wartet, weiterTimer;
let ohneTipp, laufSterne; // im aktuellen Durchlauf ohne Tipp gelöste Aufgaben, Sterne dieses Durchlaufs
let simulatorArt = null, simAufgabe, serie = 0; // Flugsimulator: gewählte Rechenart, aktuelle Zufallsaufgabe, Serie ohne Fehler

function zeige(ansicht) {
  for (const a of ANSICHTEN) $(a).hidden = a !== ansicht;
}

function element(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

const kapitelNummer = (k, i) => i + 1; // Position in der Reihenfolge aus welt.json, gezählt ab 1
const sterneText = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);
const maxPunkte = k => k.aufgaben.length * 15 + (k.bonus ? BONUS_PUNKTE : 0);
const rangText = () => { const r = rang(gesamtPunkte(stand), stand.rangIndex ?? 0); return `${r.symbol} ${r.name}`; };

// --- Ton: im Browser erzeugt, an/aus wird im Browser gemerkt ---
let audio;
function tonAn() {
  try { return localStorage.getItem('ton') !== 'aus'; } catch { return true; }
}
function zeigeTonKnopf() {
  for (const b of document.querySelectorAll('.ton-knopf')) b.textContent = tonAn() ? '🔊' : '🔇';
}
function ton(art) {
  if (!tonAn()) return;
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    // [von Hz, bis Hz, Start s, Dauer s, Wellenform]
    const toene = art === 'richtig'
      ? [[1600, 220, 0, 0.22, 'sawtooth']] // Laser-„Piu“
      : [[1200, 1800, 0, 0.07, 'square'], [1700, 900, 0.09, 0.07, 'square'], [1000, 1500, 0.19, 0.09, 'square']]; // R2-D2-Pfeifen
    for (const [von, bis, start, dauer, form] of toene) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = form;
      o.frequency.setValueAtTime(von, t + start);
      o.frequency.exponentialRampToValueAtTime(bis, t + start + dauer);
      g.gain.setValueAtTime(0.08, t + start);
      g.gain.exponentialRampToValueAtTime(0.001, t + start + dauer);
      o.connect(g).connect(audio.destination);
      o.start(t + start);
      o.stop(t + start + dauer);
    }
  } catch { /* ohne Ton weiterspielen */ }
}
for (const b of document.querySelectorAll('.ton-knopf')) {
  b.onclick = () => {
    try { localStorage.setItem('ton', tonAn() ? 'aus' : 'an'); } catch { /* egal */ }
    zeigeTonKnopf();
  };
}
zeigeTonKnopf();

async function start() {
  const welten = await (await fetch('/api/welten')).json();
  if (welten.length === 1) return ladeWelt(welten[0].id);
  $('welten').replaceChildren(...welten.map(w => {
    const b = element('button', 'kachel', w.name);
    b.onclick = () => ladeWelt(w.id);
    return b;
  }));
  zeige('auswahl');
}

async function ladeWelt(id) {
  weltId = id;
  welt = await (await fetch(`/api/welten/${encodeURIComponent(id)}`)).json();
  stand = (await (await fetch(`/api/welten/${encodeURIComponent(id)}/spielstand`)).json()) ?? leererStand();
  stand = mitRang(mitName(migriereStand(stand)));
  for (const [name, wert] of Object.entries(welt.farben ?? {})) document.documentElement.style.setProperty(`--${name}`, wert);
  document.title = welt.name;
  $('weltname').textContent = welt.name + (ADMIN ? ' – Admin-Modus' : '');
  $('galerie-knopf').hidden = !ADMIN;
  $('statistik-knopf').hidden = !ADMIN;
  if (location.pathname === '/abzeichen') zeigeRuhmeshalle();
  else if (location.pathname === '/archiv') zeigeArchiv();
  else zeigeUebersicht();
}

function abzeichenKarte(k, i, mitDetails) {
  const s = stand.kapitel[k.id];
  const hat = stand.abzeichen.includes(k.id);
  const d = element('div', [hat ? '' : 'offen', s?.bonus ? 'gold' : ''].join(' ').trim());
  d.append(element('span', '', k.abzeichen.symbol), hat || !mitDetails ? k.abzeichen.name : '???');
  if (mitDetails) {
    d.append(element('small', '', `Kapitel ${kapitelNummer(k, i)} · ${s?.punkte ?? 0}/${maxPunkte(k)} Punkte`));
    if (hat) d.append(element('small', '', sterneText(kapitelSterne(s, k.aufgaben.length)) + (s?.bonus ? ' 🥇' : '')));
  }
  d.title = k.titel + (s?.bonus ? ' – Gold-Abzeichen' : '');
  return d;
}

function zeigeUebersicht() {
  const status = kapitelStatus(stand, welt.kapitel.map(k => k.id));
  $('kapitel').replaceChildren(...welt.kapitel.map((k, i) => {
    const s = stand.kapitel[k.id];
    const b = element('button', `kachel ${status[i]}`);
    const zeile = {
      fertig: `✅ ${s?.punkte ?? 0}/${maxPunkte(k)} Punkte ${sterneText(kapitelSterne(s, k.aufgaben.length))}${s?.bonus ? ' 🥇' : ''} – nochmal spielen`,
      offen: `▶️ ${s?.geloest ?? 0}/${k.aufgaben.length} gelöst`,
      gesperrt: '🔒 gesperrt',
    }[status[i]];
    if (k.vorschau) {
      const vorschau = element('img', 'vorschau');
      vorschau.src = pfadUrl(k.vorschau);
      vorschau.alt = '';
      b.append(vorschau);
    }
    const text = element('div');
    text.append(element('small', '', `Kapitel ${kapitelNummer(k, i)}`), element('b', '', k.titel), element('small', '', zeile));
    b.append(text);
    if (ADMIN) b.onclick = () => starteKapitel(i, true);
    else if (status[i] === 'gesperrt') b.disabled = true;
    else b.onclick = () => starteKapitel(i, status[i] === 'fertig');
    return b;
  }));

  const abzeichen = welt.kapitel.map((k, i) => [k, i]).filter(([k]) => stand.abzeichen.includes(k.id));
  $('abzeichen').replaceChildren(...(abzeichen.length
    ? abzeichen.map(([k, i]) => abzeichenKarte(k, i, false))
    : [element('p', '', "Noch keine Abzeichen – auf geht's!")]));

  $('gesamt-uebersicht').textContent = gesamtPunkte(stand);
  $('spielername').textContent = stand.name;
  $('rang-uebersicht').textContent = rangText();
  if (ADMIN) zeigeRaenge();
  zeige('uebersicht');
}

// Admin: alle Ränge mit Grenzen, der aktuelle Rang des Spielers und die höchstens erreichbaren Punkte.
function zeigeRaenge() {
  const punkte = gesamtPunkte(stand);
  const aktuell = rang(punkte, stand.rangIndex ?? 0).index;
  const kopf = element('tr');
  for (const t of ['Rang', 'ab Punkten', '']) kopf.append(element('th', '', t));
  $('raenge-tabelle').replaceChildren(kopf, ...RAENGE.map((r, i) => {
    const tr = element('tr', i === aktuell ? 'aktuell' : '');
    for (const t of [`${r.symbol} ${r.name}`, r.ab, i === aktuell ? `← ${stand.name} (${punkte} Punkte)` : '']) tr.append(element('td', '', t));
    return tr;
  }));
  const max = welt.kapitel.reduce((summe, k) => summe + maxPunkte(k), 0);
  $('raenge-info').textContent = `Höchstens erreichbar: ${max} Punkte in ${welt.kapitel.length} Kapiteln. Ein einmal erreichter Rang bleibt erhalten.`;
  // Simulator-Stufen je Rechenart: gelöste Aufgaben und welche Stufen erreicht sind
  const kopf2 = element('tr');
  for (const t of ['Rechenart', 'gelöst', ...SIMULATOR_STUFEN.map(st => `${st.symbol} ${st.name} (ab ${st.ab})`)]) kopf2.append(element('th', '', t));
  $('sim-stufen-tabelle').replaceChildren(kopf2, ...SIMULATOR_ARTEN.map(a => {
    const n = stand.simulatorGeloest?.[a.id] ?? 0;
    const tr = element('tr');
    for (const t of [a.name, n, ...SIMULATOR_STUFEN.map(st => (n >= st.ab ? '✓' : `noch ${st.ab - n}`))]) tr.append(element('td', '', t));
    return tr;
  }));
  $('admin-raenge').hidden = false;
}

function starteKapitel(index, alsWiederholung) {
  simulatorArt = null;
  kapitelIndex = index;
  wiederholung = alsWiederholung;
  ohneTipp = 0;
  laufSterne = 0;
  aufgabeIndex = wiederholung ? 0 : (stand.kapitel[welt.kapitel[index].id]?.geloest ?? 0);
  zeigeAufgabe();
}

function bildUrl(suchwoerter) {
  const treffer = findeBilder(welt.bilder, suchwoerter);
  if (!treffer.length) return '';
  return pfadUrl(treffer[Math.floor(Math.random() * treffer.length)]);
}

function pfadUrl(pfad) {
  return `/welten/${encodeURIComponent(weltId)}/bilder/${pfad.split('/').map(encodeURIComponent).join('/')}`;
}

const imBonus = kapitel => !simulatorArt && aufgabeIndex >= kapitel.aufgaben.length;

// Die normale Aufgabe – nach der letzten Aufgabe das Bonus-Rätsel (mit dem Bild der letzten Aufgabe) – oder im Simulator die Zufallsaufgabe.
function aktuelleAufgabe(kapitel) {
  if (simulatorArt) return simAufgabe;
  if (!imBonus(kapitel)) return kapitel.aufgaben[aufgabeIndex];
  return { bild: kapitel.aufgaben.at(-1).bild, ...kapitel.bonus };
}

function zeigeAufgabe() {
  const kapitel = welt.kapitel[kapitelIndex];
  const aufgabe = aktuelleAufgabe(kapitel);
  const bonus = imBonus(kapitel);
  fehlversuche = 0;
  wartet = false;

  const url = bildUrl(aufgabe.bild);
  $('bild').hidden = !url;
  if (url) $('bild').src = url;

  if (simulatorArt) {
    const rekord = stand.simulatorRekord?.[simulatorArt] ?? 0;
    $('kapiteltitel').textContent = `Flugsimulator – ${SIMULATOR_ARTEN.find(a => a.id === simulatorArt).name}`;
    $('fortschritt').textContent = `🎮 Serie: ${serie} ohne Fehler · Rekord: ${rekord} · ${stand.simulatorGeloest?.[simulatorArt] ?? 0} gelöst`;
  } else {
    $('kapiteltitel').textContent = kapitel.titel + (ADMIN ? ' (Admin)' : wiederholung ? ' (Wiederholung)' : '');
    const punkte = kapitel.aufgaben.map((_, i) => (i < aufgabeIndex ? '●' : i === aufgabeIndex ? '◉' : '○')).join(' ');
    $('fortschritt').textContent = bonus
      ? `🧩 Bonus-Rätsel – für das Gold-Abzeichen`
      : `Aufgabe ${aufgabeIndex + 1}/${kapitel.aufgaben.length}  ${punkte}`;
  }
  $('gesamt-aufgabe').textContent = gesamtPunkte(stand);
  $('spielername-aufgabe').textContent = stand.name;
  $('rang-aufgabe').textContent = rangText();
  const bisher = simulatorArt ? [] : kapitel.aufgaben.slice(0, aufgabeIndex).map(a => element('span', 'ergebnis', `✔ ${a.merke}`));
  $('ergebnisse').replaceChildren(...bisher);
  $('ergebnisse').hidden = !bisher.length;
  $('geschichte').textContent = aufgabe.geschichte;
  $('frage').textContent = aufgabe.frage;
  $('meldung').textContent = '';
  $('meldung').className = 'meldung';
  $('bonus-ueberspringen').hidden = !bonus;
  $('zurueck').textContent = simulatorArt ? '← Zurück zum Flugsimulator' : '← Zurück zur Übersicht';
  $('tipp').hidden = !ADMIN;
  $('admin-leiste').hidden = !ADMIN;
  $('admin-loesung').textContent = `Lösung: ${aufgabe.loesung}` + (aufgabe.rest !== undefined ? ` Rest ${aufgabe.rest}` : '')
    + (aufgabe.rechnung ? `  (${aufgabe.rechnung})` : '');
  $('rest-teil').hidden = aufgabe.rest === undefined;
  $('antwort-rest').value = '';
  const helferUrl = welt.helferBild ? pfadUrl(welt.helferBild) : bildUrl([welt.helfer]);
  $('helfer-bild').hidden = !helferUrl;
  if (helferUrl) $('helfer-bild').src = helferUrl;
  $('tipp-text').textContent = `${helferUrl ? '' : '🟢 '}${welt.helfer}: „${aufgabe.tipp}“`;
  $('antwort').value = '';
  zeige('aufgabe');
  $('antwort').focus();
}

function meldung(text, klasse) {
  $('meldung').textContent = text;
  $('meldung').className = `meldung ${klasse}`;
}

async function speichern() {
  if (ADMIN) return;
  stand = mitRang(stand); // höchsten erreichten Rang festhalten
  try {
    const antwort = await fetch(`/api/welten/${encodeURIComponent(weltId)}/spielstand`, { method: 'PUT', body: JSON.stringify(stand) });
    if (!antwort.ok) throw new Error(antwort.status);
    $('hinweis').hidden = true;
  } catch {
    $('hinweis').textContent = 'Spielstand konnte nicht gespeichert werden';
    $('hinweis').hidden = false;
  }
}

$('antwort-form').onsubmit = event => {
  event.preventDefault();
  if (wartet) return;
  const eingabe = $('antwort').value.trim();
  if (!eingabe) return;
  const kapitel = welt.kapitel[kapitelIndex];
  const aufgabe = aktuelleAufgabe(kapitel);
  const mitRest = aufgabe.rest !== undefined;
  const restEingabe = $('antwort-rest').value.trim();
  if (mitRest && !restEingabe) return $('antwort-rest').focus(); // erst beide Felder ausfüllen

  if (!istRichtig(eingabe, aufgabe.loesung) || (mitRest && !istRichtig(restEingabe, aufgabe.rest))) {
    fehlversuche++;
    serie = 0;
    if (!ADMIN && !simulatorArt) {
      const schluessel = `${kapitel.id}#${imBonus(kapitel) ? 'Bonus' : aufgabeIndex + 1}`;
      stand = mitFalscherAntwort(stand, schluessel, mitRest ? `${eingabe} Rest ${restEingabe}` : eingabe);
      speichern();
    }
    ton('falsch');
    meldung("Leider nicht – versuch's nochmal!", 'falsch');
    if (fehlversuche >= TIPP_AB) $('tipp').hidden = false;
    $('antwort').value = '';
    $('antwort-rest').value = '';
    $('antwort').focus();
    return;
  }

  wartet = true;
  ton('richtig');
  if (!ADMIN) {
    const schluessel = simulatorArt ? null : `${kapitel.id}#${imBonus(kapitel) ? 'Bonus' : aufgabeIndex + 1}`;
    stand = mitStatistik(stand, rechenarten(aufgabe), fehlversuche, schluessel);
  }
  if (simulatorArt) {
    if (fehlversuche === 0) serie++;
    const rekord = Math.max(stand.simulatorRekord?.[simulatorArt] ?? 0, serie);
    let neues = null;
    if (!ADMIN) {
      stand = { ...stand, simulatorRekord: { ...stand.simulatorRekord, [simulatorArt]: rekord } };
      ({ stand, neuesAbzeichen: neues } = simulatorAufgabeGeloest(stand, simulatorArt));
    }
    speichern();
    const name = SIMULATOR_ARTEN.find(a => a.id === simulatorArt).name;
    meldung((fehlversuche === 0 ? `Richtig! Serie: ${serie}` : 'Richtig!')
      + (neues ? ` – Neues Abzeichen: ${name} ${neues.name} ${neues.symbol}!` : ''), 'richtig');
    weiterTimer = setTimeout(() => { simAufgabe = erzeugeAufgabe(simulatorArt); zeigeAufgabe(); }, neues ? 3000 : 1200);
    return;
  }
  if (imBonus(kapitel)) {
    const neu = !ADMIN && !stand.kapitel[kapitel.id]?.bonus;
    if (!ADMIN) {
      stand = bonusGeloest(stand, kapitel.id);
      speichern();
      $('gesamt-aufgabe').textContent = gesamtPunkte(stand);
    }
    meldung(neu ? `Rätsel gelöst! +${BONUS_PUNKTE} – Gold-Abzeichen!` : 'Rätsel gelöst!', 'richtig');
    weiterTimer = setTimeout(() => zeigeKapitelEnde(kapitel), 1500);
    return;
  }

  if (fehlversuche < TIPP_AB) ohneTipp++;
  if (wiederholung) {
    speichern(); // Statistik
    meldung('Richtig!', 'richtig');
  } else {
    const plus = punkteFuer(fehlversuche);
    stand = aufgabeGeloest(stand, kapitel.id, kapitel.aufgaben.length, fehlversuche);
    speichern();
    $('gesamt-aufgabe').textContent = gesamtPunkte(stand);
    meldung(plus > 10 ? `Richtig! +${plus} – ohne ${welt.helfer}s Hilfe!` : `Richtig! +${plus}`, 'richtig');
  }
  weiterTimer = setTimeout(naechsteAufgabe, 1500);
};

// Nach der letzten Aufgabe: Sterne festhalten (beim Wiederholen nur verbessern), dann Bonus-Rätsel oder Ende.
function aufgabenGeschafft(kapitel) {
  const n = kapitel.aufgaben.length;
  laufSterne = wiederholung ? sterneFuer(ohneTipp, n) : kapitelSterne(stand.kapitel[kapitel.id], n);
  if (!ADMIN) {
    stand = mitSternen(stand, kapitel.id, laufSterne);
    speichern();
  }
}

function naechsteAufgabe() {
  clearTimeout(weiterTimer);
  if (simulatorArt) {
    simAufgabe = erzeugeAufgabe(simulatorArt);
    return zeigeAufgabe();
  }
  const kapitel = welt.kapitel[kapitelIndex];
  if (imBonus(kapitel)) return zeigeKapitelEnde(kapitel);
  aufgabeIndex++;
  if (!imBonus(kapitel)) return zeigeAufgabe();
  aufgabenGeschafft(kapitel);
  if (kapitel.bonus) zeigeAufgabe();
  else zeigeKapitelEnde(kapitel);
}

$('admin-weiter').onclick = naechsteAufgabe;
$('bonus-ueberspringen').onclick = () => {
  clearTimeout(weiterTimer);
  zeigeKapitelEnde(welt.kapitel[kapitelIndex]);
};

function zeigeRuhmeshalle() {
  const erreicht = welt.kapitel.filter(k => stand.abzeichen.includes(k.id)).length;
  const gold = welt.kapitel.filter(k => stand.kapitel[k.id]?.bonus).length;
  const punkte = gesamtPunkte(stand);
  const r = rang(punkte, stand.rangIndex ?? 0);
  $('ruhm-name').textContent = stand.name;
  $('ruhm-rang').textContent = `${r.symbol} ${r.name}`;
  $('ruhm-punkte').textContent = punkte;
  $('ruhm-zusammenfassung').textContent = `${erreicht} von ${welt.kapitel.length} Abzeichen gesammelt · ${gold} davon in Gold 🥇`;
  $('ruhm-naechster').textContent = r.naechster
    ? `Noch ${r.naechster.ab - punkte} Punkte bis zum Rang ${r.naechster.symbol} ${r.naechster.name}!`
    : 'Höchster Rang erreicht – du bist ein Großmeister! 🌟';
  $('ruhm-abzeichen').replaceChildren(...welt.kapitel.map((k, i) => abzeichenKarte(k, i, true)));
  $('ruhm-simulator').replaceChildren(...SIMULATOR_ARTEN.map(a => {
    const d = element('div');
    d.append(simulatorAbzeichenZeile(a.id), a.name, element('small', '', `${stand.simulatorGeloest?.[a.id] ?? 0} gelöst`));
    return d;
  }));
  zeige('ruhmeshalle');
}

// Admin: alle Bilder nach Ordnern, mit den Aufgaben, in denen sie erscheinen können.
function zeigeGalerie() {
  const verwendet = new Map(welt.bilder.map(p => [p, []]));
  welt.kapitel.forEach((k, i) => k.aufgaben.forEach((a, j) => {
    for (const p of findeBilder(welt.bilder, a.bild)) verwendet.get(p).push(`K${kapitelNummer(k, i)}·A${j + 1}`);
  }));
  for (const p of welt.helferBild ? [welt.helferBild] : findeBilder(welt.bilder, [welt.helfer])) verwendet.get(p)?.push('Tipp-Bild');
  const ordner = new Map();
  for (const p of [...welt.bilder].sort()) {
    const name = p.includes('/') ? p.split('/')[0] : '(Hauptordner)';
    if (name !== 'Kapitelbilder') (ordner.get(name) ?? ordner.set(name, []).get(name)).push(p);
  }
  const unbenutzt = [...verwendet].filter(([p, wo]) => !wo.length && !p.startsWith('Kapitelbilder/')).length;
  $('galerie-zusammenfassung').textContent = `${welt.bilder.length} Bilder in ${ordner.size} Ordnern · ${unbenutzt} werden in keiner Aufgabe verwendet`;
  $('galerie-inhalt').replaceChildren(...[...ordner].flatMap(([name, pfade]) => {
    const raster = element('div', 'galerie-raster');
    raster.append(...pfade.map(p => {
      const f = element('figure', verwendet.get(p).length ? '' : 'unbenutzt');
      const img = element('img');
      img.loading = 'lazy';
      img.src = pfadUrl(p);
      img.alt = '';
      const wo = verwendet.get(p);
      f.append(img, element('figcaption', '', p.split('/').pop()), element('small', '', wo.length ? wo.join(', ') : 'nicht verwendet'));
      return f;
    }));
    return [element('h2', '', `${name} (${pfade.length})`), raster];
  }));
  zeige('galerie');
}

$('galerie-knopf').onclick = zeigeGalerie;
$('galerie-zurueck').onclick = zeigeUebersicht;

// Hologramm-Archiv: jedes fertige Kapitel schaltet sein Belohnungsbild frei.
function zeigeArchiv() {
  const mit = welt.kapitel.map((k, i) => [k, i]).filter(([k]) => k.belohnung);
  const frei = mit.filter(([k]) => stand.kapitel[k.id]?.fertig).length;
  $('archiv-zusammenfassung').textContent = `${frei} von ${mit.length} Hologrammen freigeschaltet – jedes geschaffte Kapitel bringt ein neues.`;
  $('archiv-inhalt').replaceChildren(...mit.map(([k, i]) => {
    const offen = stand.kapitel[k.id]?.fertig;
    const f = element(offen ? 'button' : 'figure', offen ? 'holo' : 'holo gesperrt');
    const img = element('img');
    img.src = pfadUrl(k.belohnung);
    img.alt = offen ? k.titel : '';
    img.loading = 'lazy';
    if (offen) f.onclick = () => zeigeBildansicht(img.src, `Kapitel ${kapitelNummer(k, i)} · ${k.titel}`);
    f.append(img, element('span', '', `${offen ? '' : '🔒 '}Kapitel ${kapitelNummer(k, i)} · ${k.titel}`));
    return f;
  }));
  zeige('archiv');
}

// Die vier Simulator-Abzeichen einer Rechenart – erreichte farbig, fehlende blass.
function simulatorAbzeichenZeile(art) {
  const anzahl = stand.simulatorGeloest?.[art] ?? 0;
  const zeile = element('span', 'sim-abzeichen');
  zeile.append(...SIMULATOR_STUFEN.map(st => {
    const e = element('span', anzahl >= st.ab ? '' : 'fehlt', st.symbol);
    e.title = `${st.name}: ab ${st.ab} gelösten Aufgaben`;
    return e;
  }));
  return zeile;
}

// Großansicht eines Archiv-Bildes über der Seite, schließen mit Zurück, Esc oder Klick daneben.
function zeigeBildansicht(src, titel) {
  $('bildansicht-bild').src = src;
  $('bildansicht-titel').textContent = titel;
  $('bildansicht').hidden = false;
  $('bildansicht-zurueck').focus();
}
const schliesseBildansicht = () => { $('bildansicht').hidden = true; };
$('bildansicht-zurueck').onclick = schliesseBildansicht;
$('bildansicht').onclick = e => { if (e.target === $('bildansicht')) schliesseBildansicht(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('bildansicht').hidden) schliesseBildansicht(); });

function zeigeSimulatorMenu() {
  $('simulator-arten').replaceChildren(...SIMULATOR_ARTEN.map(a => {
    const b = element('button', 'kachel offen');
    const text = element('div');
    text.append(element('b', '', a.name), simulatorAbzeichenZeile(a.id),
      element('small', '', `${stand.simulatorGeloest?.[a.id] ?? 0} gelöst · Rekord: ${stand.simulatorRekord?.[a.id] ?? 0} in Folge`));
    b.append(text);
    b.onclick = () => starteSimulator(a.id);
    return b;
  }));
  zeige('simulator');
}

function starteSimulator(art) {
  simulatorArt = art;
  serie = 0;
  simAufgabe = erzeugeAufgabe(art);
  zeigeAufgabe();
}

// Admin: wo hakt es? Je Rechenart Fehlversuche pro Aufgabe und Anteil mit Tipp, dazu die schwierigsten Aufgaben.
function zeigeStatistik() {
  const st = stand.statistik ?? { arten: {}, aufgaben: {} };
  const zeilen = Object.entries(st.arten)
    .map(([art, a]) => ({ art, ...a, schnitt: a.fehlversuche / a.aufgaben }))
    .sort((x, y) => y.schnitt - x.schnitt);
  const kopf = element('tr');
  for (const t of ['Rechenart', 'Gelöst', 'Fehlversuche', 'Ø pro Aufgabe', 'Mit Tipp']) kopf.append(element('th', '', t));
  $('statistik-arten').replaceChildren(kopf, ...(zeilen.length ? zeilen.map(z => {
    const tr = element('tr', z.schnitt >= 1 ? 'schwer' : '');
    for (const t of [RECHENART_NAMEN[z.art] ?? z.art, z.aufgaben, z.fehlversuche, z.schnitt.toFixed(1), `${Math.round(100 * z.mitTipp / z.aufgaben)} %`]) tr.append(element('td', '', t));
    return tr;
  }) : [(() => { const tr = element('tr'); tr.append(element('td', '', 'Noch keine Daten – es wird ab jetzt mitgezählt.')); return tr; })()]));

  // Je schwierige Aufgabe: Frage, Rechnung mit richtiger Lösung und die falsch eingegebenen Antworten.
  const eintrag = (schluessel, n) => {
    const li = element('li');
    const [id, nr] = schluessel.split('#');
    const i = welt.kapitel.findIndex(k => k.id === id);
    const k = welt.kapitel[i];
    const a = k && (nr === 'Bonus' ? k.bonus : k.aufgaben[Number(nr) - 1]);
    if (!a) {
      li.append(`${n} Fehlversuche – ${schluessel}`);
      return li;
    }
    const loesung = a.loesung + (a.rest !== undefined ? ` Rest ${a.rest}` : '');
    const rechnung = a.rechnung ? `Rechnung: ${a.rechnung.replaceAll('*', '·').replaceAll('/', ':')} = ${loesung}` : `Lösung: ${loesung}`;
    const falsch = st.falsch?.[schluessel];
    li.append(
      element('b', '', `${n} Fehlversuche – Kapitel ${kapitelNummer(k, i)}, ${nr === 'Bonus' ? 'Bonus-Rätsel' : `Aufgabe ${nr}`}: ${a.frage}`),
      element('div', 'aufgabe-geschichte', a.geschichte),
      element('div', '', rechnung),
      element('div', 'falsche-antworten', `Falsch eingegeben: ${falsch?.length ? falsch.join(', ') : '(noch nicht erfasst)'}`),
    );
    return li;
  };
  const anzahl = { ...Object.fromEntries(Object.entries(st.falsch ?? {}).map(([s, l]) => [s, l.length])), ...st.aufgaben };
  const schwer = Object.entries(anzahl).sort((x, y) => y[1] - x[1]).slice(0, 10);
  $('statistik-aufgaben').replaceChildren(...(schwer.length
    ? schwer.map(([s, n]) => eintrag(s, n))
    : [element('li', '', 'Noch keine Fehlversuche erfasst.')]));
  zeige('statistik');
}

$('simulator-knopf').onclick = zeigeSimulatorMenu;
$('statistik-knopf').onclick = zeigeStatistik;
for (const b of document.querySelectorAll('.zur-uebersicht')) b.onclick = zeigeUebersicht;

function zeigeKapitelEnde(kapitel) {
  const s = stand.kapitel[kapitel.id];
  const gold = Boolean(s?.bonus);
  $('overlay-symbol').textContent = kapitel.abzeichen.symbol;
  $('overlay-symbol').classList.toggle('gold', gold);
  $('overlay-sterne').textContent = laufSterne ? sterneText(laufSterne) : '';
  const goldText = gold ? ' 🥇 Gold-Abzeichen!' : kapitel.bonus ? ' Löse das Bonus-Rätsel für Gold!' : '';
  if (wiederholung) {
    $('overlay-titel').textContent = 'Mission erneut geschafft!';
    $('overlay-text').textContent = `${kapitel.titel} – beste Wertung: ${sterneText(kapitelSterne(s, kapitel.aufgaben.length))}.${goldText}`;
  } else {
    $('overlay-titel').textContent = `Neues Abzeichen: ${kapitel.abzeichen.name}!`;
    $('overlay-text').textContent = `${s.punkte} von ${maxPunkte(kapitel)} Punkten in „${kapitel.titel}“.${goldText}`;
  }
  // Belohnungsbild zeigen, wenn das Kapitel gerade zum ersten Mal geschafft wurde
  $('overlay-belohnung').hidden = wiederholung || !kapitel.belohnung;
  if (kapitel.belohnung) $('overlay-belohnung').querySelector('img').src = pfadUrl(kapitel.belohnung);
  $('overlay').hidden = false;
  $('overlay-weiter').focus();
}

$('overlay-weiter').onclick = () => {
  $('overlay').hidden = true;
  zeigeUebersicht();
};

$('spielername').onclick = () => {
  const neu = prompt('Wie heißt der Pilot?', stand.name);
  if (neu === null) return;
  stand = mitName(stand, neu);
  speichern();
  $('spielername').textContent = stand.name;
};

$('zurueck').onclick = () => {
  clearTimeout(weiterTimer);
  if (simulatorArt) zeigeSimulatorMenu();
  else zeigeUebersicht();
};

start().catch(() => {
  document.body.textContent = 'Das Spiel konnte nicht geladen werden. Läuft der Server (start.bat)?';
});

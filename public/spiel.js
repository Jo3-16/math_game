import {
  findeBilder, istRichtig, punkteFuer, TIPP_AB, leererStand, kapitelStatus, aufgabeGeloest, gesamtPunkte, mitName,
  rang, sterneFuer, kapitelSterne, mitSternen, bonusGeloest, BONUS_PUNKTE,
} from './logik.js';

const $ = id => document.getElementById(id);
const ANSICHTEN = ['auswahl', 'uebersicht', 'aufgabe', 'ruhmeshalle', 'galerie'];
// Admin-Modus (/admin): alle Kapitel offen, Aufgaben überspringen, Lösung sichtbar, nichts wird gespeichert.
const ADMIN = location.pathname === '/admin';

let welt, weltId, stand;
let kapitelIndex, aufgabeIndex, fehlversuche, wiederholung, wartet, weiterTimer;
let ohneTipp, laufSterne; // im aktuellen Durchlauf ohne Tipp gelöste Aufgaben, Sterne dieses Durchlaufs

function zeige(ansicht) {
  for (const a of ANSICHTEN) $(a).hidden = a !== ansicht;
}

function element(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

const kapitelNummer = (k, i) => Number(k.id.match(/^\d+/)?.[0] ?? i + 1);
const sterneText = n => '⭐'.repeat(n) + '☆'.repeat(3 - n);
const maxPunkte = k => k.aufgaben.length * 15 + (k.bonus ? BONUS_PUNKTE : 0);
const rangText = () => { const r = rang(gesamtPunkte(stand)); return `${r.symbol} ${r.name}`; };

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
  stand = mitName(stand);
  for (const [name, wert] of Object.entries(welt.farben ?? {})) document.documentElement.style.setProperty(`--${name}`, wert);
  document.title = welt.name;
  $('weltname').textContent = welt.name + (ADMIN ? ' – Admin-Modus' : '');
  $('galerie-knopf').hidden = !ADMIN;
  if (location.pathname === '/abzeichen') zeigeRuhmeshalle();
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
  zeige('uebersicht');
}

function starteKapitel(index, alsWiederholung) {
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

const imBonus = kapitel => aufgabeIndex >= kapitel.aufgaben.length;

// Die normale Aufgabe – oder nach der letzten Aufgabe das Bonus-Rätsel (mit dem Bild der letzten Aufgabe).
function aktuelleAufgabe(kapitel) {
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

  $('kapiteltitel').textContent = kapitel.titel + (ADMIN ? ' (Admin)' : wiederholung ? ' (Wiederholung)' : '');
  const punkte = kapitel.aufgaben.map((_, i) => (i < aufgabeIndex ? '●' : i === aufgabeIndex ? '◉' : '○')).join(' ');
  $('fortschritt').textContent = bonus
    ? `🧩 Bonus-Rätsel – für das Gold-Abzeichen`
    : `Aufgabe ${aufgabeIndex + 1}/${kapitel.aufgaben.length}  ${punkte}`;
  $('gesamt-aufgabe').textContent = gesamtPunkte(stand);
  $('spielername-aufgabe').textContent = stand.name;
  $('rang-aufgabe').textContent = rangText();
  const bisher = kapitel.aufgaben.slice(0, aufgabeIndex).map(a => element('span', 'ergebnis', `✔ ${a.merke}`));
  $('ergebnisse').replaceChildren(...bisher);
  $('ergebnisse').hidden = !bisher.length;
  $('geschichte').textContent = aufgabe.geschichte;
  $('frage').textContent = aufgabe.frage;
  $('meldung').textContent = '';
  $('meldung').className = 'meldung';
  $('bonus-ueberspringen').hidden = !bonus;
  $('tipp').hidden = !ADMIN;
  $('admin-leiste').hidden = !ADMIN;
  $('admin-loesung').textContent = `Lösung: ${aufgabe.loesung}` + (aufgabe.rechnung ? `  (${aufgabe.rechnung})` : '');
  const helferUrl = bildUrl([welt.helfer]);
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

  if (!istRichtig(eingabe, aufgabe.loesung)) {
    fehlversuche++;
    ton('falsch');
    meldung("Leider nicht – versuch's nochmal!", 'falsch');
    if (fehlversuche >= TIPP_AB) $('tipp').hidden = false;
    $('antwort').value = '';
    $('antwort').focus();
    return;
  }

  wartet = true;
  ton('richtig');
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
  const r = rang(punkte);
  $('ruhm-name').textContent = stand.name;
  $('ruhm-rang').textContent = `${r.symbol} ${r.name}`;
  $('ruhm-punkte').textContent = punkte;
  $('ruhm-zusammenfassung').textContent = `${erreicht} von ${welt.kapitel.length} Abzeichen gesammelt · ${gold} davon in Gold 🥇`;
  $('ruhm-naechster').textContent = r.naechster
    ? `Noch ${r.naechster.ab - punkte} Punkte bis zum Rang ${rang(r.naechster.ab).symbol} ${r.naechster.name}!`
    : 'Höchster Rang erreicht – du bist ein Jedi-Meister! 🧙';
  $('ruhm-abzeichen').replaceChildren(...welt.kapitel.map((k, i) => abzeichenKarte(k, i, true)));
  zeige('ruhmeshalle');
}

// Admin: alle Bilder nach Ordnern, mit den Aufgaben, in denen sie erscheinen können.
function zeigeGalerie() {
  const verwendet = new Map(welt.bilder.map(p => [p, []]));
  welt.kapitel.forEach((k, i) => k.aufgaben.forEach((a, j) => {
    for (const p of findeBilder(welt.bilder, a.bild)) verwendet.get(p).push(`K${kapitelNummer(k, i)}·A${j + 1}`);
  }));
  for (const p of findeBilder(welt.bilder, [welt.helfer])) verwendet.get(p).push('Tipp-Bild');
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
  zeigeUebersicht();
};

start().catch(() => {
  document.body.textContent = 'Das Spiel konnte nicht geladen werden. Läuft der Server (start.bat)?';
});

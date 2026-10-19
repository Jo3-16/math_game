import { findeBilder, istRichtig, punkteFuer, TIPP_AB, leererStand, kapitelStatus, aufgabeGeloest, gesamtPunkte, mitName } from './logik.js';

const $ = id => document.getElementById(id);
const ANSICHTEN = ['auswahl', 'uebersicht', 'aufgabe', 'ruhmeshalle', 'galerie'];
// Admin-Modus (/admin): alle Kapitel offen, Aufgaben überspringen, Lösung sichtbar, nichts wird gespeichert.
const ADMIN = location.pathname === '/admin';

let welt, weltId, stand;
let kapitelIndex, aufgabeIndex, fehlversuche, wiederholung, wartet, weiterTimer;

function zeige(ansicht) {
  for (const a of ANSICHTEN) $(a).hidden = a !== ansicht;
}

function element(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text !== undefined) e.textContent = text;
  return e;
}

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

function zeigeUebersicht() {
  const status = kapitelStatus(stand, welt.kapitel.map(k => k.id));
  $('kapitel').replaceChildren(...welt.kapitel.map((k, i) => {
    const s = stand.kapitel[k.id];
    const b = element('button', `kachel ${status[i]}`);
    const zeile = {
      fertig: `✅ ${s?.punkte ?? 0}/${k.aufgaben.length * 15} Punkte – nochmal spielen`,
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

  const abzeichen = welt.kapitel.filter(k => stand.abzeichen.includes(k.id));
  $('abzeichen').replaceChildren(...(abzeichen.length
    ? abzeichen.map(k => {
        const d = element('div');
        d.append(element('span', '', k.abzeichen.symbol), k.abzeichen.name);
        return d;
      })
    : [element('p', '', "Noch keine Abzeichen – auf geht's!")]));

  $('gesamt-uebersicht').textContent = gesamtPunkte(stand);
  $('spielername').textContent = stand.name;
  zeige('uebersicht');
}

function starteKapitel(index, alsWiederholung) {
  kapitelIndex = index;
  wiederholung = alsWiederholung;
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

function zeigeAufgabe() {
  const kapitel = welt.kapitel[kapitelIndex];
  const aufgabe = kapitel.aufgaben[aufgabeIndex];
  fehlversuche = 0;
  wartet = false;

  const url = bildUrl(aufgabe.bild);
  $('bild').hidden = !url;
  if (url) $('bild').src = url;

  $('kapiteltitel').textContent = kapitel.titel + (ADMIN ? ' (Admin)' : wiederholung ? ' (Wiederholung)' : '');
  const punkte = kapitel.aufgaben.map((_, i) => (i < aufgabeIndex ? '●' : i === aufgabeIndex ? '◉' : '○')).join(' ');
  $('fortschritt').textContent = `Aufgabe ${aufgabeIndex + 1}/${kapitel.aufgaben.length}  ${punkte}`;
  $('gesamt-aufgabe').textContent = gesamtPunkte(stand);
  $('spielername-aufgabe').textContent = stand.name;
  const bisher = kapitel.aufgaben.slice(0, aufgabeIndex).map(a => element('span', 'ergebnis', `✔ ${a.merke}`));
  $('ergebnisse').replaceChildren(...bisher);
  $('ergebnisse').hidden = !bisher.length;
  $('geschichte').textContent = aufgabe.geschichte;
  $('frage').textContent = aufgabe.frage;
  $('meldung').textContent = '';
  $('meldung').className = 'meldung';
  $('tipp').hidden = !ADMIN;
  $('admin-leiste').hidden = !ADMIN;
  $('admin-loesung').textContent = `Lösung: ${aufgabe.loesung}  (${aufgabe.rechnung})`;
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
  const aufgabe = kapitel.aufgaben[aufgabeIndex];

  if (!istRichtig(eingabe, aufgabe.loesung)) {
    fehlversuche++;
    meldung("Leider nicht – versuch's nochmal!", 'falsch');
    if (fehlversuche >= TIPP_AB) $('tipp').hidden = false;
    $('antwort').value = '';
    $('antwort').focus();
    return;
  }

  wartet = true;
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

function naechsteAufgabe() {
  clearTimeout(weiterTimer);
  const kapitel = welt.kapitel[kapitelIndex];
  aufgabeIndex++;
  if (aufgabeIndex < kapitel.aufgaben.length) zeigeAufgabe();
  else zeigeKapitelEnde(kapitel);
}

$('admin-weiter').onclick = naechsteAufgabe;

const kapitelNummer = (k, i) => Number(k.id.match(/^\d+/)?.[0] ?? i + 1);

function zeigeRuhmeshalle() {
  const erreicht = welt.kapitel.filter(k => stand.abzeichen.includes(k.id)).length;
  $('ruhm-name').textContent = stand.name;
  $('ruhm-punkte').textContent = gesamtPunkte(stand);
  $('ruhm-zusammenfassung').textContent = `${erreicht} von ${welt.kapitel.length} Abzeichen gesammelt`;
  $('ruhm-abzeichen').replaceChildren(...welt.kapitel.map((k, i) => {
    const hat = stand.abzeichen.includes(k.id);
    const d = element('div', hat ? '' : 'offen');
    const punkte = `Kapitel ${kapitelNummer(k, i)} · ${stand.kapitel[k.id]?.punkte ?? 0}/${k.aufgaben.length * 15} Punkte`;
    d.append(element('span', '', k.abzeichen.symbol), hat ? k.abzeichen.name : '???', element('small', '', punkte));
    d.title = k.titel;
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
  $('overlay-symbol').textContent = kapitel.abzeichen.symbol;
  if (wiederholung) {
    $('overlay-titel').textContent = 'Mission erneut geschafft!';
    $('overlay-text').textContent = kapitel.titel;
  } else {
    $('overlay-titel').textContent = `Neues Abzeichen: ${kapitel.abzeichen.name}!`;
    $('overlay-text').textContent = `${stand.kapitel[kapitel.id].punkte} von ${kapitel.aufgaben.length * 15} Punkten in „${kapitel.titel}“`;
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

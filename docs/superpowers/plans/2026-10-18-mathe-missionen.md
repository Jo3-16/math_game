# Mathe-Missionen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lokales Browser-Lernspiel: Mathe-Sachaufgaben (4. Klasse, ≤ 500) als Star-Wars-Geschichte in Kapiteln, mit Bildern aus einem Ordner, Yoda-Tipps, Punkten, Abzeichen und gespeichertem Spielstand.

**Architecture:** Ein Node-Server ohne Abhängigkeiten (`server.js`) liefert die Seite, die Welten/Kapitel/Bilder und speichert `spielstand.json`. Die reine Spiellogik (Bildsuche, Rechnungs-Parser, Punkte, Spielstand-Übergänge) liegt in einem ES-Modul `public/logik.js`, das Browser, Server-Tests und das Prüfskript `pruefe.js` gemeinsam nutzen. Das Frontend (`public/spiel.js`) ist dünnes DOM-Gerüst um diese Logik.

**Tech Stack:** Node 24 (ES-Module, `node:test`, `node:http`), reines HTML/CSS/JS ohne Framework, kein Build, keine npm-Pakete.

**Spec:** `docs/superpowers/specs/2026-10-18-mathe-missionen-design.md`

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. `package.json` nur mit `"type": "module"` und `"scripts": {"test": "node --test"}`.
- Server lauscht nur auf `127.0.0.1`, Port **8642**.
- Zahlenraum: Lösung, alle Zahlen und alle Zwischenergebnisse einer `rechnung` ≤ **500**, ganzzahlig, ≥ 0; Teilen ohne Rest.
- Punkte: **10** pro gelöster Aufgabe, **+5** wenn gelöst mit ≤ 1 Fehlversuch (Tipp erscheint ab **2** Fehlversuchen). Fehlversuche kosten nichts.
- Wiederholung eines fertigen Kapitels: kein Speichern, keine Punkte, kein doppeltes Abzeichen.
- Kapitel 4–6 Aufgaben; Reihenfolge = Dateiname; Kapitel-ID = Dateiname ohne `.json`.
- Alle Texte im Spiel auf Deutsch.
- Layout B: Bild links, Geschichte/Frage/Eingabe rechts, kein Scrollen auf PC-Bildschirm.

## Review Focus

1. **Umlaute in Dateinamen in verschiedenen Unicode-Formen** (`ö` als NFC oder NFD, z. B. von einem Mac kopiert) – `sternzerstörer` muss trotzdem passen. → Test in Task 1 (`normalisiere` macht NFC + ä→ae).
2. **Bildpfade mit Umlauten und Leerzeichen in URLs** (`Sternzerstörer/tie fighter.jpg`) müssen im Browser laden. → Test in Task 3 (`GET` mit encodiertem Pfad liefert 200).
3. **Eingaben wie `" 12 "`, `"12."`, `"zwölf"`, `""`** – Leerzeichen tolerieren, alles Nicht-Ziffern ist schlicht falsch (kein Absturz, zählt als Fehlversuch nur wenn nicht leer). → Test in Task 1 (`istRichtig`).
4. **Kaputte oder fehlende `spielstand.json`** (gelöscht zum Zurücksetzen, halb geschrieben) – Spiel startet mit leerem Stand statt Fehlerseite; Schreiben atomar. → Test in Task 3.
5. **Pfad-Ausbruch** (`/welten/../server.js`, `..%2F`) – Server liefert 404, nie Dateien außerhalb des Projekts. → Test in Task 3.

---

## File Structure

```
package.json              type: module, test-Script
.gitignore                .superpowers/, welten/*/spielstand.json, welten/*/bilder/
server.js                 HTTP-Server + API; export starte({wurzel, port})
pruefe.js                 Prüfskript; export pruefeWelt(weltOrdner) → {fehler[], warnungen[]}
start.bat                 Doppelklick-Start
CLAUDE.md                 Regeln zum Erzeugen neuer Kapitel
public/index.html         Gerüst (Übersicht + Aufgabenseite + Abzeichen-Overlay)
public/style.css          Layout B, Farben über CSS-Variablen
public/logik.js           reine Logik (Browser + Node)
public/spiel.js           DOM/Ablauf
test/logik.test.js
test/server.test.js
test/pruefe.test.js
welten/starwars/welt.json
welten/starwars/bilder/   (bisheriger Ordner Bilder/, Unterordner bleiben)
welten/starwars/kapitel/01-….json …
```

---

### Task 1: Projekt + Grundlogik (Bildsuche, Rechnung, Eingabe, Punkte)

**Files:**
- Create: `package.json`, `.gitignore`, `public/logik.js`, `test/logik.test.js`

**Interfaces:**
- Produces (alle `export` aus `public/logik.js`):
  - `normalisiere(text: string) → string` – NFC, Kleinbuchstaben, `ä→ae ö→oe ü→ue ß→ss`, jede Folge aus `_`, `-`, Leerzeichen, `/`, `\` → ein Leerzeichen, getrimmt.
  - `findeBilder(pfade: string[], suchwoerter: string[]) → string[]` – alle Pfade (relativ zum Bilder-Ordner, mit `/`), deren `normalisiere(pfad)` irgendein `normalisiere(suchwort)` enthält.
  - `rechne(rechnung: string) → {wert: number} | {fehler: string}` – siehe Step 3.
  - `istRichtig(eingabe: string, loesung: number) → boolean`
  - `punkteFuer(fehlversuche: number) → number` – 15 bei 0–1, sonst 10.
  - Konstanten `MAX_ZAHL = 500`, `TIPP_AB = 2`.

- [ ] **Step 1: Projekt anlegen**

`git init` im Projektordner. `package.json`: `{"name":"mathe-missionen","private":true,"type":"module","scripts":{"test":"node --test","start":"node server.js --open"}}`. `.gitignore`: `.superpowers/`, `welten/*/spielstand.json`, `welten/*/bilder/`.

- [ ] **Step 2: Failing tests schreiben** (`test/logik.test.js`, `node:test` + `node:assert/strict`)

```js
test('normalisiere', () => {
  assert.equal(normalisiere('X-wing_SWB.webp'), 'x wing swb.webp');
  assert.equal(normalisiere('Sternzerstörer'.normalize('NFD')), 'sternzerstoerer');
  assert.equal(normalisiere('Sternzerstörer/tie  fighter.jpg'), 'sternzerstoerer tie fighter.jpg');
});
test('findeBilder', () => {
  const p = ['X-wing_SWB.webp', 'Sternzerstörer/537558-Mac.jpg', 'sterzerstörer_Star-Destroyer_ab6b.jpeg', 'tie fighter.jpg'];
  assert.deepEqual(findeBilder(p, ['x wing']), ['X-wing_SWB.webp']);
  assert.deepEqual(findeBilder(p, ['sternzerstörer', 'star-destroyer']), ['Sternzerstörer/537558-Mac.jpg', 'sterzerstörer_Star-Destroyer_ab6b.jpeg']);
  assert.deepEqual(findeBilder(p, ['tie_fighter']), ['tie fighter.jpg']);
  assert.deepEqual(findeBilder(p, ['ewok']), []);
});
test('rechne', () => {
  assert.deepEqual(rechne('12 / 4'), { wert: 3 });
  assert.deepEqual(rechne('3 * 8 / 2'), { wert: 12 });
  assert.deepEqual(rechne('(120 + 30) - 4 * 5'), { wert: 130 });
  assert.ok(rechne('7 / 2 * 2').fehler);       // Rest bei Zwischenschritt
  assert.ok(rechne('300 + 300 - 200').fehler); // Zwischenergebnis > 500
  assert.ok(rechne('501').fehler);
  assert.ok(rechne('5 - 8').fehler);           // negativ
  assert.ok(rechne('alert(1)').fehler);
  assert.ok(rechne('3 *').fehler);
});
test('istRichtig', () => {
  assert.equal(istRichtig(' 12 ', 12), true);
  assert.equal(istRichtig('12', 13), false);
  for (const e of ['', '12.', 'zwölf', '1e1', '-12']) assert.equal(istRichtig(e, 12), false);
});
test('punkteFuer', () => {
  assert.equal(punkteFuer(0), 15); assert.equal(punkteFuer(1), 15); assert.equal(punkteFuer(2), 10);
});
```

- [ ] **Step 3: Run `npm test`** → FAIL (Modul fehlt).

- [ ] **Step 4: `public/logik.js` implementieren**

`rechne` ist ein kleiner Recursive-Descent-Parser (kein `eval`): Tokens = Ganzzahlen, `+ - * /`, Klammern; Grammatik `ausdruck = term (('+'|'-') term)*`, `term = faktor (('*'|'/') faktor)*`, `faktor = zahl | '(' ausdruck ')'`. Nach **jeder** Operation prüfen: Ergebnis ganzzahlig (bei `/` Rest 0), 0 ≤ Ergebnis ≤ `MAX_ZAHL`; jede Zahl ≤ `MAX_ZAHL`. Erste Verletzung → `{fehler: '<Beschreibung>'}`. Unbekanntes Zeichen / übrige Tokens → Fehler. `istRichtig`: `/^\d+$/` auf getrimmte Eingabe, dann `Number(...) === loesung`.

- [ ] **Step 5: Run `npm test`** → PASS.

- [ ] **Step 6: Commit** `git add -A && git commit -m "feat: Grundlogik (Bildsuche, Rechnung, Punkte)"`

---

### Task 2: Spielstand-Logik

**Files:**
- Modify: `public/logik.js`, `test/logik.test.js`

**Interfaces:**
- Consumes: `punkteFuer` aus Task 1.
- Produces (`export` aus `public/logik.js`):
  - Typ Spielstand: `{kapitel: {[id]: {geloest: number, punkte: number, fertig: boolean}}, abzeichen: string[]}`
  - `leererStand() → Spielstand`
  - `kapitelStatus(stand, kapitelIds: string[]) → ('fertig'|'offen'|'gesperrt')[]` – alle `fertig` sind `'fertig'`; das erste nicht fertige ist `'offen'`; alle danach `'gesperrt'`.
  - `aufgabeGeloest(stand, kapitelId, anzahlAufgaben, fehlversuche) → Spielstand` – **neues** Objekt; `geloest+1`, `punkte += punkteFuer(fehlversuche)`; wird `geloest === anzahlAufgaben` → `fertig: true` und `kapitelId` an `abzeichen` (nur wenn noch nicht drin).
  - `gesamtPunkte(stand) → number`

- [ ] **Step 1: Failing tests**

```js
test('kapitelStatus', () => {
  const s = { kapitel: { a: { geloest: 5, punkte: 75, fertig: true }, b: { geloest: 2, punkte: 25, fertig: false } }, abzeichen: ['a'] };
  assert.deepEqual(kapitelStatus(s, ['a', 'b', 'c']), ['fertig', 'offen', 'gesperrt']);
  assert.deepEqual(kapitelStatus(leererStand(), ['a', 'b']), ['offen', 'gesperrt']);
});
test('aufgabeGeloest bis Kapitelende', () => {
  let s = leererStand();
  s = aufgabeGeloest(s, 'a', 2, 0);
  assert.deepEqual(s.kapitel.a, { geloest: 1, punkte: 15, fertig: false });
  const vorher = s;
  s = aufgabeGeloest(s, 'a', 2, 3);
  assert.deepEqual(s.kapitel.a, { geloest: 2, punkte: 25, fertig: true });
  assert.deepEqual(s.abzeichen, ['a']);
  assert.equal(vorher.kapitel.a.geloest, 1); // nicht mutiert
  assert.equal(gesamtPunkte(s), 25);
});
```

- [ ] **Step 2: Run `npm test`** → FAIL.
- [ ] **Step 3: Implementieren** (`structuredClone` für die Kopie).
- [ ] **Step 4: Run `npm test`** → PASS.
- [ ] **Step 5: Commit** `feat: Spielstand-Logik`

---

### Task 3: Server

**Files:**
- Create: `server.js`, `test/server.test.js`

**Interfaces:**
- Consumes: nichts aus `logik.js` (Server bleibt dumm).
- Produces:
  - `export function starte({wurzel = Projektordner, port = 8642}) → Promise<http.Server>`; bei Direktaufruf `node server.js [--open]` startet er, loggt die URL und öffnet mit `--open` den Browser (`exec('start "" http://localhost:8642')`).
  - HTTP-API (JSON, UTF-8):
    - `GET /` und `GET /<datei>` → Dateien aus `public/`
    - `GET /api/welten` → `[{id, name}]` (Unterordner von `welten/` mit `welt.json`)
    - `GET /api/welten/:welt` → `{...welt.json, kapitel: [{id, ...kapitelJson}] (nach Dateiname sortiert), bilder: string[] (rekursiv, relativ zu bilder/, mit '/', nur .jpg .jpeg .png .webp, Groß/klein egal)}`
    - `GET /welten/:welt/bilder/<pfad>` → Bilddatei (Pfadsegmente URL-dekodiert)
    - `GET /api/welten/:welt/spielstand` → Inhalt von `spielstand.json`, oder `null` wenn fehlend/kaputt
    - `PUT /api/welten/:welt/spielstand` → Body (JSON) atomar speichern (in `spielstand.json.tmp` schreiben, dann `rename`); 204
  - Jeder aufgelöste Pfad muss innerhalb von `wurzel/public` bzw. `wurzel/welten/<welt>` liegen, sonst 404. Unbekannte Welt → 404.

- [ ] **Step 1: Failing tests** – jeder Test baut in `fs.mkdtempSync(os.tmpdir())` eine Mini-Welt (`welten/testwelt/welt.json`, `kapitel/02-b.json`, `kapitel/01-a.json`, `bilder/Sternzerstörer/tie fighter.jpg`, `bilder/x.webp`, `bilder/notiz.txt`), kopiert nichts aus `public/` außer einer leeren `public/index.html`, startet `starte({wurzel, port: 0})` und nutzt `fetch`.

```js
test('welt laden', async () => {
  const w = await (await fetch(`${url}/api/welten/testwelt`)).json();
  assert.deepEqual(w.kapitel.map(k => k.id), ['01-a', '02-b']);
  assert.deepEqual(w.bilder.sort(), ['Sternzerstörer/tie fighter.jpg', 'x.webp']);
});
test('bild mit umlaut und leerzeichen', async () => {
  const pfad = 'Sternzerstörer/tie fighter.jpg'.split('/').map(encodeURIComponent).join('/');
  assert.equal((await fetch(`${url}/welten/testwelt/bilder/${pfad}`)).status, 200);
});
test('pfad-ausbruch', async () => {
  for (const p of ['/welten/testwelt/bilder/..%2F..%2F..%2Fserver.js', '/..%2Fpackage.json', '/api/welten/..%2F..'])
    assert.equal((await fetch(url + p)).status, 404);
});
test('spielstand', async () => {
  assert.equal(await (await fetch(`${url}/api/welten/testwelt/spielstand`)).json(), null);
  const s = { kapitel: {}, abzeichen: ['01-a'] };
  assert.equal((await fetch(`${url}/api/welten/testwelt/spielstand`, { method: 'PUT', body: JSON.stringify(s) })).status, 204);
  assert.deepEqual(await (await fetch(`${url}/api/welten/testwelt/spielstand`)).json(), s);
  fs.writeFileSync(path.join(wurzel, 'welten/testwelt/spielstand.json'), '{kaputt');
  assert.equal(await (await fetch(`${url}/api/welten/testwelt/spielstand`)).json(), null);
});
```

- [ ] **Step 2: Run `npm test`** → FAIL.
- [ ] **Step 3: `server.js` implementieren** (`node:http`, `node:fs/promises`, `fs.readdir(..., {recursive: true})`; Content-Type per Endungstabelle für html/css/js/json/jpg/jpeg/png/webp; PUT-Body muss gültiges JSON sein, sonst 400).
- [ ] **Step 4: Run `npm test`** → PASS.
- [ ] **Step 5: Commit** `feat: lokaler Server`

---

### Task 4: Prüfskript

**Files:**
- Create: `pruefe.js`, `test/pruefe.test.js`

**Interfaces:**
- Consumes: `rechne`, `findeBilder` aus `public/logik.js`.
- Produces: `export async function pruefeWelt(weltOrdner: string) → {fehler: string[], warnungen: string[]}`. Direktaufruf `node pruefe.js` prüft alle Welten unter `welten/`, gibt jede Meldung als `<kapitel-datei> Aufgabe <n>: <text>` aus, Exit-Code 1 bei Fehlern, sonst 0 mit `OK: <x> Kapitel geprüft`.

Fehler: ungültiges JSON; fehlt `titel`, `abzeichen.name`, `abzeichen.symbol`, `aufgaben`; Aufgabenzahl nicht 4–6; in einer Aufgabe fehlt/leer `bild` (nichtleeres Array), `geschichte`, `frage`, `rechnung`, `loesung`, `tipp`; `rechne(rechnung)` liefert `fehler`; `wert !== loesung`. Fehlt `welt.json` (`name`, `helfer`, `farben`) → Fehler. Warnung: `findeBilder` liefert `[]` für eine Aufgabe.

- [ ] **Step 1: Failing tests** – temporäre Welt mit einem gültigen Kapitel (4 Aufgaben, Bild `x-wing.jpg` vorhanden) und Varianten:

```js
test('gültiges kapitel', async () => assert.deepEqual(await pruefeWelt(ok), { fehler: [], warnungen: [] }));
test('falsche loesung', async () => { /* loesung 4 bei '12 / 4' */ assert.match((await pruefeWelt(w)).fehler[0], /Aufgabe 1/); });
test('zahl über 500', async () => { /* rechnung '250 * 3' */ assert.equal((await pruefeWelt(w)).fehler.length, 1); });
test('fehlendes bild nur warnung', async () => { /* bild ['ewok'] */ const r = await pruefeWelt(w); assert.equal(r.fehler.length, 0); assert.equal(r.warnungen.length, 1); });
test('zu wenige aufgaben', async () => { /* 3 Aufgaben */ assert.equal((await pruefeWelt(w)).fehler.length, 1); });
```

- [ ] **Step 2: Run `npm test`** → FAIL.
- [ ] **Step 3: Implementieren.** Bilderliste rekursiv wie im Server (Endungen jpg/jpeg/png/webp).
- [ ] **Step 4: Run `npm test`** → PASS.
- [ ] **Step 5: Commit** `feat: Prüfskript für Kapitel`

---

### Task 5: Inhalte, Start, Kapitel-Regeln

**Files:**
- Move: `Bilder/` → `welten/starwars/bilder/` (komplett, inkl. Unterordner)
- Create: `welten/starwars/welt.json`, `welten/starwars/kapitel/01-angriff-auf-den-sternzerstoerer.json`, `02-….json`, `03-….json`, `start.bat`, `CLAUDE.md`

**Interfaces:**
- Consumes: Kapitel-Format aus der Spec, `pruefe.js` aus Task 4.
- Produces: `welt.json` = `{"name": "Star Wars", "helfer": "Yoda", "farben": {"hintergrund": "#0b0f1a", "flaeche": "#111827", "akzent": "#ffe81f", "text": "#e8e6d9", "tipp": "#1f3b1f"}}` – Task 6 setzt diese Schlüssel als CSS-Variablen `--hintergrund` usw.

- [ ] **Step 1: Bilder verschieben** (`git mv` geht nicht, Ordner ist ignoriert → normales Verschieben). Prüfen: `ls welten/starwars/bilder` zeigt dieselben Dateien/Unterordner wie vorher `Bilder/`.
- [ ] **Step 2: `CLAUDE.md` schreiben** – Regeln für neue Kapitel, direkt aus der Spec: Niveau Anfang 4. Klasse, Themenmix (Einmaleins, Teilen ohne Rest, Plus/Minus bis 500, Verdoppeln/Halbieren, mehrschrittig), alle Zahlen und Zwischenergebnisse ≤ 500, 4–6 Aufgaben mit zusammenhängender Handlung, die auf vorherigen Antworten aufbaut, Tipp in Yoda-Sprache ohne Ergebnis, `rechnung` nur mit `+ - * / ( )`. Vor dem Schreiben Bilder auflisten und **nur Suchwörter verwenden, zu denen Bilder existieren** (Pfad enthält Suchwort). Dateiname `NN-titel-ohne-umlaute.json` mit nächster freier Nummer. Am Ende `node pruefe.js` ausführen und alle Fehler beheben. Dazu ein Abschnitt „Starten“: `start.bat` bzw. `npm start`; „Zurücksetzen“: `welten/<welt>/spielstand.json` löschen.
- [ ] **Step 3: 3 Kapitel erzeugen** nach den Regeln aus `CLAUDE.md`; Kapitel 1 enthält die beiden Beispielaufgaben aus der Spec (12 X-Wings / 4 Gruppen; 3 · 8 / 2).
- [ ] **Step 4: Run `node pruefe.js`** → `OK: 3 Kapitel geprüft`, keine Warnungen.
- [ ] **Step 5: `start.bat`**: `@echo off`, `cd /d "%~dp0"`, `node server.js --open`, `pause` (damit Fehler sichtbar bleiben).
- [ ] **Step 6: Commit** `feat: Star-Wars-Welt mit 3 Kapiteln, Start-Skript, Kapitel-Regeln`

---

### Task 6: Frontend

**Files:**
- Create: `public/index.html`, `public/style.css`, `public/spiel.js`

**Interfaces:**
- Consumes: alle Exporte aus `public/logik.js` (Tasks 1–2), API aus Task 3, `welt.json`-Farben aus Task 5.

Ablauf in `spiel.js` (ein Modul, Zustand in wenigen Variablen: `welt`, `stand`, `kapitelIndex`, `aufgabeIndex`, `fehlversuche`, `wiederholung`):

1. Start: `GET /api/welten`. Bei genau einer Welt direkt laden; bei mehreren eine Auswahl mit Buttons zeigen. Welt laden: `GET /api/welten/:id` + `GET …/spielstand` (`null` → `leererStand()`). Farben als CSS-Variablen auf `:root`, `document.title = welt.name`.
2. **Übersicht:** Kopf mit Weltname und `gesamtPunkte`. Kachel-Raster aus `kapitelStatus`: ✅ fertig (Punkte `x/<anzahl*15>`, Klick = Wiederholung), ▶️ offen (`geloest/anzahl gelöst`, Klick = weiter bei `geloest`), 🔒 gesperrt (nicht klickbar). Darunter Abzeichen-Sammlung (`symbol` + `name` aus den Kapiteln in `stand.abzeichen`), leer: „Noch keine Abzeichen – auf geht's!“.
3. **Aufgabenseite (Layout B):** links Bild = Zufallselement aus `findeBilder(welt.bilder, aufgabe.bild)`, URL `/welten/<id>/bilder/` + Pfadsegmente mit `encodeURIComponent`; keins → CSS-Platzhalter (dunkler Hintergrund mit Sternen per `radial-gradient`). Rechts: Kopfzeile (Kapiteltitel, „Aufgabe n/m“ + Fortschrittspunkte, Gesamtpunkte), `geschichte`, `frage` (hervorgehoben), `<input inputmode="numeric" autofocus>` + Button, „Zurück zur Übersicht“-Link. Enter schickt ab.
4. **Antwort:** leer → ignorieren. `istRichtig` falsch → `fehlversuche++`, Meldung „Leider nicht – versuch's nochmal!“, Feld leeren, Fokus; ab `fehlversuche >= TIPP_AB` Tipp-Box `🟢 <helfer>: „<tipp>“` sichtbar (bleibt sichtbar). Richtig → ohne Wiederholung `stand = aufgabeGeloest(...)` und `PUT spielstand`; Meldung „Richtig! +15 – ohne Yodas Hilfe!“ bzw. „Richtig! +10“ (bei Wiederholung nur „Richtig!“); nach ~1,5 s nächste Aufgabe, `fehlversuche = 0`.
5. **Kapitelende:** Overlay mit großem Abzeichen-Symbol, „Neues Abzeichen: <name>!“ und Kapitelpunkten (bei Wiederholung: „Mission erneut geschafft!“), Button „Weiter“ → Übersicht.
6. Schlägt `PUT` fehl: dezente Meldung „Spielstand konnte nicht gespeichert werden“ – Spiel läuft weiter.

- [ ] **Step 1: Dateien schreiben.** Layout B per CSS-Grid (`grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`), Bild `object-fit: cover; max-height: 80vh`, Schrift ≥ 18 px, Eingabefeld ≥ 24 px.
- [ ] **Step 2: `npm test`** → weiterhin PASS.
- [ ] **Step 3: Manuell prüfen** mit `node server.js` und Browser auf `http://localhost:8642` (oder `run`-Skill mit Screenshot):
  - Kapitel 1 öffnen, Bild links sichtbar.
  - Zweimal falsch → Yoda-Tipp erscheint; dann richtig → „+10“.
  - Nächste Aufgabe sofort richtig → „+15 – ohne Yodas Hilfe!“.
  - Seite neu laden → Übersicht zeigt Fortschritt; Kapitel geht bei der offenen Aufgabe weiter.
  - Kapitel beenden → Abzeichen-Overlay, Abzeichen in der Übersicht, Kapitel 2 entsperrt.
  - Kapitel 1 wiederholen → keine Punkte, Gesamtpunktzahl unverändert.
  - `spielstand.json` löschen, neu laden → alles zurückgesetzt.
- [ ] **Step 4: Commit** `feat: Spieloberfläche`

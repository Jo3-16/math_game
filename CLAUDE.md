# Mathe-Missionen

Lernspiel für einen Jungen am Anfang der 4. Klasse: Mathe-Sachaufgaben als Geschichte in Kapiteln. Ursprüngliches Design: `docs/superpowers/specs/2026-10-18-mathe-missionen-design.md` (seitdem stark erweitert – im Zweifel gilt diese Datei).

- Starten: Doppelklick auf `start.bat` (oder `npm start`), dann http://localhost:8642 – nach Änderungen an `server.js` oder `einstellungen.json` Server neu starten, sonst reicht F5
- Tests: `npm test` · Kapitel prüfen: `node pruefe.js`
- Spielstand zurücksetzen: `welten/<welt>/spielstand.json` löschen (alte Spielstände mit Kapitel-Kennungen wie `01-name` werden beim Laden automatisch auf `name` umgestellt)
- Admin-Modus: http://localhost:8642/admin – alle Kapitel offen, „Weiter ▶“ ohne Rechnen, Lösung + Tipp sichtbar, nichts wird gespeichert; dazu „🖼️ Bildergalerie“ (je Bild die Aufgaben, in denen es erscheinen kann; unbenutzte rot gestrichelt) und „📊 Statistik“ (Fehlversuche je Rechenart, schwierigste Aufgaben)
- Admin-Passwort (optional): `einstellungen.json` → `{ "adminPasswort": "…" }` (nicht im Git; ohne Datei ist /admin offen)
- Weitere Seiten: Abzeichen & Punkte `/abzeichen`, Hologramm-Archiv `/archiv`, Flugsimulator (Zufallsaufgaben je Rechenart, keine Punkte, Serien-Rekord) über die Übersicht
- Spielmechanik: 10 Punkte je Aufgabe, +5 ohne Tipp (Tipp ab 2 Fehlversuchen), Bonus-Rätsel +20 und Gold-Abzeichen, 1–3 Sterne je Kapitel, Ränge Jüngling/Padawan (150)/Jedi-Ritter (500)/Jedi-Meister (1000)

## Code

- `server.js` – lokaler Node-Server ohne Abhängigkeiten (Seiten, API, Bilder, Spielstand, Admin-Passwort, Kapitel-Reihenfolge)
- `public/logik.js` – reine Logik (Bildsuche, Rechnungs-Parser, Punkte, Sterne, Ränge, Statistik, Simulator-Aufgaben); von Browser, Prüfskript und Tests genutzt
- `public/spiel.js`, `index.html`, `style.css` – Oberfläche
- `pruefe.js` – prüft alle Kapitel (Rechnungen, Zahlenräume, Felder, Bilder, Reihenfolge)
- `test/` – `node:test`-Tests
- Bilder: nur `welten/<welt>/bilder/Kapitelbilder/` ist im Git; die übrigen Bilder sammelt der Vater lokal

## Neue Kapitel erzeugen

Wenn der Vater z. B. „Mach 5 neue Kapitel über Hoth“ sagt:

1. **Bilder ansehen:** alle Dateien unter `welten/<welt>/bilder/` rekursiv auflisten. Ein Suchwort passt, wenn der Pfad (Ordner + Dateiname) es enthält – Groß/klein egal, `_` `-` Leerzeichen gelten gleich, ä = ae. Suchwort mit `/` am Ende (z. B. `x-wing/`) trifft nur Bilder im gleichnamigen Ordner. **Nur Suchwörter verwenden, zu denen es Bilder gibt.** Fehlen Bilder für ein Thema, dem Vater sagen, welche er sammeln könnte.
   **Fehltreffer prüfen** – bei jeder Arbeit mit Bildern (neue Kapitel, neue Suchwörter, neue Bilder oder Ordner): für jedes Suchwort aller Kapitel auflisten, welche Bilder es trifft, und Treffer aus fremden Ordnern melden (z. B. `sternzerstörer` trifft `Transporter/…_Flucht_vor_Sternzerstoerer.png`). Passt ein Treffer nicht zur Geschichte: Suchwort eingrenzen (Ordner-Suchwort oder genauerer Dateinamen-Teil) oder dem Vater das Umbenennen der Datei vorschlagen.
2. **Datei und Reihenfolge:** `welten/<welt>/kapitel/<name>.json` – `<name>` ist die feste Kennung (klein, ohne Umlaute, mit Bindestrichen, z. B. `der-grabenlauf`). Spielstand, Statistik und Bilder beziehen sich darauf, darum nie umbenennen. **Die Reihenfolge steht nur in `welt.json` unter `reihenfolge`** – neues Kapitel dort an der gewünschten Stelle eintragen. Die angezeigte Kapitelnummer ist die Position in dieser Liste (gezählt ab 1).
3. **Format:**
   ```json
   {
     "titel": "…",
     "vorschau": "Kapitelbilder/<name>.jpg",
     "belohnung": "Kapitelbilder/Belohnung/<name>.jpg",
     "abzeichen": { "name": "…", "symbol": "ein Emoji" },
     "aufgaben": [
       { "bild": ["suchwort", "ordner/"], "geschichte": "…", "frage": "…?",
         "rechnung": "3 * 8 / 2", "loesung": 12, "merke": "12 Torpedo-Treffer", "tipp": "…" },
       { "bild": ["…"], "geschichte": "…", "frage": "Wie viele … – und wie viele bleiben übrig?",
         "rechnung": "100 / 30", "loesung": 3, "rest": 10, "merke": "3 Tage, dann noch 10 km", "tipp": "…" },
       { "bild": ["…"], "art": "einheiten", "geschichte": "…", "frage": "…?",
         "rechnung": "2 * 60 + 15", "loesung": 135, "merke": "135 Minuten", "tipp": "…" }
     ],
     "bonus": { "geschichte": "…", "frage": "…?", "loesung": 18, "tipp": "…" }
   }
   ```
4. **Regeln:**
   - 4 bis 6 Aufgaben pro Kapitel, eine zusammenhängende Handlung; Aufgaben bauen aufeinander auf (spätere nutzen frühere Ergebnisse).
   - Niveau Anfang 4. Klasse, gemischt: Einmaleins, Malnehmen mit Zehnerzahlen, Teilen ohne und mit Rest, Plus/Minus, Verdoppeln/Halbieren, Größen & Einheiten, zwei- und mehrschrittige Aufgaben. Jedes neue Kapitel möglichst mit einer Rest-Aufgabe.
   - **Zahlenräume** (Zahlen, Zwischenergebnisse, Lösungen ganzzahlig ≥ 0): reine Plus/Minus-Aufgaben bis 999, Einheiten bis 9999, alle anderen (mit Mal oder Geteilt) bis 500. Das Prüfskript kennt diese Grenzen (`maxFuer` in `public/logik.js`).
   - `rechnung` nur mit Zahlen, `+ - * /` und Klammern; sie muss genau den Rechenweg der Geschichte abbilden.
   - Geschichte kurz (2–3 Sätze), spannend, kindgerecht; die Frage separat und eindeutig.
   - `tipp` spricht der Helfer der Welt (Star Wars: Yoda, in Yoda-Sprache), zeigt den Rechenweg an, **verrät nie das Ergebnis** (auch nicht indirekt wie „48 durch 4“ bei Lösung 12).
   - `merke`: kurzes Ergebnis mit der Lösungszahl. Es erscheint unten in der Ergebnisleiste der folgenden Aufgaben – jede Aufgabe muss mit Geschichte + Ergebnisleiste allein lösbar sein; Zahlen aus früheren Geschichten, die keine Lösung waren, in der Geschichte wiederholen.
   - **Teilen mit Rest**: Feld `"rest": N` (N > 0) – nur dann erscheint das zweite Eingabefeld „Rest“. `rechnung` muss `Ausdruck / Zahl` sein (Plus/Minus links in Klammern), `loesung` ist das ganze Ergebnis.
   - **Größen & Einheiten**: Feld `"art": "einheiten"` (für Statistik und Zahlenraum bis 9999): km↔m, m↔cm, h↔min, min↔s.
   - `bonus`: Knobel-Rätsel nach der letzten Aufgabe (optional `bild`). Lösen gibt Gold-Abzeichen und +20 Punkte. Lösung ganzzahlig 0–500 und **eindeutig** – vorher per Skript durchprobieren. Gute Typen: Zahl aus Bedingungen erraten, Zahlenfolgen, Teile-Aufgaben, Zaunpfahl-Problem, Köpfe-und-Beine.
   - Texte auf Deutsch.
5. **Kapitelbilder** (beide als Kopie, damit sie fest bleiben; Quelle in der jeweiligen `QUELLEN.txt` eintragen):
   - `vorschau`: `Kapitelbilder/<name>.jpg`, 480 px breit – Bild für die Übersicht.
   - `belohnung`: `Kapitelbilder/Belohnung/<name>.jpg`, max. 1600 px breit – fürs Hologramm-Archiv, frei beim ersten Abschluss. Gern bisher ungenutzte Bilder (Admin-Galerie zeigt sie).
   - Verkleinern ohne ImageMagick: PowerShell mit `System.Drawing` (Bild laden, auf Zielbreite zeichnen, Hintergrund `#0b0f1a` für transparente PNGs, als JPG Qualität 85 speichern).
   - Externe Bilder nur frei lizenziert (z. B. Wikimedia Commons); Wookieepedia blockt Downloads.
6. **Prüfen:** `node pruefe.js` ausführen und alle FEHLER und WARNUNGEN beheben, `npm test` laufen lassen, bevor du fertig meldest.

## Neue Welt

Ordner `welten/<id>/` mit `welt.json`, `bilder/` und `kapitel/`. `welt.json`: `name`, `helfer` (Name des Tipp-Gebers), optional `helferBild` (fester Pfad des Tipp-Bilds, sonst wird ein Bild gesucht, dessen Pfad den Helfernamen enthält; ohne Bild erscheint 🟢), `farben` (hintergrund, flaeche, akzent, text, tipp) und `reihenfolge` (Liste der Kapitel-Namen).

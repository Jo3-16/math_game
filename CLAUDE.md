# Mathe-Missionen

Lernspiel für einen Jungen am Anfang der 4. Klasse: Mathe-Sachaufgaben als Geschichte in Kapiteln. Design: `docs/superpowers/specs/2026-10-18-mathe-missionen-design.md`.

- Starten: Doppelklick auf `start.bat` (oder `npm start`), dann http://localhost:8642
- Tests: `npm test`
- Kapitel prüfen: `node pruefe.js`
- Spielstand zurücksetzen: `welten/<welt>/spielstand.json` löschen
- Admin-Modus: http://localhost:8642/admin – alle Kapitel offen, „Weiter ▶“ ohne Rechnen, Lösung + Tipp sichtbar, nichts wird gespeichert; dort auch „🖼️ Bildergalerie“ (alle Bilder, je Bild die Aufgaben, in denen es erscheinen kann; unbenutzte rot gestrichelt)
- Abzeichen & Punkte: http://localhost:8642/abzeichen · Hologramm-Archiv: http://localhost:8642/archiv
- Admin-Passwort: `einstellungen.json` → `{ "adminPasswort": "…" }` (nicht im Git; ohne Datei ist /admin offen; nach Änderung Server neu starten)
- Flugsimulator (Zufallsaufgaben je Rechenart, unbegrenzt, keine Punkte, Serien-Rekord): Knopf in der Übersicht
- Fehlerstatistik (je Rechenart + schwierigste Aufgaben): im Admin-Modus „📊 Statistik“

## Neue Kapitel erzeugen

Wenn der Vater z. B. „Mach 5 neue Kapitel über Hoth“ sagt:

1. **Bilder ansehen:** alle Dateien unter `welten/<welt>/bilder/` rekursiv auflisten. Ein Suchwort passt, wenn der Pfad (Ordner + Dateiname) es enthält – Groß/klein egal, `_` `-` Leerzeichen gelten gleich, ä = ae. Suchwort mit `/` am Ende (z. B. `x-wing/`) trifft nur Bilder im gleichnamigen Ordner – damit Fehltreffer aus fremden Ordnern vermeiden. **Nur Suchwörter verwenden, zu denen es Bilder gibt.** Fehlen Bilder für ein Thema, dem Vater sagen, welche er sammeln könnte.
   **Fehltreffer prüfen** – bei jeder Arbeit mit Bildern (neue Kapitel, neue Suchwörter, neue Bilder oder Ordner): für jedes Suchwort aller Kapitel auflisten, welche Bilder es trifft, und Treffer aus fremden Ordnern melden (z. B. `sternzerstörer` trifft `Transporter/…_Flucht_vor_Sternzerstoerer.png`). Passt ein Treffer nicht zur Geschichte: Suchwort eingrenzen oder dem Vater das Umbenennen der Datei vorschlagen.
2. **Datei und Reihenfolge:** `welten/<welt>/kapitel/<name>.json` – `<name>` ist die feste Kennung des Kapitels (klein, ohne Umlaute, mit Bindestrichen, z. B. `der-grabenlauf`). Spielstand, Statistik und Bilder beziehen sich auf diesen Namen, darum nie umbenennen. **Die Reihenfolge steht nur in `welt.json` unter `reihenfolge`** – neues Kapitel dort an der gewünschten Stelle eintragen. Die angezeigte Kapitelnummer ist die Position in dieser Liste (gezählt ab 1).
3. **Format:**
   ```json
   {
     "titel": "…",
     "vorschau": "Kapitelbilder/<name>.jpg",
     "abzeichen": { "name": "…", "symbol": "ein Emoji" },
     "aufgaben": [
       { "bild": ["suchwort", "alternative"], "geschichte": "…", "frage": "…?",
         "rechnung": "3 * 8 / 2", "loesung": 12, "merke": "12 Torpedo-Treffer", "tipp": "…" }
     ]
   }
   ```
4. **Regeln:**
   - 4 bis 6 Aufgaben pro Kapitel, eine zusammenhängende Handlung; Aufgaben bauen aufeinander auf (spätere nutzen frühere Ergebnisse).
   - Niveau Anfang 4. Klasse, gemischt: Einmaleins, Malnehmen mit Zehnerzahlen, Teilen ohne Rest, Plus/Minus bis 999, Verdoppeln/Halbieren, zwei- und mehrschrittige Aufgaben.
   - Alle Zahlen, Zwischenergebnisse und Lösungen ganzzahlig: reine Plus/Minus-Aufgaben 0 bis 999, Einheiten 0 bis 9999, alle anderen (mit Mal oder Geteilt) 0 bis 500. Das Prüfskript kennt diese Grenzen (`maxFuer` in `public/logik.js`).
   - `rechnung` nur mit Zahlen, `+ - * /` und Klammern; sie muss genau den Rechenweg der Geschichte abbilden.
   - Geschichte kurz (2–3 Sätze), spannend, kindgerecht; die Frage separat und eindeutig.
   - `tipp` spricht der Helfer der Welt (Star Wars: Yoda, in Yoda-Sprache), zeigt den Rechenweg an, **verrät nie das Ergebnis**.
   - `merke`: kurzes Ergebnis mit der Lösungszahl (z. B. „12 Torpedo-Treffer“). Es erscheint unten in der Ergebnisleiste der folgenden Aufgaben – jede Aufgabe muss mit Geschichte + Ergebnisleiste allein lösbar sein; Zahlen aus früheren Geschichten, die keine Lösung waren, in der Geschichte wiederholen.
   - Texte auf Deutsch.
   - `vorschau`: festes Vorschaubild für die Übersicht, Pfad relativ zu `bilder/` (Ordner `Kapitelbilder/`, Quelle in `Kapitelbilder/QUELLEN.txt` eintragen). Bilder frei lizenziert z. B. von Wikimedia Commons; Wookieepedia blockt Downloads.
   - **Teilen mit Rest**: Feld `"rest": N` (N > 0) – nur dann erscheint das zweite Eingabefeld „Rest“. `rechnung` muss `Ausdruck / Zahl` sein (Plus/Minus links in Klammern), `loesung` ist das ganze Ergebnis. Frage nennt beides („… wie viele bleiben übrig?“).
   - **Größen & Einheiten**: Feld `"art": "einheiten"` (für die Statistik). Hier sind Zahlen bis 9999 erlaubt (sonst 500): km↔m, m↔cm, h↔min, min↔s.
   - `belohnung`: Bild fürs Hologramm-Archiv, frei beim ersten Abschluss des Kapitels. Als Kopie in `Kapitelbilder/Belohnung/<name>.jpg` (max. 1600 px breit) ablegen, Quelle in `Kapitelbilder/Belohnung/QUELLEN.txt`. Gern bisher ungenutzte Bilder (Admin-Galerie zeigt sie).
   - `vorschau`: als `Kapitelbilder/<name>.jpg` mit 480 px Breite ablegen (große Bilder vorher verkleinern).
   - `bonus`: ein Knobel-Rätsel nach der letzten Aufgabe (`{ "geschichte", "frage", "loesung", "tipp" }`, optional `bild`). Lösen gibt Gold-Abzeichen und +20 Punkte. Lösung ganzzahlig 0–500 und **eindeutig** – vorher per Skript durchprobieren (z. B. alle Zahlen 0–500 gegen die Bedingungen prüfen). Gute Typen: Zahl erraten aus Bedingungen, Zahlenfolgen, Teile-Aufgaben, Zaunpfahl-Problem, Köpfe-und-Beine.
5. **Prüfen:** `node pruefe.js` ausführen und alle FEHLER und WARNUNGEN beheben, bevor du fertig meldest.

## Neue Welt

Ordner `welten/<id>/` mit `welt.json` (`name`, `helfer`, optional `helferBild` = fester Pfad des Tipp-Bilds, `farben`: hintergrund, flaeche, akzent, text, tipp), `bilder/` und `kapitel/`.

Das Bild des Helfers (Tipp-Box) ist ein Bild in `bilder/`, dessen Pfad den Helfernamen enthält (z. B. `Yoda.png`). Ohne ein solches Bild erscheint 🟢.

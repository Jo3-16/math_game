# Mathe-Missionen

Lernspiel für einen Jungen am Anfang der 4. Klasse: Mathe-Sachaufgaben als Geschichte in Kapiteln. Design: `docs/superpowers/specs/2026-10-18-mathe-missionen-design.md`.

- Starten: Doppelklick auf `start.bat` (oder `npm start`), dann http://localhost:8642
- Tests: `npm test`
- Kapitel prüfen: `node pruefe.js`
- Spielstand zurücksetzen: `welten/<welt>/spielstand.json` löschen

## Neue Kapitel erzeugen

Wenn der Vater z. B. „Mach 5 neue Kapitel über Hoth“ sagt:

1. **Bilder ansehen:** alle Dateien unter `welten/<welt>/bilder/` rekursiv auflisten. Ein Suchwort passt, wenn der Pfad (Ordner + Dateiname) es enthält – Groß/klein egal, `_` `-` Leerzeichen gelten gleich, ä = ae. **Nur Suchwörter verwenden, zu denen es Bilder gibt.** Fehlen Bilder für ein Thema, dem Vater sagen, welche er sammeln könnte.
2. **Datei:** `welten/<welt>/kapitel/NN-titel-ohne-umlaute.json`, NN = nächste freie Nummer (zweistellig).
3. **Format:**
   ```json
   {
     "titel": "…",
     "abzeichen": { "name": "…", "symbol": "ein Emoji" },
     "aufgaben": [
       { "bild": ["suchwort", "alternative"], "geschichte": "…", "frage": "…?",
         "rechnung": "3 * 8 / 2", "loesung": 12, "tipp": "…" }
     ]
   }
   ```
4. **Regeln:**
   - 4 bis 6 Aufgaben pro Kapitel, eine zusammenhängende Handlung; Aufgaben bauen aufeinander auf (spätere nutzen frühere Ergebnisse).
   - Niveau Anfang 4. Klasse, gemischt: Einmaleins, Malnehmen mit Zehnerzahlen, Teilen ohne Rest, Plus/Minus bis 500, Verdoppeln/Halbieren, zwei- und mehrschrittige Aufgaben.
   - Alle Zahlen, Zwischenergebnisse und Lösungen ganzzahlig, 0 bis 500.
   - `rechnung` nur mit Zahlen, `+ - * /` und Klammern; sie muss genau den Rechenweg der Geschichte abbilden.
   - Geschichte kurz (2–3 Sätze), spannend, kindgerecht; die Frage separat und eindeutig.
   - `tipp` spricht der Helfer der Welt (Star Wars: Yoda, in Yoda-Sprache), zeigt den Rechenweg an, **verrät nie das Ergebnis**.
   - Texte auf Deutsch.
5. **Prüfen:** `node pruefe.js` ausführen und alle FEHLER und WARNUNGEN beheben, bevor du fertig meldest.

## Neue Welt

Ordner `welten/<id>/` mit `welt.json` (`name`, `helfer`, `farben`: hintergrund, flaeche, akzent, text, tipp), `bilder/` und `kapitel/`.

Das Bild des Helfers (Tipp-Box) ist ein Bild in `bilder/`, dessen Pfad den Helfernamen enthält (z. B. `Yoda.png`). Ohne ein solches Bild erscheint 🟢.

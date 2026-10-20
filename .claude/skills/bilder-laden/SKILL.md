---
name: bilder-laden
description: Star-Wars-Bilder (Figuren, Schiffe, Orte, Schlachten) von Wookieepedia in einen Themenordner unter welten/<welt>/bilder/ herunterladen, jedes Bild ansehen und nur passende behalten. Verwenden, wenn der Vater sagt „lade 10 Bilder von X herunter“, „noch 20 weitere Y-Bilder“ o. Ä.
---

# Bilder herunterladen

Ziel: `welten/<welt>/bilder/<Thema>/` mit N guten Bildern (Standard 10). Die Bilder sind gitignored und nur für den privaten Gebrauch (© Lucasfilm) – dem Vater das bei neuen Themen kurz sagen.

## Auswahlregeln

- **Erlaubt:** echte Film-/Serien-Standbilder, offizielle Pressefotos, hochwertiges offizielles Artwork (z. B. Ralph McQuarrie, Kartenkunst ohne Text).
- **Verboten:** Lego, Spielzeug, Figuren, Modelle/Miniaturen/Behind-the-Scenes, Schemazeichnungen/Querschnitte, Comic-Cover/-Panels, Karten-Scans mit Text, Cosplay, Freizeitparks, Bilder unter 600 px Breite.
- **Schiffe/Fahrzeuge:** im Weltraum oder über/auf einem Planeten, gut erkennbar. Keine Freisteller ohne Hintergrund, keine Hangar-/Cockpit-Innenansichten.
- **Figuren:** die Figur ist klar das Hauptmotiv.
- **Orte:** der Ort dominiert (Landschaft, Stadt, Planet aus dem All).
- **Kindgerecht:** nichts Blutiges oder sehr Gruseliges (z. B. kein Leia-Sklavinnenkostüm, keine Opfer von Machtblitzen).
- **Ära:** das Spiel spielt vor allem in Episode IV–VI – diese bevorzugen, andere nur ergänzend. **Ausnahme Raumschiffe:** Schiffe, die es auch in Episode IV–VI gibt (X-Wing, Y-Wing, TIE, Sternzerstörer, Korvette, Transporter …), dürfen gleichberechtigt aus anderen Filmen/Serien kommen, z. B. Rogue One – Hauptsache, das Schiff ist dasselbe Modell.
- Keine Fast-Duplikate. Lieber weniger Bilder liefern als schlechte auffüllen – und das sagen.

## Dateinamen

- Ordner: `Thema-mit-Bindestrichen` (z. B. `TIE-Interceptor`, `Wolkenstadt-Bespin`), keine Umlaute.
- Dateien: `NN_Film_Thema_Beschreibung.ext`, z. B. `01_ESB_AT-AT_Hoth.png` (Film-Kürzel ANH/ESB/ROTJ/RO/ROTS/TFA/TLJ/TROS, sonst `Art`, `Rebels`, `Mando` …). Umlaute als ae/oe/ue.
- Bei „noch weitere“: vorhandene Dateien ansehen, Nummerierung fortsetzen, nichts doppelt.
- Keine Wörter in Dateinamen, die als Suchwörter anderer Kapitel Fehltreffer erzeugen (siehe CLAUDE.md → „Fehltreffer prüfen“).

## Vorgehen (Git Bash)

Wookieepedia liefert ohne Browser-Header nur eine Cloudflare-Seite und ohne `format=original` WebP.

```bash
API="https://starwars.fandom.com/api.php"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0"

# 1a. Kategorie (liefert die meisten Treffer) – gcmcontinue beachten
curl -s -G "$API" --data-urlencode "gcmtitle=Category:Images of Han Solo" \
  -d action=query -d generator=categorymembers -d gcmnamespace=6 -d gcmlimit=500 -d format=json \
  | grep -o '"title":"[^"]*"'
# 1b. Textsuche im Datei-Namensraum
curl -s -G "$API" --data-urlencode "srsearch=AT-AT Hoth" -d action=query -d list=search \
  -d srnamespace=6 -d srlimit=50 -d format=json | grep -o '"title":"[^"]*"'
# 1c. Bilder eines Artikels
curl -s -G "$API" --data-urlencode "titles=Battle of Endor" -d redirects=1 -d action=query \
  -d prop=images -d imlimit=500 -d format=json | grep -o '"title":"File:[^"]*"'

# 2. URLs + Größen (mehrere Titel mit | trennen)
curl -s -G "$API" --data-urlencode "titles=File:A.png|File:B.jpg" -d action=query \
  -d prop=imageinfo -d iiprop="url|size" -d format=json

# 3. Herunterladen – &format=original anhängen, danach Typ prüfen
curl -sL -A "$UA" -e "https://starwars.fandom.com/" -o datei.png "$URL&format=original"
file -b datei.png   # muss PNG oder JPEG sein, kein HTML/WebP
```

4. Kandidaten (etwa doppelt so viele wie gebraucht) in einen **eigenen** Zwischenordner im Scratchpad laden, nicht ins Projekt.
5. **Jeden Kandidaten mit dem Read-Tool ansehen** – Dateinamen auf Wookieepedia sind oft irreführend (Lego, Comics, Spielgrafiken).
6. Nur die guten Bilder mit dem endgültigen Namen in den Zielordner kopieren. Keine Pakete installieren (kein `pip install`).
7. Nachzählen (`ls Ordner | wc -l`).

Viele Themen auf einmal: je Agent 1–3 Themen parallel starten, jeder mit eigenem Zwischenordner, und diese Regeln mitgeben.

## Rückmeldung an den Vater

Kurze Tabelle je Ordner (Datei → ein Satz Inhalt), dazu höchstens 2–3 schwächere Bilder mit Grund, und was es nicht gab.

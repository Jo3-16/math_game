# Mathe-Missionen – Design

## Wozu

Ein Lernspiel für den Sohn (Anfang 4. Klasse). Er löst gern Mathe-Rätsel, kann sich bei „langweiligen“ Aufgaben aber schwer konzentrieren. Star-Wars-Bilder motivieren ihn stark. Das Spiel macht Matheaufgaben deshalb zu einer **fortlaufenden Geschichte**: Jedes Kapitel ist eine Mission, und die Aufgaben bauen erzählerisch aufeinander auf (12 X-Wings → 4 Gruppen → eine Gruppe feuert Torpedos …). Erst mit der richtigen Lösung geht die Geschichte weiter.

Erfolg heißt: Er will von sich aus „noch ein Kapitel“ spielen.

## Ziele

- Pro Seite genau eine Aufgabe: Bild + kurze Geschichte + Frage + Eingabefeld.
- Weiter geht es erst nach der richtigen Antwort.
- Nach **2 Fehlversuchen** gibt der Helfer der Welt (Star Wars: **Yoda**) einen Tipp.
- Viele Kapitel mit je einer Gruppe von Aufgaben. Für ein abgeschlossenes Kapitel gibt es ein **Abzeichen**.
- Der Spielstand wird gespeichert, auch mitten im Kapitel.
- Die Welt ist austauschbar (Star Wars jetzt, später z. B. eine andere).
- Neue Kapitel erzeugt Claude **vorab auf Zuruf** in Claude Code (Abo, kein API-Key).

## Nicht-Ziele

- Keine Live-KI-Generierung während des Spiels. Das ist „erstmal“ nicht nötig und kann später kommen.
- Keine Bildgenerierung. Der Vater sammelt die Bilder selbst.
- Kein Mehrspieler, keine Benutzerkonten. Es gibt einen Spieler.
- Läuft nur lokal auf diesem PC (Windows). Kein Hosting, nichts im Internet.
- Kein Kinderschutz und kein „Papa-Modus“, denn der Vater sitzt dabei.

## Anti-Ziele (das wäre ein Fehlschlag, auch wenn es technisch läuft)

- **Eine falsche „richtige Lösung“.** Das ist für ihn das Frustrierendste. Jede Lösung wird deshalb maschinell nachgerechnet (siehe Prüfskript).
- Geschichte als bloße Deko, also im Grunde wieder ein Arbeitsblatt. Die Aufgaben müssen aus der Handlung entstehen und aufeinander aufbauen.
- Hängenbleiben ohne Hilfe. Darum gibt es den Yoda-Tipp.
- Zahlen über ca. **500**.

## Mathe-Niveau

Anfang 4. Klasse, Zahlen bis ca. 500 (auch Zwischenergebnisse). Gemischte Sachaufgaben aus:
- Einmaleins und Malnehmen (auch einfache Zehnerzahlen wie 4 · 30)
- Teilen ohne Rest
- Plus und Minus bis 500
- Verdoppeln und Halbieren
- Zwei- und mehrschrittige Aufgaben, die auf vorherigen Antworten aufbauen

Antworten sind immer **ganze Zahlen ≥ 0**.

## Bildschirme

**Layout B** (vom Vater gewählt): Bild links, rechts Geschichte, Frage, Eingabefeld und Button. Alles passt ohne Scrollen auf einen PC-Bildschirm. Dunkler Weltraum-Look, Star-Wars-Gelb als Akzent (Farben kommen aus der Welt-Konfiguration).

1. **Kapitelübersicht:** Kacheln für alle Kapitel mit den Zuständen ✅ fertig / ▶️ angefangen (x/y gelöst) / 🔒 gesperrt. Kapitel werden der Reihe nach freigeschaltet. Darunter steht die **Abzeichen-Sammlung**. Fertige Kapitel lassen sich **nochmal spielen** (Entscheidung von Claude). Die Wiederholung beginnt bei Aufgabe 1 und ändert nichts am gespeicherten Stand: Das Kapitel bleibt ✅, das Abzeichen gibt es nicht doppelt, und es gibt **keine Punkte** (sonst ließen sich Punkte durch Wiederholen sammeln). In der Übersicht zeigt jede Kachel die Punkte des Kapitels (z. B. 65/75), dazu kommt die Gesamtpunktzahl.
2. **Aufgabenseite:** Kopfzeile mit Kapitelname, Fortschritt (Aufgabe 2/5) und Gesamtpunktzahl. **Punkte** (vom Vater gewünscht): **10 Punkte** pro gelöster Aufgabe, **+5 Bonus**, wenn sie ohne Yoda-Tipp gelöst wurde, also innerhalb der ersten 2 Versuche. Fehlversuche kosten keine Punkte. Bei richtiger Antwort zeigt die Erfolgsmeldung die gewonnenen Punkte (z. B. „+15, ohne Yodas Hilfe!“). Bei richtiger Antwort kommt eine kurze Erfolgsmeldung, dann die nächste Aufgabe. Bei falscher Antwort steht da „Leider nicht, versuch's nochmal“, das Feld wird geleert. Ab dem 2. Fehlversuch steht der Tipp des Helfers sichtbar unter der Aufgabe. Die Zahl der Versuche ist unbegrenzt.
3. **Kapitel-Ende:** Das Abzeichen wird groß gezeigt („Neues Abzeichen: Sternzerstörer-Jäger 🏅“), danach geht es zurück zur Übersicht.

Mit Enter wird die Antwort abgeschickt, und der Fokus liegt immer im Eingabefeld.

## Bilder

- Pro Welt ein Ordner mit Bildern, die der Vater sammelt (jpg, jpeg, png, webp).
- Jede Aufgabe nennt ein oder mehrere **Suchwörter**, z. B. `["sternzerstörer", "star-destroyer"]`.
- Der Bilder-Ordner darf **Unterordner** haben (beliebig tief), z. B. `bilder/Sternzerstörer/…` für alle Sternzerstörer. Bilder können aber auch direkt im Hauptordner liegen.
- Ein Bild passt, wenn sein **Pfad innerhalb des Bilder-Ordners** (Unterordner-Namen + Dateiname) eines der Suchwörter **enthält**. Ein Bild in `Sternzerstörer/imperial-1.jpg` passt also zu `sternzerstörer`, auch wenn der Dateiname es nicht enthält. Beim Vergleich wird Groß- und Kleinschreibung ignoriert, und `_`, `-` und Leerzeichen gelten als gleich. Beispiel: `X-wing_SWB.webp` passt zu `x-wing` und zu `x wing`.
- Passen mehrere Bilder, nimmt das Spiel zufällig eins.
- Passt keins, erscheint ein neutrales Platzhalterbild (Sternenhimmel), und das Spiel läuft weiter. Das Prüfskript warnt vorher davor.
- Hinweis: Im bisherigen Ordner hat `sterzerstörer_Star-Destroyer_….jpeg` einen Tippfehler, wird aber über `star-destroyer` gefunden.

## Welten und Kapitel (Dateien)

```
welten/
  starwars/
    welt.json          Name, Helfer ("Yoda"), Farben
    bilder/            ← hierhin zieht der bisherige Ordner Bilder/ um, Unterordner bleiben erhalten
    kapitel/
      01-angriff-auf-den-sternzerstoerer.json
      02-flucht-von-hoth.json
```

Die Reihenfolge der Kapitel ergibt sich aus dem Dateinamen. Ein Kapitel sieht so aus:

```json
{
  "titel": "Angriff auf den Sternzerstörer",
  "abzeichen": { "name": "Sternzerstörer-Jäger", "symbol": "🏅" },
  "aufgaben": [
    {
      "bild": ["x-wing"],
      "geschichte": "Rot-Staffel startet von Yavin 4! 12 X-Wings teilen sich in 4 gleich große Gruppen auf.",
      "frage": "Wie viele X-Wings sind in jeder Gruppe?",
      "rechnung": "12 / 4",
      "loesung": 3,
      "tipp": "Auf 4 Gruppen verteilen du musst. Welche Zahl mal 4 ergibt 12, hmm?"
    },
    {
      "bild": ["sternzerstörer", "star-destroyer"],
      "geschichte": "Eine der Gruppen entdeckt einen Sternzerstörer! Jeder X-Wing feuert 8 Protonentorpedos ab. Die Hälfte davon trifft.",
      "frage": "Wie viele Treffer sind das?",
      "rechnung": "3 * 8 / 2",
      "loesung": 12,
      "tipp": "Zuerst alle Torpedos zählen du musst: 3 mal 8. Dann halbieren."
    }
  ]
}
```

Ein Kapitel hat 4 bis 6 Aufgaben. Die Tipps spricht Yoda in Yoda-Sprache, sie verraten aber nie das Ergebnis.

## Kapitel erzeugen (Claude Code)

Im Projekt liegt eine `CLAUDE.md` mit den Regeln für neue Kapitel: Niveau, Zahlenraum ≤ 500, Themenmix, Dateiformat, Tipp-Stil, zusammenhängende Handlung. Außerdem steht dort, dass **nur Suchwörter verwendet werden, zu denen Bilder im Bilder-Ordner existieren**, und dass am Ende das Prüfskript laufen muss.

Der Vater sagt dann z. B. „Mach 5 neue Kapitel über die Schlacht um Hoth“.

## Prüfskript

`node pruefe.js` prüft alle Kapitel aller Welten:
- Das Ergebnis von `rechnung` muss gleich `loesung` sein, und zwar eine ganze Zahl ≥ 0. Teilen muss ohne Rest aufgehen.
- Lösung und alle Zahlen in der Rechnung dürfen höchstens 500 sein.
- Pflichtfelder müssen da sein, und das JSON muss gültig sein.
- Zu jeder Aufgabe muss mindestens ein Bild passen. Fehlt eins, gibt es nur eine Warnung, keinen Fehler.

Was das Skript **nicht** prüfen kann: ob `rechnung` wirklich zur Geschichte passt. Deshalb schaut der Vater neue Kapitel kurz durch (oder spielt sie mit).

## Spielstand

Gespeichert wird in einer Datei `spielstand.json` je Welt, nach jeder richtigen Antwort. Sie enthält pro Kapitel die Zahl der gelösten Aufgaben und die Punkte sowie die gesammelten Abzeichen. Die Gesamtpunktzahl wird aus den Kapiteln berechnet und nicht extra gespeichert. Name und Symbol eines Abzeichens kommen aus der Kapiteldatei.

```json
{
  "kapitel": {
    "01-angriff-auf-den-sternzerstoerer": { "geloest": 5, "punkte": 65, "fertig": true },
    "02-flucht-von-hoth": { "geloest": 2, "punkte": 30, "fertig": false }
  },
  "abzeichen": ["01-angriff-auf-den-sternzerstoerer"]
}
```

Fehlversuche bei der gerade offenen Aufgabe werden nicht gespeichert. Wird das Spiel mitten in einer Aufgabe geschlossen, beginnt sie beim nächsten Start wieder mit 0 Versuchen. Beim Neustart geht es genau bei der offenen Aufgabe weiter. Zum Zurücksetzen löscht man die Datei.

## Technik (Entscheidung von Claude)

- **Browser-Spiel:** eine HTML-Seite mit einfachem JavaScript, ohne Framework und ohne Build-Schritt.
- **Ein kleiner lokaler Node-Server** (`server.js`, ohne Abhängigkeiten; Node 24 ist installiert). Er wird gebraucht, weil der Browser von sich aus weder einen Ordner auflisten (Bildsuche) noch Dateien schreiben (Spielstand) kann. Der Server liefert die Seite, die Kapitel und die Bilder aus, listet die Bilder einer Welt auf und speichert den Spielstand. Er lauscht nur auf `localhost`.
- **Start per Doppelklick** auf `start.bat`: Die Datei startet den Server und öffnet den Browser.
- Die Welt wählt man über `welt.json`. Gibt es mehrere Welten, erscheint vorher eine Auswahl. Solange es nur Star Wars gibt, fällt diese Auswahl weg.

## Dem Builder überlassen

- Das genaue Aussehen im Rahmen von Layout B und dem dunklen Star-Wars-Look.
- Formulierung der Erfolgs- und Fehlermeldungen.
- Inhalte der ersten 3 Star-Wars-Kapitel nach den Regeln oben, mit den Bildern, die vorhanden sind.

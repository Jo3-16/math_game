// Prüft alle Kapitel aller Welten: node pruefe.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rechne, rechneMitRest, findeBilder } from './public/logik.js';
import { bilderListe } from './server.js';

const FELDER = ['geschichte', 'frage', 'rechnung', 'tipp', 'merke'];
const leer = wert => typeof wert !== 'string' || !wert.trim();

export async function pruefeWelt(weltOrdner) {
  const fehler = [], warnungen = [];

  const welt = await fs.readFile(path.join(weltOrdner, 'welt.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (!welt || leer(welt.name) || leer(welt.helfer) || typeof welt.farben !== 'object') {
    fehler.push('welt.json: fehlt, ist kaputt oder ohne name/helfer/farben');
  }

  const bilder = await bilderListe(path.join(weltOrdner, 'bilder'));
  const dateien = (await fs.readdir(path.join(weltOrdner, 'kapitel')).catch(() => []))
    .filter(d => d.endsWith('.json')).sort();

  for (const datei of dateien) {
    let kapitel;
    try {
      kapitel = JSON.parse(await fs.readFile(path.join(weltOrdner, 'kapitel', datei), 'utf8'));
    } catch (e) {
      fehler.push(`${datei}: kein gültiges JSON (${e.message})`);
      continue;
    }
    if (leer(kapitel.titel) || leer(kapitel.abzeichen?.name) || leer(kapitel.abzeichen?.symbol) || !Array.isArray(kapitel.aufgaben)) {
      fehler.push(`${datei}: titel, abzeichen.name, abzeichen.symbol oder aufgaben fehlt`);
      continue;
    }
    const b = kapitel.bonus;
    if (b !== undefined && (leer(b.geschichte) || leer(b.frage) || leer(b.tipp) || !Number.isInteger(b.loesung) || b.loesung < 0 || b.loesung > 500)) {
      fehler.push(`${datei}: Bonus-Rätsel braucht geschichte, frage, tipp und eine ganze loesung von 0 bis 500`);
    }
    if (kapitel.vorschau !== undefined && !bilder.includes(kapitel.vorschau)) {
      fehler.push(`${datei}: Vorschaubild "${kapitel.vorschau}" gibt es nicht im Bilder-Ordner`);
    }
    if (kapitel.aufgaben.length < 4 || kapitel.aufgaben.length > 6) {
      fehler.push(`${datei}: ${kapitel.aufgaben.length} Aufgaben, erlaubt sind 4 bis 6`);
    }
    kapitel.aufgaben.forEach((a, i) => {
      const wo = `${datei} Aufgabe ${i + 1}`;
      const fehlend = FELDER.filter(f => leer(a[f]));
      if (!Array.isArray(a.bild) || !a.bild.length) fehlend.push('bild');
      if (!Number.isInteger(a.loesung)) fehlend.push('loesung');
      if (fehlend.length) return fehler.push(`${wo}: fehlt oder leer: ${fehlend.join(', ')}`);

      const mitRest = a.rest !== undefined;
      const ergebnis = mitRest ? rechneMitRest(a.rechnung) : rechne(a.rechnung);
      if (ergebnis.fehler) fehler.push(`${wo}: Rechnung "${a.rechnung}": ${ergebnis.fehler}`);
      else if (ergebnis.wert !== a.loesung) fehler.push(`${wo}: "${a.rechnung}" ergibt ${ergebnis.wert}, nicht ${a.loesung}`);
      else if (mitRest && (ergebnis.rest !== a.rest || a.rest === 0)) {
        fehler.push(`${wo}: "${a.rechnung}" hat Rest ${ergebnis.rest}, nicht ${a.rest}` + (a.rest === 0 ? ' (Rest-Aufgaben brauchen einen Rest)' : ''));
      }

      if (!new RegExp(`(^|\\D)${a.loesung}(\\D|$)`).test(a.merke)) {
        fehler.push(`${wo}: merke "${a.merke}" enthält die Lösung ${a.loesung} nicht`);
      }
      if (!findeBilder(bilder, a.bild).length) warnungen.push(`${wo}: kein Bild zu ${a.bild.join(', ')}`);
    });
  }
  return { fehler, warnungen };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const weltenOrdner = path.join(path.dirname(fileURLToPath(import.meta.url)), 'welten');
  let alleFehler = 0, anzahl = 0;
  for (const id of await fs.readdir(weltenOrdner)) {
    const r = await pruefeWelt(path.join(weltenOrdner, id));
    r.fehler.forEach(f => console.log(`FEHLER  ${id}/${f}`));
    r.warnungen.forEach(w => console.log(`WARNUNG ${id}/${w}`));
    alleFehler += r.fehler.length;
    anzahl += (await fs.readdir(path.join(weltenOrdner, id, 'kapitel')).catch(() => [])).filter(d => d.endsWith('.json')).length;
  }
  if (alleFehler) {
    console.log(`${alleFehler} Fehler gefunden.`);
    process.exit(1);
  }
  console.log(`OK: ${anzahl} Kapitel geprüft`);
}

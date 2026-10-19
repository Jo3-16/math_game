import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pruefeWelt } from '../pruefe.js';

const aufgabe = (aenderung = {}) => ({
  bild: ['x-wing'], geschichte: 'G', frage: 'F?', rechnung: '12 / 4', loesung: 3, tipp: 'T', merke: '3 X-Wings pro Gruppe', ...aenderung,
});

function welt(aufgaben, welt = { name: 'W', helfer: 'Yoda', farben: {} }) {
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-pruefe-'));
  fs.mkdirSync(path.join(ordner, 'kapitel'));
  fs.mkdirSync(path.join(ordner, 'bilder'));
  fs.writeFileSync(path.join(ordner, 'bilder', 'X-Wing.jpg'), '');
  fs.writeFileSync(path.join(ordner, 'welt.json'), JSON.stringify(welt));
  fs.writeFileSync(path.join(ordner, 'kapitel', '01-test.json'),
    JSON.stringify({ titel: 'T', abzeichen: { name: 'A', symbol: '🏅' }, aufgaben }));
  return ordner;
}

const vier = (erste = {}) => [aufgabe(erste), aufgabe(), aufgabe(), aufgabe()];

test('gültiges kapitel', async () => {
  assert.deepEqual(await pruefeWelt(welt(vier())), { fehler: [], warnungen: [] });
});

test('falsche loesung', async () => {
  const r = await pruefeWelt(welt(vier({ loesung: 4, merke: '4 X-Wings pro Gruppe' })));
  assert.equal(r.fehler.length, 1);
  assert.match(r.fehler[0], /01-test\.json Aufgabe 1/);
});

test('zahl über 500', async () => {
  assert.equal((await pruefeWelt(welt(vier({ rechnung: '250 * 3', loesung: 750, merke: '750 X-Wings' })))).fehler.length, 1);
});

test('fehlendes bild nur warnung', async () => {
  const r = await pruefeWelt(welt(vier({ bild: ['ewok'] })));
  assert.equal(r.fehler.length, 0);
  assert.equal(r.warnungen.length, 1);
});

test('fehlendes feld', async () => {
  assert.equal((await pruefeWelt(welt(vier({ tipp: '' })))).fehler.length, 1);
});

test('zu wenige aufgaben', async () => {
  assert.equal((await pruefeWelt(welt([aufgabe(), aufgabe(), aufgabe()]))).fehler.length, 1);
});

test('kaputtes json', async () => {
  const ordner = welt(vier());
  fs.writeFileSync(path.join(ordner, 'kapitel', '02-kaputt.json'), '{');
  assert.equal((await pruefeWelt(ordner)).fehler.length, 1);
});

test('welt.json unvollständig', async () => {
  assert.equal((await pruefeWelt(welt(vier(), { name: 'W' }))).fehler.length, 1);
});

test('vorschaubild vorhanden', async () => {
  const ordner = welt(vier());
  const datei = path.join(ordner, 'kapitel', '01-test.json');
  const kapitel = JSON.parse(fs.readFileSync(datei, 'utf8'));
  fs.writeFileSync(datei, JSON.stringify({ ...kapitel, vorschau: 'X-Wing.jpg' }));
  assert.deepEqual(await pruefeWelt(ordner), { fehler: [], warnungen: [] });
});

test('vorschaubild fehlt als datei', async () => {
  const ordner = welt(vier());
  const datei = path.join(ordner, 'kapitel', '01-test.json');
  const kapitel = JSON.parse(fs.readFileSync(datei, 'utf8'));
  fs.writeFileSync(datei, JSON.stringify({ ...kapitel, vorschau: 'Kapitelbilder/gibtsnicht.jpg' }));
  assert.match((await pruefeWelt(ordner)).fehler[0], /Vorschaubild/);
});

test('merke fehlt', async () => {
  assert.match((await pruefeWelt(welt(vier({ merke: '' })))).fehler[0], /merke/);
});

test('merke ohne lösungszahl', async () => {
  const r = await pruefeWelt(welt(vier({ merke: '13 X-Wings pro Gruppe' })));
  assert.equal(r.fehler.length, 1);
  assert.match(r.fehler[0], /merke/);
});

function mitBonus(bonus) {
  const ordner = welt(vier());
  const datei = path.join(ordner, 'kapitel', '01-test.json');
  fs.writeFileSync(datei, JSON.stringify({ ...JSON.parse(fs.readFileSync(datei, 'utf8')), bonus }));
  return ordner;
}

test('bonus-rätsel gültig', async () => {
  const r = await pruefeWelt(mitBonus({ geschichte: 'G', frage: 'F?', loesung: 36, tipp: 'T' }));
  assert.deepEqual(r, { fehler: [], warnungen: [] });
});

test('bonus-rätsel unvollständig', async () => {
  const r = await pruefeWelt(mitBonus({ geschichte: 'G', frage: 'F?', loesung: 'viele' }));
  assert.equal(r.fehler.length, 1);
  assert.match(r.fehler[0], /Bonus/);
});

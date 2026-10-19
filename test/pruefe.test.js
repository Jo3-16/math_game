import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pruefeWelt } from '../pruefe.js';

const aufgabe = (aenderung = {}) => ({
  bild: ['x-wing'], geschichte: 'G', frage: 'F?', rechnung: '12 / 4', loesung: 3, tipp: 'T', ...aenderung,
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
  const r = await pruefeWelt(welt(vier({ loesung: 4 })));
  assert.equal(r.fehler.length, 1);
  assert.match(r.fehler[0], /01-test\.json Aufgabe 1/);
});

test('zahl über 500', async () => {
  assert.equal((await pruefeWelt(welt(vier({ rechnung: '250 * 3', loesung: 750 })))).fehler.length, 1);
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

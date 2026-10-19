import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { starte } from '../server.js';

let server, url, wurzel;

before(async () => {
  wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-server-'));
  const datei = (rel, inhalt) => {
    fs.mkdirSync(path.dirname(path.join(wurzel, rel)), { recursive: true });
    fs.writeFileSync(path.join(wurzel, rel), inhalt);
  };
  datei('public/index.html', '<!doctype html>');
  datei('einstellungen.json', JSON.stringify({ adminPasswort: 'geheim' }));
  datei('welten/testwelt/welt.json', JSON.stringify({ name: 'Test', helfer: 'Yoda', farben: {} }));
  datei('welten/testwelt/kapitel/02-b.json', JSON.stringify({ titel: 'B' }));
  datei('welten/testwelt/kapitel/01-a.json', JSON.stringify({ titel: 'A' }));
  datei('welten/testwelt/bilder/Sternzerstörer/tie fighter.jpg', 'bild');
  datei('welten/testwelt/bilder/x.webp', 'bild');
  datei('welten/testwelt/bilder/notiz.txt', 'kein bild');
  server = await starte({ wurzel, port: 0 });
  url = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('startseite', async () => {
  assert.equal((await fetch(url + '/')).status, 200);
});

test('welten auflisten', async () => {
  assert.deepEqual(await (await fetch(`${url}/api/welten`)).json(), [{ id: 'testwelt', name: 'Test' }]);
});

test('welt laden', async () => {
  const w = await (await fetch(`${url}/api/welten/testwelt`)).json();
  assert.equal(w.helfer, 'Yoda');
  assert.deepEqual(w.kapitel.map(k => k.id), ['01-a', '02-b']);
  assert.equal(w.kapitel[0].titel, 'A');
  assert.deepEqual(w.bilder.sort(), ['Sternzerstörer/tie fighter.jpg', 'x.webp']);
});

test('unbekannte welt', async () => {
  assert.equal((await fetch(`${url}/api/welten/gibtsnicht`)).status, 404);
});

test('bild mit umlaut und leerzeichen', async () => {
  const pfad = 'Sternzerstörer/tie fighter.jpg'.split('/').map(encodeURIComponent).join('/');
  const antwort = await fetch(`${url}/welten/testwelt/bilder/${pfad}`);
  assert.equal(antwort.status, 200);
  assert.equal(await antwort.text(), 'bild');
});

test('pfad-ausbruch', async () => {
  fs.writeFileSync(path.join(wurzel, 'geheim.txt'), 'geheim');
  for (const p of ['/welten/testwelt/bilder/..%2F..%2F..%2Fgeheim.txt', '/..%2Fgeheim.txt', '/%2e%2e/geheim.txt', '/api/welten/..%2F..', '/welten/testwelt/welt.json'])
    assert.equal((await fetch(url + p)).status, 404, p);
});

test('spielstand', async () => {
  const sUrl = `${url}/api/welten/testwelt/spielstand`;
  assert.equal(await (await fetch(sUrl)).json(), null);
  const s = { kapitel: {}, abzeichen: ['01-a'] };
  assert.equal((await fetch(sUrl, { method: 'PUT', body: JSON.stringify(s) })).status, 204);
  assert.deepEqual(await (await fetch(sUrl)).json(), s);
  assert.equal((await fetch(sUrl, { method: 'PUT', body: '{kaputt' })).status, 400);
  fs.writeFileSync(path.join(wurzel, 'welten/testwelt/spielstand.json'), '{kaputt');
  assert.equal(await (await fetch(sUrl)).json(), null);
});

test('belegter port wird gemeldet statt abzustürzen', async () => {
  await assert.rejects(starte({ wurzel, port: server.address().port }), { code: 'EADDRINUSE' });
});

const anmeldung = passwort => ({ headers: { Authorization: 'Basic ' + Buffer.from('papa:' + passwort).toString('base64') } });

test('admin-seite braucht das passwort', async () => {
  const ohne = await fetch(`${url}/admin`);
  assert.equal(ohne.status, 401);
  assert.match(ohne.headers.get('www-authenticate'), /Basic/);
  assert.equal((await fetch(`${url}/admin`, anmeldung('falsch'))).status, 401);
  const mit = await fetch(`${url}/admin`, anmeldung('geheim'));
  assert.equal(mit.status, 200);
  assert.equal(await mit.text(), '<!doctype html>');
});

test('einstellungen.json wird nicht ausgeliefert', async () => {
  assert.equal((await fetch(`${url}/einstellungen.json`)).status, 404);
});

test('abzeichen-seite liefert das spiel', async () => {
  assert.equal(await (await fetch(`${url}/abzeichen`)).text(), '<!doctype html>');
});

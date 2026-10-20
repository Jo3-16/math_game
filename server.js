// Lokaler Server: liefert Seite, Welten, Kapitel und Bilder aus und speichert den Spielstand.
import http from 'node:http';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 8642;
const PROJEKT = path.dirname(fileURLToPath(import.meta.url));
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
};
export const BILD_ENDUNGEN = ['.jpg', '.jpeg', '.png', '.webp'];

export async function bilderListe(ordner) {
  const eintraege = await fs.readdir(ordner, { recursive: true }).catch(() => []);
  return eintraege
    .map(e => e.replaceAll('\\', '/'))
    .filter(e => BILD_ENDUNGEN.includes(path.extname(e).toLowerCase()));
}

// Kapitel-Kennungen (Dateiname ohne .json) in der Reihenfolge aus welt.json; nicht aufgeführte alphabetisch hinten.
export function kapitelReihenfolge(dateien, reihenfolge = []) {
  const ids = dateien.filter(d => d.endsWith('.json')).map(d => d.slice(0, -5));
  return [...reihenfolge.filter(id => ids.includes(id)), ...ids.filter(id => !reihenfolge.includes(id)).sort()];
}

const leseJson = async datei => JSON.parse(await fs.readFile(datei, 'utf8'));

// Ein Pfadsegment ist nur erlaubt, wenn es nach dem Dekodieren nicht aus seinem Ordner herausführt.
function sichereSegmente(segmente) {
  const dekodiert = segmente.map(s => { try { return decodeURIComponent(s); } catch { return null; } });
  return dekodiert.every(s => s && s !== '.' && s !== '..' && !/[\\/:\0]/.test(s)) ? dekodiert : null;
}

export function starte({ wurzel = PROJEKT, port = PORT } = {}) {
  const welten = path.join(wurzel, 'welten');
  // einstellungen.json (nicht im Git): { "adminPasswort": "…" } – ohne Datei ist /admin offen.
  let einstellungen = {};
  try { einstellungen = JSON.parse(readFileSync(path.join(wurzel, 'einstellungen.json'), 'utf8')); } catch { /* keine Einstellungen */ }
  const adminErlaubt = req => {
    if (!einstellungen.adminPasswort) return true;
    const [art, wert] = (req.headers.authorization ?? '').split(' ');
    const passwort = art === 'Basic' ? Buffer.from(wert ?? '', 'base64').toString().split(':').slice(1).join(':') : '';
    return passwort === einstellungen.adminPasswort;
  };

  async function weltOrdner(id) {
    const ordner = path.join(welten, id);
    await fs.access(path.join(ordner, 'welt.json'));
    return ordner;
  }

  async function bearbeite(req, res) {
    const roh = new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean);
    const teile = sichereSegmente(roh);
    if (!teile) return [404];

    if (teile[0] === 'api' && teile[1] === 'welten') {
      if (teile.length === 2) {
        const ids = await fs.readdir(welten).catch(() => []);
        const liste = [];
        for (const id of ids) {
          const welt = await leseJson(path.join(welten, id, 'welt.json')).catch(() => null);
          if (welt) liste.push({ id, name: welt.name });
        }
        return [200, liste];
      }
      const ordner = await weltOrdner(teile[2]);
      if (teile.length === 3 && req.method === 'GET') {
        const welt = await leseJson(path.join(ordner, 'welt.json'));
        const ids = kapitelReihenfolge(await fs.readdir(path.join(ordner, 'kapitel')).catch(() => []), welt.reihenfolge);
        const kapitel = [];
        for (const id of ids) kapitel.push({ id, ...await leseJson(path.join(ordner, 'kapitel', id + '.json')) });
        return [200, { ...welt, kapitel, bilder: await bilderListe(path.join(ordner, 'bilder')) }];
      }
      if (teile.length === 4 && teile[3] === 'spielstand') {
        const datei = path.join(ordner, 'spielstand.json');
        if (req.method === 'GET') return [200, await leseJson(datei).catch(() => null)];
        if (req.method === 'PUT') {
          let body = '';
          for await (const stueck of req) body += stueck;
          try { JSON.parse(body); } catch { return [400]; }
          await fs.writeFile(datei + '.tmp', body);
          await fs.rename(datei + '.tmp', datei);
          return [204];
        }
      }
      return [404];
    }

    let datei;
    if (teile[0] === 'welten' && teile[2] === 'bilder' && teile.length > 3) {
      datei = path.join(await weltOrdner(teile[1]), 'bilder', ...teile.slice(3));
    } else {
      if (teile.length === 1 && teile[0] === 'admin' && !adminErlaubt(req)) return [401];
      const seite = teile.length === 0 || (teile.length === 1 && ['admin', 'abzeichen', 'archiv'].includes(teile[0]));
      datei = path.join(wurzel, 'public', ...(seite ? ['index.html'] : teile));
    }
    return [200, await fs.readFile(datei), TYPEN[path.extname(datei).toLowerCase()] ?? 'application/octet-stream'];
  }

  const server = http.createServer(async (req, res) => {
    try {
      const [status, inhalt, typ] = await bearbeite(req, res);
      if (status === 401) return res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Mathe-Missionen Admin", charset="UTF-8"' }).end('Passwort nötig');
      if (inhalt === undefined) return res.writeHead(status).end();
      if (Buffer.isBuffer(inhalt)) return res.writeHead(status, { 'Content-Type': typ }).end(inhalt);
      res.writeHead(status, { 'Content-Type': TYPEN['.json'] }).end(JSON.stringify(inhalt));
    } catch {
      res.writeHead(404).end(); // fehlende Datei, unbekannte Welt, Ordner statt Datei …
    }
  });
  return new Promise((ok, fehler) => {
    server.once('error', fehler);
    server.listen(port, '127.0.0.1', () => ok(server));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = `http://localhost:${PORT}`;
  try {
    await starte();
    console.log(`Mathe-Missionen läuft auf ${url} – Fenster offen lassen, Strg+C beendet.`);
  } catch (e) {
    if (e.code !== 'EADDRINUSE') throw e;
    console.log(`Mathe-Missionen läuft schon auf ${url} – dieses Fenster kann zu.`);
  }
  if (process.argv.includes('--open')) exec(`start "" ${url}`);
}

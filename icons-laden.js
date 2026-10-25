// Lädt fehlende Icons aus public/icons.js als SVG nach public/icons/<set>/<begriff>.svg (Iconify-Pakete über jsDelivr).
import fs from 'node:fs/promises';
import { ICON_SETS, ICONS } from './public/icons.js';

const quellen = ['Icons für Menü, Ränge und Abzeichen – Quelle je Set (über Iconify, https://iconify.design):'];
for (const set of ICON_SETS.filter(s => s.prefix)) {
  quellen.push(`${set.id}/: ${set.quelle}`);
  const fehlend = Object.entries(ICONS).filter(([b, n]) => n[set.id]).map(([b, n]) => [b, n[set.id]]);
  const ordner = `public/icons/${set.id}`;
  await fs.mkdir(ordner, { recursive: true });
  const vorhanden = new Set(await fs.readdir(ordner));
  const neu = fehlend.filter(([b]) => !vorhanden.has(`${b}.svg`));
  if (!neu.length) continue;
  const paket = await (await fetch(`https://cdn.jsdelivr.net/npm/@iconify-json/${set.prefix}@1/icons.json`)).json();
  for (const [begriff, name] of neu) {
    let n = name, icon = paket.icons[n];
    while (!icon && paket.aliases?.[n]) { n = paket.aliases[n].parent; icon = paket.icons[n]; }
    if (!icon) { console.log(`FEHLT ${set.prefix}:${name} (${begriff})`); continue; }
    const b = icon.width ?? paket.width ?? 16, h = icon.height ?? paket.height ?? 16;
    await fs.writeFile(`${ordner}/${begriff}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.left ?? 0} ${icon.top ?? 0} ${b} ${h}">${icon.body}</svg>\n`);
  }
  console.log(`${set.id}: ${neu.length} Icons geladen`);
}
await fs.writeFile('public/icons/QUELLEN.txt', quellen.join('\n') + '\n');

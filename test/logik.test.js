import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisiere, findeBilder, rechne, istRichtig, punkteFuer, leererStand, kapitelStatus, aufgabeGeloest, gesamtPunkte, mitName, rang, sterneFuer, kapitelSterne, mitSternen, bonusGeloest } from '../public/logik.js';

test('normalisiere', () => {
  assert.equal(normalisiere('X-wing_SWB.webp'), 'x wing swb.webp');
  assert.equal(normalisiere('Sternzerstörer'.normalize('NFD')), 'sternzerstoerer');
  assert.equal(normalisiere('Sternzerstörer/tie  fighter.jpg'), 'sternzerstoerer tie fighter.jpg');
});

test('findeBilder', () => {
  const p = ['X-wing_SWB.webp', 'Sternzerstörer/537558-Mac.jpg', 'sterzerstörer_Star-Destroyer_ab6b.jpeg', 'tie fighter.jpg'];
  assert.deepEqual(findeBilder(p, ['x wing']), ['X-wing_SWB.webp']);
  assert.deepEqual(findeBilder(p, ['sternzerstörer', 'star-destroyer']), ['Sternzerstörer/537558-Mac.jpg', 'sterzerstörer_Star-Destroyer_ab6b.jpeg']);
  assert.deepEqual(findeBilder(p, ['tie_fighter']), ['tie fighter.jpg']);
  assert.deepEqual(findeBilder(p, ['ewok']), []);
});

test('rechne', () => {
  assert.deepEqual(rechne('12 / 4'), { wert: 3 });
  assert.deepEqual(rechne('3 * 8 / 2'), { wert: 12 });
  assert.deepEqual(rechne('(120 + 30) - 4 * 5'), { wert: 130 });
  assert.ok(rechne('7 / 2 * 2').fehler);       // Rest bei Zwischenschritt
  assert.ok(rechne('300 + 300 - 200').fehler); // Zwischenergebnis > 500
  assert.ok(rechne('501').fehler);
  assert.ok(rechne('5 - 8').fehler);           // negativ
  assert.ok(rechne('alert(1)').fehler);
  assert.ok(rechne('3 *').fehler);
  assert.ok(rechne('(3 + 4').fehler);
  assert.ok(rechne('3 4').fehler);
  assert.ok(rechne('').fehler);
});

test('istRichtig', () => {
  assert.equal(istRichtig(' 12 ', 12), true);
  assert.equal(istRichtig('12', 13), false);
  for (const e of ['', '12.', 'zwölf', '1e1', '-12']) assert.equal(istRichtig(e, 12), false);
});

test('punkteFuer', () => {
  assert.equal(punkteFuer(0), 15);
  assert.equal(punkteFuer(1), 15);
  assert.equal(punkteFuer(2), 10);
});

test('kapitelStatus', () => {
  const s = { kapitel: { a: { geloest: 5, punkte: 75, fertig: true }, b: { geloest: 2, punkte: 25, fertig: false } }, abzeichen: ['a'] };
  assert.deepEqual(kapitelStatus(s, ['a', 'b', 'c']), ['fertig', 'offen', 'gesperrt']);
  assert.deepEqual(kapitelStatus(leererStand(), ['a', 'b']), ['offen', 'gesperrt']);
});

test('aufgabeGeloest bis Kapitelende', () => {
  let s = leererStand();
  s = aufgabeGeloest(s, 'a', 2, 0);
  assert.deepEqual(s.kapitel.a, { geloest: 1, punkte: 15, fertig: false });
  const vorher = s;
  s = aufgabeGeloest(s, 'a', 2, 3);
  assert.deepEqual(s.kapitel.a, { geloest: 2, punkte: 25, fertig: true });
  assert.deepEqual(s.abzeichen, ['a']);
  assert.equal(vorher.kapitel.a.geloest, 1); // nicht mutiert
  assert.equal(gesamtPunkte(s), 25);
});

test('spielername', () => {
  assert.equal(leererStand().name, 'C3-Jo');
  assert.equal(aufgabeGeloest({ ...leererStand(), name: 'Luke' }, 'a', 5, 0).name, 'Luke');
  assert.equal(mitName({ kapitel: {}, abzeichen: [] }).name, 'C3-Jo'); // alter Spielstand ohne Namen
  assert.equal(mitName(leererStand(), '  Rey  ').name, 'Rey');
  assert.equal(mitName(leererStand(), '   ').name, 'C3-Jo');
  assert.equal(mitName(leererStand(), 'X'.repeat(40)).name.length, 20);
});

test('findeBilder mit ordner-suchwort', () => {
  const p = ['X-Wing/01_Trench-Run.png', 'X-Wing/Hoth/02.png', 'Dagobah/06_X-Wing_im_Sumpf.png', 'X-wing_SWB.webp'];
  assert.deepEqual(findeBilder(p, ['x-wing/']), ['X-Wing/01_Trench-Run.png', 'X-Wing/Hoth/02.png']);
  assert.deepEqual(findeBilder(p, ['x wing/', 'sumpf']), ['X-Wing/01_Trench-Run.png', 'X-Wing/Hoth/02.png', 'Dagobah/06_X-Wing_im_Sumpf.png']);
  assert.deepEqual(findeBilder(p, ['wing/']), []); // Ordnername muss ganz passen
});

test('rang nach gesamtpunkten', () => {
  assert.deepEqual(rang(0), { name: 'Jüngling', symbol: '🌱', naechster: { name: 'Padawan', ab: 150 } });
  assert.equal(rang(149).name, 'Jüngling');
  assert.equal(rang(150).name, 'Padawan');
  assert.equal(rang(500).name, 'Jedi-Ritter');
  assert.deepEqual(rang(1000), { name: 'Jedi-Meister', symbol: '🧙', naechster: null });
});

test('sterne', () => {
  assert.equal(sterneFuer(5, 5), 3);
  assert.equal(sterneFuer(3, 5), 2);
  assert.equal(sterneFuer(2, 5), 1);
  assert.equal(sterneFuer(3, 6), 2);
  // aus gespeicherten Punkten: 15 je Aufgabe ohne Tipp, 10 mit Tipp
  assert.equal(kapitelSterne({ geloest: 5, punkte: 75, fertig: true }, 5), 3);
  assert.equal(kapitelSterne({ geloest: 5, punkte: 70, fertig: true }, 5), 2);
  assert.equal(kapitelSterne({ geloest: 5, punkte: 55, fertig: true }, 5), 1);
  assert.equal(kapitelSterne({ geloest: 5, punkte: 55, fertig: true, sterne: 3 }, 5), 3);
  assert.equal(kapitelSterne({ geloest: 5, punkte: 95, fertig: true, bonus: true }, 5), 3); // Bonus zählt nicht mit
  assert.equal(kapitelSterne({ geloest: 2, punkte: 30, fertig: false }, 5), 0);
  assert.equal(kapitelSterne(undefined, 5), 0);
});

test('mitSternen verbessert nur', () => {
  let s = aufgabeGeloest(leererStand(), 'a', 1, 5);
  s = mitSternen(s, 'a', 2);
  assert.equal(s.kapitel.a.sterne, 2);
  assert.equal(mitSternen(s, 'a', 1).kapitel.a.sterne, 2);
  assert.equal(mitSternen(s, 'a', 3).kapitel.a.sterne, 3);
});

test('bonusGeloest gibt einmal 20 punkte', () => {
  let s = aufgabeGeloest(leererStand(), 'a', 1, 0);
  s = bonusGeloest(s, 'a');
  assert.equal(s.kapitel.a.bonus, true);
  assert.equal(gesamtPunkte(s), 35);
  assert.equal(gesamtPunkte(bonusGeloest(s, 'a')), 35);
});

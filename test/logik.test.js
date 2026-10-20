import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalisiere, findeBilder, rechne, istRichtig, punkteFuer, leererStand, kapitelStatus, aufgabeGeloest, gesamtPunkte, mitName, rang, sterneFuer, kapitelSterne, mitSternen, bonusGeloest, rechneMitRest, rechenarten, mitStatistik, erzeugeAufgabe, SIMULATOR_ARTEN, migriereStand, maxFuer, mitRang, SIMULATOR_STUFEN, simulatorAufgabeGeloest, simulatorStufen, mitFalscherAntwort } from '../public/logik.js';

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
  assert.deepEqual(rechne('3 * 1000 + 450', 9999), { wert: 3450 }); // Einheiten: bis 9999
  assert.ok(rechne('10 * 1000', 9999).fehler);
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
  assert.deepEqual(rang(0), { index: 0, name: 'Jüngling', symbol: '🌱', naechster: { name: 'Padawan', symbol: '🟢', ab: 200 } });
  assert.equal(rang(199).name, 'Jüngling');
  assert.equal(rang(200).name, 'Padawan');
  assert.equal(rang(600).name, 'Jedi-Ritter');
  assert.equal(rang(1200).name, 'Jedi-Meister');
  assert.deepEqual(rang(2000), { index: 4, name: 'Großmeister', symbol: '🌟', naechster: null });
});

test('rang: nie degradieren', () => {
  assert.equal(rang(160, 1).name, 'Padawan'); // gespeicherter Rang zählt, auch wenn die Punkte nicht mehr reichen
  assert.equal(rang(700, 1).name, 'Jedi-Ritter'); // höherer Rang aus Punkten gewinnt
});

test('mitRang merkt den höchsten Rang', () => {
  const punkte = p => ({ ...leererStand(), kapitel: { a: { geloest: 1, punkte: p, fertig: false } } });
  // alter Spielstand ohne gespeicherten Rang: einmalig nach den alten Grenzen (150/500/1000)
  assert.equal(mitRang(punkte(160)).rangIndex, 1);
  assert.equal(mitRang(punkte(90)).rangIndex, 0);
  // mit gespeichertem Rang gelten die neuen Grenzen, aber es geht nie nach unten
  assert.equal(mitRang({ ...punkte(160), rangIndex: 0 }).rangIndex, 0);
  assert.equal(mitRang({ ...punkte(160), rangIndex: 2 }).rangIndex, 2);
  assert.equal(mitRang({ ...punkte(650), rangIndex: 1 }).rangIndex, 2);
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

test('rechneMitRest', () => {
  assert.deepEqual(rechneMitRest('25 / 4'), { wert: 6, rest: 1 });
  assert.deepEqual(rechneMitRest('(4 * 6 + 3) / 5'), { wert: 5, rest: 2 });
  assert.deepEqual(rechneMitRest('24 / 4'), { wert: 6, rest: 0 });
  assert.ok(rechneMitRest('25 / 0').fehler);
  assert.ok(rechneMitRest('25 + 4').fehler);           // keine Division
  assert.ok(rechneMitRest('10 + 15 / 4').fehler);      // links nicht geklammert
  assert.ok(rechneMitRest('25 / (2 + 2)').fehler);     // Teiler muss eine Zahl sein
  assert.ok(rechneMitRest('600 / 7').fehler);          // über 500
});

test('rechenarten', () => {
  assert.deepEqual(rechenarten({ rechnung: '12 / 4' }), ['geteilt']);
  assert.deepEqual(rechenarten({ rechnung: '240 - 12 * 15' }), ['mal', 'plusminus']);
  assert.deepEqual(rechenarten({ rechnung: '25 / 4', rest: 1 }), ['rest']);
  assert.deepEqual(rechenarten({ rechnung: '2 * 60 + 15', art: 'einheiten' }), ['einheiten']);
  assert.deepEqual(rechenarten({}), ['raetsel']);
});

test('mitStatistik', () => {
  let s = mitStatistik(leererStand(), ['mal', 'plusminus'], 2, '01#3');
  s = mitStatistik(s, ['mal'], 0, '01#4');
  assert.deepEqual(s.statistik.arten.mal, { aufgaben: 2, fehlversuche: 2, mitTipp: 1 });
  assert.deepEqual(s.statistik.arten.plusminus, { aufgaben: 1, fehlversuche: 2, mitTipp: 1 });
  assert.deepEqual(s.statistik.aufgaben, { '01#3': 2 });
  assert.equal(leererStand().statistik, undefined);
});

test('erzeugeAufgabe', () => {
  let x = 0;
  const zufall = () => (x = (x * 9301 + 49297) % 233280) / 233280; // feste Zufallsfolge
  for (const art of SIMULATOR_ARTEN.map(a => a.id)) {
    for (let i = 0; i < 200; i++) {
      const a = erzeugeAufgabe(art, zufall);
      const r = a.rest !== undefined ? rechneMitRest(a.rechnung) : rechne(a.rechnung, maxFuer(a));
      assert.ok(!r.fehler, `${art}: ${a.rechnung} – ${r.fehler}`);
      assert.equal(r.wert, a.loesung, a.rechnung);
      if (a.rest !== undefined) assert.ok(r.rest === a.rest && a.rest > 0, a.rechnung);
      assert.ok(a.frage && a.tipp && !new RegExp(`(^|\\D)${a.loesung}(\\D|$)`).test(a.tipp), `${art}: ${a.frage} / ${a.tipp}`);
    }
  }
});

test('migriereStand: alte Kapitel-Kennungen mit Nummer werden zu Namen', () => {
  const alt = {
    name: 'Rey',
    kapitel: { '00-pilotentraining': { geloest: 6, punkte: 90, fertig: true }, 'angriff': { geloest: 1, punkte: 15, fertig: false } },
    abzeichen: ['00-pilotentraining'],
    statistik: { arten: { mal: { aufgaben: 1, fehlversuche: 2, mitTipp: 1 } }, aufgaben: { '01-angriff#1': 2, 'angriff#Bonus': 1 } },
  };
  const neu = migriereStand(alt);
  assert.deepEqual(Object.keys(neu.kapitel), ['pilotentraining', 'angriff']);
  assert.deepEqual(neu.abzeichen, ['pilotentraining']);
  assert.deepEqual(neu.statistik.aufgaben, { 'angriff#1': 2, 'angriff#Bonus': 1 });
  assert.equal(alt.abzeichen[0], '00-pilotentraining'); // nicht mutiert
  assert.deepEqual(migriereStand(leererStand()), leererStand());
});

test('maxFuer: plus/minus bis 999, einheiten bis 9999, sonst 500', () => {
  assert.equal(maxFuer({ rechnung: '600 + 300' }), 999);
  assert.equal(maxFuer({ rechnung: '950 - 120 - 30' }), 999);
  assert.equal(maxFuer({ rechnung: '240 - 12 * 15' }), 500); // gemischt mit Mal
  assert.equal(maxFuer({ rechnung: '25 / 4', rest: 1 }), 500);
  assert.equal(maxFuer({ rechnung: '3 * 1000 + 450', art: 'einheiten' }), 9999);
});

test('simulator plus/minus nutzt den zahlenraum bis 999', () => {
  let x = 7;
  const zufall = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const loesungen = Array.from({ length: 300 }, () => erzeugeAufgabe('plusminus', zufall).loesung);
  assert.ok(loesungen.some(l => l > 500), 'auch Ergebnisse über 500');
  assert.ok(loesungen.every(l => l >= 0 && l <= 999));
});

test('simulator-abzeichen bei 5, 10, 20, 40 gelösten aufgaben je rechenart', () => {
  assert.deepEqual(SIMULATOR_STUFEN.map(s => s.ab), [5, 10, 20, 40]);
  let s = leererStand();
  const neu = [];
  for (let i = 0; i < 40; i++) {
    const r = simulatorAufgabeGeloest(s, 'mal');
    s = r.stand;
    if (r.neuesAbzeichen) neu.push(`${s.simulatorGeloest.mal}:${r.neuesAbzeichen.name}`);
  }
  assert.deepEqual(neu, ['5:Bronze', '10:Silber', '20:Gold', '40:Meister']);
  assert.equal(simulatorAufgabeGeloest(s, 'mal').neuesAbzeichen, null); // nach 40 kommt nichts mehr
  assert.equal(simulatorAufgabeGeloest(s, 'rest').stand.simulatorGeloest.rest, 1); // je Rechenart getrennt
  assert.deepEqual(simulatorStufen(12).map(st => st.name), ['Bronze', 'Silber']);
  assert.deepEqual(simulatorStufen(0), []);
});

test('mitFalscherAntwort merkt die letzten 10 falschen antworten je aufgabe', () => {
  let s = mitFalscherAntwort(leererStand(), 'angriff#1', '5');
  s = mitFalscherAntwort(s, 'angriff#1', '6 Rest 2');
  assert.deepEqual(s.statistik.falsch, { 'angriff#1': ['5', '6 Rest 2'] });
  for (let i = 0; i < 12; i++) s = mitFalscherAntwort(s, 'angriff#1', String(i));
  assert.equal(s.statistik.falsch['angriff#1'].length, 10);
  assert.equal(s.statistik.falsch['angriff#1'].at(-1), '11');
  assert.deepEqual(leererStand().statistik, undefined); // unverändert
});

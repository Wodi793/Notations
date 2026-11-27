// Progression and key-prediction checks. Usage: node tests/progressions.js [-v]
const path = require('path');
const E = require(process.env.ENGINE || path.join(__dirname, '../js/engine.js'));
const ProgCheck = require(path.join(__dirname, '../js/progcheck.js'));
const DATA = require('./progressions.json');
const find = (id) => E.PRESETS.find((p) => p.id === id);
const r = ProgCheck.run(E, DATA, find, 105);
let fails = 0;
for (const p of r.progressions) {
  if (p.problems.length) fails++;
  console.log(`${p.problems.length ? 'FAIL' : 'PASS'} ${p.id} ${p.name}  ${Math.round(p.ms)} ms  ${p.run.join('  →  ')}`);
  for (const x of p.problems) console.log('     ' + x);
}
for (const k of r.keys) { if (!k.ok) fails++; console.log(`${k.ok ? 'PASS' : 'FAIL'} key, ${k.chords} chord${k.chords > 1 ? 's' : ''}: ${k.got} (want ${k.want}, confidence ${k.confidence})`); }
console.log('PENDING analyzeProgression: Roman numerals and functions (analysis round)');
console.log('PENDING importMusicXML: score import into the progression format (analysis round)');
const pp = r.progressions.filter((p) => !p.problems.length).length, kk = r.keys.filter((k) => k.ok).length;
console.log(`\nprogressions ${pp}/${r.progressions.length}, keys ${kk}/${r.keys.length}`);
process.exit(fails ? 1 : 0);

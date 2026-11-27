// Round trip: the name the engine gives a chord must parse back to the same notes (pitch classes and, for a
// slash chord, the bass). Run over the Lab set and over every pitch-class set of up to five notes built on C.
// Usage: node tests/chordname.js [-v]
const path = require('path');
const E = require(process.env.ENGINE || path.join(__dirname, '../js/engine.js'));
const C = require(path.join(__dirname, '../js/chordname.js'));
const verbose = process.argv.includes('-v');
const find = (id) => (id === 'piano' ? E.PIANO : E.PRESETS.find((p) => p.id === id));
const cases = require('./lab-cases.json').cases;
function check(A) {
  const p = C.parse(A.name);
  // Same notes: every note of the chord is named, and the name adds nothing beyond the tones it implies but the
  // voicing may leave out (the 5th, and the 9th under an 11 or 13).
  const want = [...A.pcs].sort((a, b) => a - b), got = p.ok ? [...new Set(p.pcs)].sort((a, b) => a - b) : [];
  const extra = got.filter((pc) => !want.includes(pc)), optional = p.ok ? p.optional.map((iv) => (p.rootPc + iv) % 12) : [];
  const ok = p.ok && want.every((pc) => got.includes(pc)) && extra.every((pc) => optional.includes(pc)) && (!A.isSlash || p.bassPc === A.bass.pc);
  return { ok, want: want.join(','), got: p.ok ? got.join(',') : 'fail', p };
}
let labOk = 0, labN = 0, allOk = 0, allN = 0;
const bad = [];
for (const tc of cases) {
  const src = E.resolveSource(Object.assign({ capos: [] }, tc.source), find), A = E.analyze(E.sourceNotes(src));
  labN++; const r = check(A); if (r.ok) labOk++; else bad.push(`lab ${tc.id} ${A.name}: want ${r.want} got ${r.got} ${r.p.message || ''}`);
}
for (let mask = 1; mask < 4096; mask++) {
  let n = 0; for (let i = 0; i < 12; i++) if (mask >> i & 1) n++;
  if (n < 2 || n > 5 || !(mask & 1)) continue; // a lone note is not a chord
  const ps = []; for (let i = 0; i < 12; i++) if (mask >> i & 1) ps.push(60 + i);
  const A = E.analyze(ps); allN++; const r = check(A); if (r.ok) allOk++; else bad.push(`set ${A.name}: want ${r.want} got ${r.got} ${r.p.message || ''}`);
}
console.log(`round trip: Lab ${labOk}/${labN}, every chord up to five notes ${allOk}/${allN}`);
if (verbose || labOk < labN) for (const b of bad.slice(0, verbose ? 400 : 20)) console.log('  ' + b);
process.exit(labOk === labN ? 0 : 1);

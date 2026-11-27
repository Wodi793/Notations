// Times translate and the capo suggestion on the cases named in the Round Two brief.
const path = require('path');
const E = require(process.env.ENGINE || path.join(__dirname, '../js/engine.js'));
const P = (s) => E.parseNotes(s), preset = (id) => E.PRESETS.find((p) => p.id === id);
const CASES = [['Mandolin', 'mandolin', 'Cmaj9, close', 'C4 E4 G4 B4 D5'], ['Mandolin', 'mandolin', '7-note spread', 'C3 G3 E4 B4 D5 F#5 A5'],
  ['Guitar', 'guitar', 'Cmaj9, close', 'C4 E4 G4 B4 D5'], ['Guitar', 'guitar', '7-note spread', 'C3 G3 E4 B4 D5 F#5 A5']];
const time = (fn, n) => { fn(); const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) fn(); return Number(process.hrtime.bigint() - t) / 1e6 / n; };
console.log('Target    Voicing          translate  capo suggestion');
for (const [name, id, label, notes] of CASES) {
  const req = { source: { kind: 'piano', pitches: P(notes) }, target: preset(id), capos: [] };
  console.log(`${name.padEnd(9)} ${label.padEnd(16)} ${time(() => E.translate(req), 10).toFixed(1).padStart(6)} ms  ${time(() => E.suggestCapo(req), 5).toFixed(1).padStart(6)} ms`);
}

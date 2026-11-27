// Parity suite: records the engine's exact output on a fixed set of inputs, then checks every later
// build against it. A Swift port must reproduce the same file.
// Usage: node test/parity.js          compare against test/parity-golden.json
//        node test/parity.js --update  rewrite the golden file (only when a change is intended)
const fs = require('fs'), path = require('path');
const ENGINE = process.env.ENGINE || path.join(__dirname, '../src/engine.js');
const E = require(ENGINE);
const GOLDEN = path.join(__dirname, 'parity-golden.json');
const P = (s) => E.parseNotes(s);
const preset = (id) => E.PRESETS.find((p) => p.id === id);

// Voicings chosen to cover every rule: triads, sevenths, extensions, alterations, slash chords, wide spreads.
const VOICINGS = [
  'C4 E4 G4', 'E4 G4 C5', 'G3 C4 E4', 'A3 C4 E4', 'F3 A3 C4 F4', 'D4 F#4 A4', 'B3 D4 F4', 'C4 E4 G#4',
  'D4 G4 A4', 'D4 E4 A4', 'C4 E4 G4 A4', 'A3 C4 E4 F#4', 'G3 B3 D4 F4', 'C4 E4 G4 B4', 'A3 C4 E4 G4',
  'B3 D4 F4 A4', 'B3 D4 F4 G#4', 'G3 C4 D4 F4', 'C4 E4 G4 B4 D5', 'A3 C4 E4 G4 B4', 'G2 F3 B3 E4',
  'D3 F#3 C4 F4', 'G3 B3 F4 Ab4', 'C3 E3 Bb3 D4 F#4', 'C3 G3 E4 B4 D5 F#5 A5', 'E2 B2 E3 G#3 B3 E4',
  'A3 C4 F4', 'E3 G3 C4', 'Bb2 F3 D4 Ab4 C5', 'F#3 A#3 C#4 E4 G4', 'Db4 F4 Ab4 C5', 'E4', 'C4 G4',
  'D2 A2 D3 G3 A3 D4', 'G3 D4 B4 G5', 'C3 G3 D4 E4', 'A2 E3 G3 C4 E4', 'F2 C3 A3 E4 G4', 'Eb3 G3 Bb3 D4',
  'B2 F3 A3 D4 G4',
];
const TARGETS = ['piano', ...E.PRESETS.map((p) => p.id)];
const pack = (r) => ({ t: r.text, s: r.score, d: r.difficulty, b: r.breakdown.map((x) => x.key + ':' + x.points).join(' '), f: (r.flags || []).map((x) => x.code).join(' '), c: r.compromise.text });
function run() {
  const out = { engine: E.VERSION, analyze: {}, translate: {}, capos: {}, lab: {}, learn: null };
  // 1. Names for every pitch-class set of size 1 to 5 built up from C4, plus the voicings above.
  for (let mask = 1; mask < 4096; mask++) {
    let n = 0; for (let i = 0; i < 12; i++) if (mask >> i & 1) n++;
    if (n > 5 || !(mask & 1)) continue;
    const ps = []; for (let i = 0; i < 12; i++) if (mask >> i & 1) ps.push(60 + i);
    const A = E.analyze(ps); out.analyze[ps.join(',')] = A.name + '|' + A.family;
  }
  for (const v of VOICINGS) { const A = E.analyze(P(v)); out.analyze[v] = A.name + '|' + A.family + '|' + A.colourLine; }
  // 2. Every voicing to every target, top four plus the first twelve ranked.
  for (const v of VOICINGS) for (const t of TARGETS) {
    const target = t === 'piano' ? E.PIANO : preset(t);
    const r = E.translate({ source: { kind: 'piano', pitches: P(v) }, target, options: { ranked: 12 } });
    out.translate[v + ' > ' + t] = { results: r.results.map(pack), ranked: r.ranked.map((x) => x.t || x.text + ' ' + x.score).join(' | '), flags: r.flags.map((f) => f.code).join(' ') };
  }
  // 3. Capos: a full capo, a partial capo, and the capo suggestion.
  const g = preset('guitar'), bj = preset('banjo-g');
  for (const v of VOICINGS.slice(0, 20)) {
    for (const [name, inst, capos] of [['guitar capo 2', g, [E.fullCapo(g, 2)]], ['guitar cut 2', g, [E.partialCapo(g, 2, [1, 2, 3])]], ['banjo spike 7', bj, [E.partialCapo(bj, 7, [0])]]]) {
      const r = E.translate({ source: { kind: 'piano', pitches: P(v) }, target: inst, capos });
      out.capos[v + ' > ' + name] = r.results.map(pack);
    }
    const s = E.suggestCapo({ source: { kind: 'piano', pitches: P(v) }, target: g, capos: [] });
    out.capos[v + ' > suggest'] = s ? s.label + ' ' + s.from + '>' + s.to : null;
  }
  // 4. The Lab set.
  const TESTS = require('./../src/tests.js');
  const find = (id) => (id === 'piano' ? E.PIANO : preset(id));
  for (const tc of TESTS) {
    const t = Object.assign({}, tc); if (t.capoFret) t.capos = [E.fullCapo(find(t.target), t.capoFret)];
    const r = E.runTest(t, find);
    out.lab[tc.id] = { rank: r.rank, results: r.results.map(pack) };
  }
  // 5. Learning: a fixed run of picks.
  let taste = E.newTaste();
  for (const v of VOICINGS.slice(0, 12)) {
    const r = E.translate({ source: { kind: 'piano', pitches: P(v) }, target: preset('mandolin') });
    if (r.results.length < 2) continue;
    taste = E.learn(taste, { ctxKey: E.contextKey(r.analysis, preset('mandolin')), winner: r.results[1], losers: [r.results[0], ...r.results.slice(2)], strength: 1 });
  }
  out.learn = taste;
  return out;
}
const t0 = Date.now(), cur = run(), ms = Date.now() - t0;
const count = Object.keys(cur.analyze).length + Object.keys(cur.translate).length + Object.keys(cur.capos).length + Object.keys(cur.lab).length + 1;
if (process.argv.includes('--update') || !fs.existsSync(GOLDEN)) {
  fs.writeFileSync(GOLDEN, JSON.stringify(cur, null, 0).replace(/\},"/g, '},\n"'));
  console.log(`parity: wrote ${count} cases in ${ms} ms (engine ${cur.engine})`);
} else {
  const gold = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  let bad = 0;
  for (const sec of ['analyze', 'translate', 'capos', 'lab']) for (const k of Object.keys(gold[sec])) {
    const a = JSON.stringify(gold[sec][k]), b = JSON.stringify(cur[sec][k]);
    if (a !== b) { if (bad++ < 8) console.log(`DIFF ${sec} ${k}\n  was ${a.slice(0, 300)}\n  now ${String(b).slice(0, 300)}`); }
  }
  if (JSON.stringify(gold.learn) !== JSON.stringify(cur.learn)) { bad++; console.log('DIFF learn'); }
  console.log(bad ? `parity: ${bad} of ${count} cases differ` : `parity: all ${count} cases identical (${ms} ms)`);
  process.exit(bad ? 1 : 0);
}

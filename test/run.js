// Runs the starter test set against the engine with default weights.
// Usage: node test/run.js [-v]
const Engine = require('../src/engine.js');
const TESTS = require('../src/tests.js');
const verbose = process.argv.includes('-v');
const find = (id) => (id === 'piano' ? Engine.PIANO : Engine.PRESETS.find((p) => p.id === id));
let top1 = 0, top3 = 0, worst = 0;
for (const tc of TESTS) {
  const t = Object.assign({}, tc);
  if (t.capoFret) t.capos = [Engine.fullCapo(find(t.target), t.capoFret)];
  const t0 = process.hrtime.bigint();
  const r = Engine.runTest(t, find);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  worst = Math.max(worst, ms);
  if (r.rank === 1) top1++;
  if (r.rank >= 1 && r.rank <= 3) top3++;
  console.log(`${r.rank >= 1 && r.rank <= 3 ? 'PASS' : 'FAIL'} ${tc.id} ${r.analysis.name.padEnd(9)} ${tc.name} → ${tc.target}  rank ${r.rank || '-'}  ${ms.toFixed(1)}ms  top: ${r.results.map((x) => `${x.text} (${x.score}/${x.difficulty})`).join('  ')}`);
  if (verbose || !(r.rank >= 1 && r.rank <= 3)) {
    for (const x of r.ranked.slice(0, 8)) console.log(`      ${x.text.padEnd(18)} ${String(x.score).padStart(5)} d${x.difficulty}  ${x.breakdown.map((b) => `${b.key} ${b.points}`).join(', ')}`);
    for (const f of tc.accept || []) {
      const e = Engine.evaluate({ source: Engine.resolveSource(tc.source, find), target: find(tc.target), capos: t.capos, fingering: f });
      console.log(`    want ${e.text.padEnd(18)} ${String(e.score).padStart(5)} d${e.difficulty}  ${e.breakdown.map((b) => `${b.key} ${b.points}`).join(', ')} ${e.violations.join('; ')}`);
    }
  }
}
const n = TESTS.length;
console.log(`\ntop-1 ${top1}/${n} (${Math.round((100 * top1) / n)}%)   top-3 ${top3}/${n} (${Math.round((100 * top3) / n)}%)   slowest ${worst.toFixed(1)}ms`);
process.exit(top3 / n >= 0.8 ? 0 : 1);

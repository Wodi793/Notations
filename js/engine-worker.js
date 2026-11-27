/* ENGINE WORKER — runs the engine off the screen's thread. Each request carries an id; the page drops answers
   to requests it has moved past. In the artifact build this file is joined to the engine's source in a blob. */
if (typeof Engine === 'undefined') importScripts('engine.js');
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const OPS = {
  ping: () => 'pong',
  translate: (req) => Engine.translate(req),
  // Only what the capo verdict needs, so little has to be copied back.
  translateTop: (req) => { const r = Engine.translate(req).results[0]; return r ? { score: r.score, bassTier: r.bassTier } : null; },
  sameNotes: (req) => Engine.sameNotes(req),
  // The Lab: every case, plus timings measured on this device.
  lab: ({ tests, instruments, weights, timing }) => {
    const byId = new Map(instruments.map((i) => [i.id, i]));
    const find = (id) => (id === 'piano' ? Engine.PIANO : byId.get(id));
    const rows = tests.map((tc) => Engine.runTest(tc, find, weights || {}, {}));
    let times = null;
    if (timing) {
      const tr = [], cp = [];
      for (const tc of tests) {
        const target = find(tc.target), source = Engine.resolveSource(tc.source, find);
        if (!target || (source.kind === 'strings' && !source.instrument)) continue;
        const req = { source, target, capos: tc.capos || [] };
        let t = performance.now(); Engine.translate(req); tr.push(performance.now() - t);
        if (target.kind !== 'piano') { t = performance.now(); Engine.suggestCapo(req); cp.push(performance.now() - t); }
      }
      times = { translate: { median: median(tr), slowest: Math.max(0, ...tr) }, capo: { median: median(cp), slowest: Math.max(0, ...cp) }, cases: tr.length };
    }
    return { rows, times };
  },
};
self.onmessage = (e) => {
  const { id, op, arg } = e.data;
  try { self.postMessage({ id, ok: true, value: OPS[op](arg) }); } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err) }); }
};

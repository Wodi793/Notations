/* ENGINE CLIENT — asks the worker. If no worker can start (some sandboxes block them), the same calls run on the
   page's thread, each after a pause that lets the screen draw first. */
const Eng = {
  worker: null, ready: false, seq: 0, pending: new Map(), mode: 'starting',
  start() {
    try {
      if (BUILD === 'artifact') {
        const src = document.getElementById('engine-src').textContent + '\n' + document.getElementById('worker-src').textContent;
        this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      } else this.worker = new Worker('js/engine-worker.js');
      this.worker.onmessage = (e) => this.answer(e.data);
      this.worker.onerror = () => this.fallback();
      const t = setTimeout(() => this.fallback(), 2500);
      this.send('ping').then(() => { clearTimeout(t); if (this.mode === 'starting') { this.mode = 'worker'; this.ready = true; } });
    } catch (e) { this.fallback(); }
  },
  fallback() {
    if (this.mode === 'main') return;
    this.mode = 'main';
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* already gone */ } }
    this.worker = null;
    const waiting = [...this.pending.values()]; this.pending.clear();
    for (const p of waiting) if (p.op !== 'ping') this.local(p.op, p.arg).then(p.resolve, p.reject);
  },
  answer(d) { const p = this.pending.get(d.id); if (!p) return; this.pending.delete(d.id); d.ok ? p.resolve(d.value) : p.reject(new Error(d.error)); },
  send(op, arg) {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { op, arg, resolve, reject });
      this.worker.postMessage({ id, op, arg });
    });
  },
  local(op, arg) {
    return new Promise((resolve, reject) => setTimeout(() => {
      try {
        if (op === 'translate') resolve(E.translate(arg));
        else if (op === 'translateTop') { const r = E.translate(arg).results[0]; resolve(r ? { score: r.score, bassTier: r.bassTier } : null); }
        else if (op === 'sameNotes') resolve(E.sameNotes(arg));
        else if (op === 'lab') {
          const byId = new Map(arg.instruments.map((i) => [i.id, i])), find = (id) => (id === 'piano' ? E.PIANO : byId.get(id));
          resolve({ rows: arg.tests.map((tc) => E.runTest(tc, find, arg.weights || {}, {})), times: null });
        } else resolve(null);
      } catch (e) { reject(e); }
    }, 16));
  },
  call(op, arg) { return this.worker ? this.send(op, arg) : this.local(op, arg); },
};
Eng.start();

/* SOUND — press to hear, once. Plucked strings (Karplus-Strong) and a simple piano. */
const Snd = {
  ctx: null, cache: new Map(), cur: null, primed: false,
  unlock() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; this.ctx = new AC(); }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.primed) { const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0); this.primed = true; }
    return true;
  },
  freq: (p) => S.settings.a4 * Math.pow(2, (p - 69) / 12),
  // Karplus-Strong pluck; brightness and decay scale loosely with pitch.
  pluck(p) {
    const key = p + '@' + S.settings.a4;
    if (this.cache.has(key)) return this.cache.get(key);
    const sr = this.ctx.sampleRate, f = this.freq(p), N = Math.max(2, Math.round(sr / f));
    const dur = clamp(3.2 - (p - 40) * 0.03, 1.3, 3.2), len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const bright = clamp(0.3 + (p - 36) / 80, 0.25, 0.9), damp = Math.exp(-(0.8 + (p - 40) * 0.012) / f);
    let seed = 12345 + p * 977, prev = 0;
    for (let i = 0; i < N; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; const w = seed / 2147483648 - 1; prev += bright * (w - prev); d[i] = prev; }
    for (let i = N; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1]);
    const fade = Math.floor(sr * 0.06);
    for (let i = 0; i < fade; i++) d[len - 1 - i] *= i / fade;
    this.cache.set(key, buf);
    return buf;
  },
  voicePluck(p, g, t, out) {
    const s = this.ctx.createBufferSource(), gn = this.ctx.createGain();
    s.buffer = this.pluck(p); gn.gain.value = g; s.connect(gn); gn.connect(out); s.start(t);
  },
  voicePiano(p, g, t, out) {
    const c = this.ctx, f = this.freq(p), dur = clamp(3 - (p - 36) * 0.025, 1.1, 3);
    const env = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 7);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(g, t + 0.006); env.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    [[1, 'sine', 1], [2, 'triangle', 0.22], [3, 'sine', 0.1], [4, 'sine', 0.05]].forEach(([m, type, a]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = type; o.frequency.value = f * m; og.gain.value = a; o.connect(og); og.connect(env); o.start(t); o.stop(t + dur + 0.05);
    });
    env.connect(lp); lp.connect(out);
  },
  // events: [{main, pitches:[{p,g}]}] in strum order. One play, then silence.
  play(events, piano) {
    if (!events.length || !this.unlock()) return;
    const c = this.ctx, now = c.currentTime + 0.03;
    if (this.cur) { this.cur.gain.setTargetAtTime(0, c.currentTime, 0.02); }
    const master = c.createGain();
    const voices = events.reduce((a, e) => a + e.pitches.length, 0);
    master.gain.value = (piano ? 0.5 : 0.75) / Math.sqrt(Math.max(1, voices / 2));
    master.connect(c.destination); this.cur = master;
    const hit = (ev, t) => ev.pitches.forEach((x) => (piano ? this.voicePiano(x.p, x.g, t, master) : this.voicePluck(x.p, x.g, t, master)));
    if (S.settings.play === 'arp') {
      const up = events.slice().sort((a, b) => a.main - b.main), seq = [...up, ...up.slice(0, -1).reverse()];
      let t = now;
      seq.forEach((ev, i) => { hit(ev, t); t += i === up.length - 1 ? 0.19 : 0.11; });
    } else events.forEach((ev, i) => hit(ev, now + (piano ? 0 : i * 0.012)));
    if (!S.settings.hintShown) { S.settings.hintShown = true; save(); toast('No sound? Check the silent switch.'); }
  },
};
function eventsOf(inst, capos, voicing) {
  if (isPiano(inst)) return voicing.pitches.slice().sort((a, b) => a - b).map((p) => ({ main: p, pitches: [{ p, g: 1 }] }));
  const P = E.prepare(inst, capos), ev = [];
  voicing.fingering.forEach((f, c) => {
    if (f == null || f < 0) return;
    const o = f === 0 ? P.open[c] : P.fret[c][f];
    if (o) ev.push({ main: o.main, pitches: o.pitches.map((p, s) => ({ p, g: inst.courses[c].strings[s].role === 'octave' ? 0.63 : 1 })) });
  });
  return ev;
}


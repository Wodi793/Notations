/* SOUND — press to hear, once. Plucked strings (Karplus-Strong) and a simple piano. */
/* Piano samples: the Salamander Grand Piano (Alexander Holm, CC BY 3.0), one velocity layer sampled every minor
   third, A0 to C8. Fetched after the first tap; until they arrive, or if they fail, the synthesized piano plays.
   Notes in between change the playback rate of the nearest sample. */
const SAMPLE_NAMES = ['A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8'];
const PianoSamples = {
  state: 'idle', buffers: new Map(),
  midiOf: (i) => 21 + 3 * i,
  async load(ctx) {
    if (this.state !== 'idle') return;
    this.state = 'loading';
    const inline = window.NOTATIONS_PIANO_SAMPLES;
    if (BUILD === 'artifact' && !inline) { this.state = 'none'; return; }
    try {
      await Promise.all(SAMPLE_NAMES.map(async (name, i) => {
        let data;
        if (inline) { const bin = atob(inline[name]); data = new Uint8Array(bin.length); for (let k = 0; k < bin.length; k++) data[k] = bin.charCodeAt(k); data = data.buffer; }
        else { const r = await fetch(`samples/piano/${name}.m4a`); if (!r.ok) throw new Error(name); data = await r.arrayBuffer(); }
        const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
        this.buffers.set(this.midiOf(i), buf);
      }));
      this.state = 'ready';
    } catch (e) { this.buffers.clear(); this.state = 'failed'; }
  },
  // The nearest sample at or below/above the pitch, and the playback rate that reaches it.
  pick(p) {
    if (this.state !== 'ready') return null;
    const i = clamp(Math.round((p - 21) / 3), 0, SAMPLE_NAMES.length - 1), base = this.midiOf(i), buf = this.buffers.get(base);
    return buf ? { buf, rate: Math.pow(2, (p - base) / 12) * (S.settings.a4 / 440) } : null;
  },
};
/* iOS notes. Web audio starts only from a touch. Silent mode mutes ordinary web audio unless the page declares
   itself a playback app (navigator.audioSession, Safari 17+). After a call, other apps' audio, sleep or switching
   apps, the context can sit in 'interrupted' or 'suspended' and must be woken; if it will not wake, it is thrown
   away and a fresh one is made on the next tap. */
const Snd = {
  ctx: null, cache: new Map(), cur: null, primed: false, dead: false, hinted: false,
  declarePlayback() {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
  },
  // Synchronous part, run inside the gesture itself: iOS only honours a resume or a first sound made there.
  unlock() {
    this.declarePlayback();
    if (this.dead && this.ctx) { try { this.ctx.close(); } catch (e) { /* already closed */ } this.ctx = null; }
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC(); this.primed = false; this.dead = false; this.cache.clear(); this.cur = null;
    }
    if (this.ctx.state !== 'running') { try { const r = this.ctx.resume(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* retried in ready() */ } }
    if (PianoSamples.state === 'idle') PianoSamples.load(this.ctx);
    if (!this.primed) {
      try { const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0); this.primed = true; } catch (e) { /* next tap */ }
    }
    return true;
  },
  // Waits for the context to be running. If it won't wake, it is marked dead and replaced on the next tap.
  async ready() {
    if (!this.unlock()) return false;
    if (this.ctx.state !== 'running') {
      try { await Promise.race([this.ctx.resume(), new Promise((r) => setTimeout(r, 500))]); } catch (e) { /* checked below */ }
    }
    if (this.ctx.state !== 'running') { this.dead = true; return false; }
    return true;
  },
  state() {
    const session = navigator.audioSession ? navigator.audioSession.type : 'not supported';
    return { context: this.ctx ? this.ctx.state : 'not started', session, rate: this.ctx ? this.ctx.sampleRate : 0, piano: PianoSamples.state };
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
    const smp = PianoSamples.pick(p);
    if (smp) {
      const src = this.ctx.createBufferSource(), gn = this.ctx.createGain();
      src.buffer = smp.buf; src.playbackRate.value = smp.rate;
      gn.gain.value = g * 1.6; src.connect(gn); gn.connect(out); src.start(t);
      return;
    }
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
  // Returns the schedule [{pitches, at (seconds from now)}], or null when nothing could play.
  async play(events, piano) {
    if (!events.length) return null;
    if (!(await this.ready())) { toast('Sound did not start. Tap play again.'); return null; }
    const c = this.ctx, now = c.currentTime + 0.03, sched = [];
    if (this.cur) { this.cur.gain.setTargetAtTime(0, c.currentTime, 0.02); }
    const master = c.createGain();
    const voices = events.reduce((a, e) => a + e.pitches.length, 0);
    master.gain.value = (piano ? 0.5 : 0.75) / Math.sqrt(Math.max(1, voices / 2));
    master.connect(c.destination); this.cur = master;
    const hit = (ev, t) => { sched.push({ pitches: ev.pitches.map((x) => x.p), main: ev.main, at: t - c.currentTime }); ev.pitches.forEach((x) => (piano ? this.voicePiano(x.p, x.g, t, master) : this.voicePluck(x.p, x.g, t, master))); };
    if (S.settings.play === 'arp') {
      const up = events.slice().sort((a, b) => a.main - b.main), seq = [...up, ...up.slice(0, -1).reverse()];
      let t = now;
      seq.forEach((ev, i) => { hit(ev, t); t += i === up.length - 1 ? 0.19 : 0.11; });
    } else events.forEach((ev, i) => hit(ev, now + (piano ? 0 : i * 0.012)));
    // Without audioSession, Silent mode mutes web audio: say so once per session.
    if (!navigator.audioSession && !this.hinted) { this.hinted = true; toast('No sound? Check the silent switch.'); }
    return sched;
  },
};
function eventsOf(inst, capos, voicing) {
  if (isPiano(inst) || isStaff(inst)) return voicing.pitches.slice().sort((a, b) => a - b).map((p) => ({ main: p, pitches: [{ p, g: 1 }] }));
  const P = E.prepare(inst, capos), ev = [];
  voicing.fingering.forEach((f, c) => {
    if (f == null || f < 0) return;
    const o = f === 0 ? P.open[c] : P.fret[c][f];
    if (o) ev.push({ main: o.main, pitches: o.pitches.map((p, s) => ({ p, g: inst.courses[c].strings[s].role === 'octave' ? 0.63 : 1 })) });
  });
  return ev;
}


// Wake the audio on the gestures iOS trusts, and again when the app comes back to the foreground.
for (const ev of ['pointerdown', 'touchend', 'click']) document.addEventListener(ev, () => Snd.unlock(), { passive: true, capture: true });
function reviveAudio() {
  if (!Snd.ctx || Snd.ctx.state === 'running') return;
  Snd.ctx.resume().catch(() => {}).finally(() => setTimeout(() => { if (Snd.ctx && Snd.ctx.state !== 'running') Snd.dead = true; }, 300));
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reviveAudio(); });
window.addEventListener('pageshow', reviveAudio);

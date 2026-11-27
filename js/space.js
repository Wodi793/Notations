/* SPACE — fitting the screen and moving around: layout after rotation, pinch zoom, the divider between the
   strips, telling taps from drags, moving the view, moving the chord, and other shapes of the same notes. */

/* Layout waits until the size has held for two frames (or 250 ms), so it never lays out mid-rotation. */
let settleRun = 0;
function settleThenLayout() {
  const run = ++settleRun, app = $('#app'), t0 = performance.now();
  let last = '', same = 0;
  const step = () => {
    if (run !== settleRun) return;
    const vv = window.visualViewport, key = app.clientWidth + 'x' + app.clientHeight + (vv ? ':' + Math.round(vv.width) + 'x' + Math.round(vv.height) : '');
    same = key === last ? same + 1 : 0; last = key;
    if (same >= 2 || performance.now() - t0 > 250) { ses.fit.src = true; ses.fit.edit = true; render(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
if (window.ResizeObserver) new ResizeObserver(() => { if (S) settleThenLayout(); }).observe(document.getElementById('app'));
else window.addEventListener('resize', () => { if (S) settleThenLayout(); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (S) settleThenLayout(); });

/* Taps versus drags and pinches: a tap moves under 8 pt and lasts under 300 ms. */
const touch = { x: 0, y: 0, t: 0, moved: false, gestureAt: 0 };
document.addEventListener('pointerdown', (e) => { Object.assign(touch, { x: e.clientX, y: e.clientY, t: performance.now(), moved: false }); }, { passive: true, capture: true });
document.addEventListener('pointermove', (e) => { if (Math.hypot(e.clientX - touch.x, e.clientY - touch.y) >= 8) touch.moved = true; }, { passive: true, capture: true });
function isTap() { return !touch.moved && performance.now() - touch.t < 300 && Date.now() - touch.gestureAt > 350; }

/* Pinch zoom on the keyboard (white keys 22–64 pt) and the fretboard (fret spacing), kept per screen. */
let pinch = null, pinchFrame = 0;
const boxOf = (t) => t && t.closest && t.closest('#srcScroll, #editScroll');
document.addEventListener('touchstart', (e) => {
  const box = boxOf(e.target);
  if (!box || e.touches.length !== 2) return;
  const [a, b] = e.touches, rect = box.getBoundingClientRect(), id = box.id === 'srcScroll' ? 'src' : 'edit', g = GEO[id];
  if (!g) return;
  const kind = g.ww ? 'kb' : 'fb', z0 = g.ww || g.cw, fx = (a.clientX + b.clientX) / 2 - rect.left, origin = g.ww ? 0 : g.zone;
  pinch = { box, id, kind, d0: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z0, fx, origin, anchor: (box.scrollLeft + fx - origin) / z0 };
  touch.gestureAt = Date.now();
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!pinch || e.touches.length !== 2) return;
  e.preventDefault();
  const [a, b] = e.touches, d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const z = pinch.kind === 'kb' ? clamp(pinch.z0 * d / pinch.d0, 22, 64) : clamp(pinch.z0 * d / pinch.d0, 28, 140);
  perScreen('zoom')[pinch.kind] = z;
  touch.gestureAt = Date.now();
  if (pinchFrame) return;
  pinchFrame = requestAnimationFrame(() => {
    pinchFrame = 0;
    if (!pinch) return;
    const zz = perScreen('zoom')[pinch.kind];
    if (pinch.id === 'src') renderSource(); else drawEditor();
    pinch.box.scrollLeft = pinch.origin + pinch.anchor * zz - pinch.fx;
  });
}, { passive: false });
document.addEventListener('touchend', (e) => { if (pinch && e.touches.length < 2) { pinch = null; touch.gestureAt = Date.now(); save(); } }, { passive: true });
// Stop Safari zooming the whole page instead.
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => { if (boxOf(e.target)) e.preventDefault(); }, { passive: false });

/* The divider: drag to share the height between the strips (each at least 120 pt); double-tap to even them. */
(function divider() {
  const el = document.getElementById('divider');
  if (!el) return;
  let drag = null, lastUp = 0;
  const apply = (share) => {
    perScreen('split').share = share;
    const app = $('#app'); app.style.setProperty('--top', share + 'fr'); app.style.setProperty('--bot', (1 - share) + 'fr');
  };
  el.addEventListener('pointerdown', (e) => {
    const src = $('.strip[data-side="src"]'), tgt = $('.strip[data-side="tgt"]');
    drag = { y0: e.clientY, a: src.offsetHeight, b: tgt.offsetHeight };
    el.setPointerCapture(e.pointerId); el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const total = drag.a + drag.b, a = clamp(drag.a + e.clientY - drag.y0, 120, total - 120);
    apply(a / total);
  });
  const end = () => {
    if (!drag) return;
    drag = null; el.classList.remove('dragging');
    const now = Date.now();
    if (now - lastUp < 320) apply(0.5);
    lastUp = now;
    save(); ses.fit.src = true; render();
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    apply(clamp((perScreen('split').share || 0.5) + (e.key === 'ArrowUp' ? -0.05 : 0.05), 0.2, 0.8)); save(); render();
  });
})();

/* Moving the chord by an octave. On a fretboard the same shape moves 12 frets if it fits; otherwise the closest
   playable voicing of the moved notes takes its place, and the app says so. */
function shapeShift(inst, capos, fing, d) {
  const P = E.prepare(inst, capos), out = [];
  for (let c = 0; c < P.n; c++) {
    const f = fing[c];
    if (f == null || f < 0) { out.push(f); continue; }
    const o = f === 0 ? P.open[c] : P.fret[c][f];
    const want = o.main + 12 * d;
    let nf = null;
    if (P.open[c].main === want) nf = 0;
    else for (let k = P.minEff[c] + 1; k <= P.fretCount; k++) if (P.fret[c][k] && P.fret[c][k].main === want && !P.collide[c][k]) { nf = k; break; }
    if (nf == null) return null;
    out.push(nf);
  }
  const h = E.handShape(P, out.map((f) => (f == null ? -1 : f)));
  return h.fingers <= 4 && h.span <= S.settings.impossibleMm ? out : null;
}
function rangeOf(inst, capos) {
  if (isPiano(inst)) return [21, 108];
  const P = E.prepare(inst, capos);
  let lo = 999, hi = 0;
  for (let c = 0; c < P.n; c++) { lo = Math.min(lo, P.open[c].main); const top = P.fret[c][P.fretCount]; if (top) hi = Math.max(hi, top.main); }
  return [lo, hi];
}
function canMoveChord(d) {
  const inst = side('src'), notes = ses.A && !ses.A.empty ? ses.A.notes.map((n) => n.pitch) : [];
  if (!notes.length) return false;
  const [lo, hi] = rangeOf(inst, S.work.srcCapos);
  return d > 0 ? Math.max(...notes) + 12 <= hi : Math.min(...notes) - 12 >= lo;
}
function updateMoveButtons() {
  for (const [id, d] of [['octDown', -1], ['octUp', 1]]) { const b = document.getElementById(id); if (b) b.disabled = !canMoveChord(d); }
  const ns = document.getElementById('nextShape');
  if (ns) ns.disabled = !(ses.A && !ses.A.empty);
}
Object.assign(ACT, {
  async octchord(el) {
    const d = +el.dataset.d, inst = side('src');
    if (!canMoveChord(d)) return;
    if (isPiano(inst)) S.work.piano = S.work.piano.map((p) => p + 12 * d);
    else {
      const fing = srcFing(), moved = shapeShift(inst, S.work.srcCapos, fing, d);
      if (moved) S.work.fing[inst.id] = moved;
      else {
        const pitches = ses.A.notes.filter((n) => n.weight >= 1).map((n) => n.pitch + 12 * d);
        const r = await Eng.call('translate', { source: { kind: 'piano', pitches }, target: inst, capos: S.work.srcCapos, options: opts() });
        if (!r.results.length) return toast('No playable voicing an octave ' + (d > 0 ? 'up' : 'down') + ' here.');
        S.work.fing[inst.id] = r.results[0].fingering.map((f) => (f < 0 ? null : f));
        toast(`The shape doesn't fit an octave ${d > 0 ? 'up' : 'down'}, so this is the closest playable voicing.`);
      }
    }
    ses.shapes = null; ses.fit.src = true; save(true); recompute(0, true); render();
  },
  // Same notes, next position: cycles through every other fingering of exactly these pitches, then back.
  async nextshape() {
    const inst = side('src'), cur = srcFing().map((f) => (f == null ? -1 : f)), key = (f) => f.join(',');
    let sh = ses.shapes;
    if (!sh || sh.inst !== inst.id || key(sh.list[sh.i].fingering) !== key(cur)) {
      const alts = await Eng.call('sameNotes', { target: inst, capos: S.work.srcCapos, fingering: cur, options: opts() });
      if (!alts.length) return toast('There is no other way to play exactly these notes here.');
      sh = ses.shapes = { inst: inst.id, list: [{ fingering: cur }, ...alts], i: 0 };
    }
    sh.i = (sh.i + 1) % sh.list.length;
    S.work.fing[inst.id] = sh.list[sh.i].fingering.map((f) => (f < 0 ? null : f));
    ses.fit.src = true; save(true); recompute(0, true); render();
    toast(sh.i === 0 ? 'Back to your shape.' : `Same notes, shape ${sh.i} of ${sh.list.length - 1}.`);
  },
});

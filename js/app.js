/* APP — the main screen: what is entered, what the engine returns, and drawing it. Everything musical is decided by Engine. */
/* ───────── session ───────── */
const ses = { A: null, out: null, card: 0, picked: null, custom: null, editing: null, view: 'src', capoHint: null, reasons: null, compT: 0, hintT: 0, reasonT: 0, roomy: true, fit: { src: true, edit: true }, gen: 0, pending: false, trT: 0, flashNext: false };
const GEO = {};
const instr = (id) => (id === 'piano' ? E.PIANO : preset(id) || S.instruments.find((i) => i.id === id) || E.TIPLE_TEMPLATES.find((i) => i.id === id));
const side = (s) => instr(S.settings[s]) || (s === 'src' ? E.PIANO : preset('mandolin'));
const isPiano = (i) => i.kind === 'piano';
const detailed = () => S.settings.mode === 'detailed';
const opts = () => ({ comfortMm: S.settings.comfortMm, impossibleMm: S.settings.impossibleMm, preferEasier: S.settings.preferEasier });
function srcFing() {
  const i = side('src');
  let f = S.work.fing[i.id];
  if (!f || f.length !== i.courses.length) f = S.work.fing[i.id] = i.courses.map(() => null);
  return f;
}
function currentSource() {
  const i = side('src');
  if (isPiano(i)) return { kind: 'piano', pitches: S.work.piano.slice().sort((a, b) => a - b) };
  return { kind: 'strings', instrument: i, capos: S.work.srcCapos, fingering: srcFing().map((f) => (f == null ? -1 : f)) };
}
function packSource() {
  const s = currentSource();
  return s.kind === 'piano' ? { kind: 'piano', pitches: s.pitches } : { kind: 'strings', instrument: s.instrument.id, fingering: s.fingering.slice(), capos: clone(s.capos) };
}
const packVoicing = (r) => (r.kind === 'piano' ? { pitches: r.pitches.slice() } : { fingering: r.fingering.slice() });
const allCards = () => (ses.out ? [...(ses.custom ? [ses.custom] : []), ...ses.out.results] : []);
const currentCard = () => allCards()[ses.card] || null;

// The chord is analysed at once (it is cheap), so the source colours and the name update in the same frame as the
// tap. The translation runs in the engine worker after the input settles; a newer input makes older answers stale.
function recompute(delay, flash) {
  const src = currentSource(), tgt = side('tgt');
  ses.gen++;
  clearTimeout(ses.trT); clearTimeout(ses.hintT);
  Object.assign(ses, { A: E.analyze(E.sourceNotes(src)), custom: null, picked: null, reasons: null, capoHint: null, editing: null });
  if (ses.A.empty) { ses.out = null; ses.pending = false; return; }
  ses.ctx = E.contextKey(ses.A, tgt);
  ses.W = E.effectiveWeights(S.weights, S.taste, ses.ctx);
  ses.req = { source: src, target: tgt, capos: isPiano(tgt) ? [] : S.work.tgtCapos, weights: ses.W, options: opts() };
  ses.pending = true;
  if (flash) ses.flashNext = true;
  const gen = ses.gen, req = ses.req;
  ses.trT = setTimeout(() => translateNow(gen, req), delay || 0);
}
async function translateNow(gen, req) {
  let out;
  try { out = await Eng.call('translate', req); } catch (e) { out = E.translate(req); }
  if (gen !== ses.gen) return;
  ses.out = out; ses.pending = false; ses.card = 0;
  renderSource(); renderBridge(); renderTarget();
  if (ses.flashNext) { ses.flashNext = false; flashComp(); }
  scheduleCapo(gen, req);
}
// Capo suggestions come last: only after the results are on screen and input has been quiet for 600 ms, one
// setup at a time, abandoned as soon as anything changes.
function scheduleCapo(gen, req) {
  if (isPiano(req.target)) return;
  ses.hintT = setTimeout(async () => {
    const trials = E.capoTrials(req, S.capoSetups.filter((c) => c.courses === req.target.courses.length));
    for (const t of trials) {
      if (gen !== ses.gen) return;
      try { t.top = await Eng.call('translateTop', Object.assign({}, req, { capos: t.capos })); } catch (e) { return; }
    }
    if (gen !== ses.gen || !ses.out) return;
    const h = E.capoVerdict(ses.out.results[0] || null, trials);
    if (h) { ses.capoHint = h; renderBridge(); }
  }, 600);
}
function markBusy() { const b = $('#tgtBody'); if (b) b.classList.toggle('busy', !!ses.pending); }

/* ───────── drawing ───────── */
function noteColour(A, pitch, isTop, isBass) {
  const r = A && A.roleOfPc ? A.roleOfPc[E.mod12(pitch)] : null;
  if (!r) return 'var(--text2)';
  if (isTop) return 'var(--mint)';
  if (r.role === 'third' || r.role === 'seventh') return 'var(--pale)';
  if (r.role === 'ext' || r.role === 'alt') return 'var(--accent)';
  if (isBass) return 'var(--teal)';
  return 'var(--rich)';
}
function noteLabel(A, pitch) {
  const r = A && A.roleOfPc ? A.roleOfPc[E.mod12(pitch)] : null;
  if (detailed()) return r ? r.label : '?';
  return r ? r.name : E.pitchName(pitch, A && A.flat).replace(/-?\d+$/, '');
}
const visibleFrets = () => (ses.roomy ? 12 : 7);
// White-key width and fret width in points: Bill's pinch zoom if he has set one, else two octaves (three on an
// iPad) and 12 frets (7 when one strip shows).
const keyWidth = (W) => clamp(perScreen('zoom').kb || W / (bigScreen() ? 21 : 14), 22, 64);
const fretWidth = (W) => clamp(perScreen('zoom').fb || (W - 56) / visibleFrets(), 28, 140);

// o: {inst, capos, fing, start, count, W, H, A, status:{pitch:status}, top, bass, id}
function drawFretboard(o) {
  const P = E.prepare(o.inst, o.capos || []), n = P.n, zone = 46, padT = 18, padB = 28;
  const start = o.start || 0, count = o.count, W = o.W, H = o.H;
  const gap = n > 1 ? (H - padT - padB) / (n - 1) : 0, cw = (W - zone - 10) / count;
  const y = (c) => (n > 1 ? padT + (n - 1 - c) * gap : H / 2);
  const fx = (k) => zone + (k - start) * cw, cx = (f) => zone + (f - start - 0.5) * cw;
  const r = clamp(Math.min(gap * 0.46, cw * 0.4), 7, 13), end = start + count;
  if (o.id) GEO[o.id] = { zone, cw, start, n, y, P, fretCount: P.fretCount };
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${o.id ? `data-board="${o.id}"` : ''} role="img" aria-label="${esc(o.inst.name)} fretboard">`;
  const mid = (padT + H - padB) / 2;
  for (const f of [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
    if (f <= start || f > end) continue;
    const dbl = f % 12 === 0, off = Math.min(gap * (n > 2 ? 1 : 0.3), (H - padT - padB) / 4);
    for (const dy of dbl ? [-off, off] : [0]) s += `<circle cx="${cx(f)}" cy="${mid + dy}" r="4" fill="var(--text)" opacity=".15"/>`;
    s += `<text x="${cx(f)}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--text2)">${f}</text>`;
  }
  if (start > 0 && ![3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(start + 1)) s += `<text x="${cx(start + 1)}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--text2)">${start + 1}</text>`;
  for (let k = start; k <= end; k++) {
    if (k === 0) s += `<rect x="${fx(0) - 4}" y="${padT - 6}" width="4" height="${H - padT - padB + 12}" rx="1" fill="var(--deep)"/>`;
    else s += `<line x1="${fx(k)}" y1="${padT - 6}" x2="${fx(k)}" y2="${H - padB + 6}" stroke="var(--hairline)" stroke-width="1"/>`;
  }
  for (let c = 0; c < n; c++) {
    const st = o.inst.courses[c].strings, k = st.length, offs = k === 1 ? [0] : k === 2 ? [-2, 2] : [-3.5, 0, 3.5];
    const x0 = fx(Math.max(start, o.inst.courses[c].startFret || 0));
    st.forEach((str, i) => { s += `<line x1="${x0}" y1="${y(c) + offs[i]}" x2="${fx(end) + 8}" y2="${y(c) + offs[i]}" stroke="var(--string)" stroke-width="${clamp(0.8 + (70 - str.pitch) / 34, 0.8, 2)}"/>`; });
    if ((o.inst.courses[c].startFret || 0) > start) s += `<circle cx="${x0}" cy="${y(c)}" r="2.5" fill="var(--string)"/>`;
  }
  for (const cp of o.capos || []) {
    if (cp.fret <= start || cp.fret > end) continue;
    const cov = [];
    for (let c = 0; c < n; c++) if (o.inst.courses[c].strings.some((_, i) => cp.strings.includes(c + ':' + i))) cov.push(c);
    let a = 0;
    while (a < cov.length) {
      let b = a;
      while (b + 1 < cov.length && cov[b + 1] === cov[b] + 1) b++;
      const w = Math.min(14, cw * 0.4);
      s += `<rect x="${cx(cp.fret) - w / 2}" y="${y(cov[b]) - 8}" width="${w}" height="${y(cov[a]) - y(cov[b]) + 16}" rx="${w / 2}" fill="var(--deep)"/>`;
      a = b + 1;
    }
  }
  const fs = r < 9 ? 8.5 : 10;
  for (let c = 0; c < n; c++) {
    const f = o.fing[c];
    if (f == null) continue;
    const ox = zone - 24;
    if (f < 0) { s += `<text x="${ox}" y="${y(c) + 4.5}" text-anchor="middle" font-size="14" fill="var(--text2)">×</text>`; continue; }
    const opt = f === 0 ? P.open[c] : P.fret[c][f];
    if (!opt) continue;
    const p = opt.main, status = (o.status || {})[p], col = noteColour(o.A, p, p === o.top, p === o.bass), lab = esc(noteLabel(o.A, p));
    const x = f === 0 ? ox : cx(f), yy = y(c);
    if (f > 0 && (f <= start || f > end)) continue;
    if (status === 'dropped') s += `<circle cx="${x}" cy="${yy}" r="${r - 1}" fill="var(--surface)" stroke="var(--deep)" stroke-width="2"/><text x="${x}" y="${yy + 3.5}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="var(--text2)">${lab}</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${yy}" r="${r - 1}" fill="var(--surface)" stroke="${col}" stroke-width="2"/><text x="${x}" y="${yy + 3.5}" text-anchor="middle" font-size="${fs - 1}" font-weight="600" fill="${col}">${lab}</text>`;
    else s += `<circle cx="${x}" cy="${yy}" r="${r}" fill="${col}"/><text x="${x}" y="${yy + 3.5}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="var(--ink)">${lab}</text>`;
    if (status === 'up' || status === 'down') s += `<text x="${x + r + 2}" y="${yy - r + 7}" font-size="11" fill="var(--text)">${status === 'up' ? '↑' : '↓'}</text>`;
    if (detailed() && opt.octs.length) s += `<circle cx="${x + r + 5}" cy="${yy + r - 4}" r="3.5" fill="var(--text2)"><title>Octave string: ${esc(E.pitchName(opt.octs[0]))}</title></circle>`;
  }
  return s + '</svg>';
}

const isWhite = (p) => [0, 2, 4, 5, 7, 9, 11].includes(E.mod12(p));
// o: {lo, hi (white keys), ww, H, notes: Map pitch → {col, label, status}, id}
function drawKeyboard(o) {
  const whites = [];
  for (let p = o.lo; p <= o.hi; p++) if (isWhite(p)) whites.push(p);
  const ww = o.ww, H = o.H, W = whites.length * ww, bh = Math.round(H * 0.6), bw = ww * 0.62, xi = new Map(whites.map((p, i) => [p, i]));
  if (o.id) GEO[o.id] = { ww, lo: o.lo, xOf: (p) => (xi.get(isWhite(p) ? p : p - 1) || 0) * ww };
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" ${o.id ? `data-board="${o.id}"` : ''} role="img" aria-label="Piano keyboard">`;
  const mark = (nt, x, yy, dark) => {
    let t = '';
    if (nt.status === 'up' || nt.status === 'down') t += `<text x="${x}" y="${yy - 13}" text-anchor="middle" font-size="11" fill="${nt.status && nt.sel ? 'var(--ink)' : 'var(--text)'}">${nt.status === 'up' ? '↑' : '↓'}</text>`;
    return t + `<text x="${x}" y="${yy}" text-anchor="middle" font-size="${ww < 30 ? 9 : 10.5}" font-weight="600" fill="${dark ? 'var(--ink)' : 'var(--text2)'}">${esc(nt.label)}</text>`;
  };
  for (const p of whites) {
    const x = xi.get(p) * ww, nt = o.notes.get(p), drop = nt && nt.status === 'dropped';
    s += `<rect data-p="${p}" x="${x + 1}" y="0" width="${ww - 2}" height="${H - 1}" rx="3" fill="${nt && !drop ? nt.col : 'var(--white-key)'}"/>`;
    if (drop) s += `<rect x="${x + 3}" y="${H - 34}" width="${ww - 6}" height="30" rx="4" fill="none" stroke="var(--deep)" stroke-width="2" pointer-events="none"/>`;
    if (nt) s += `<g pointer-events="none">${mark(Object.assign({ sel: !drop }, nt), x + ww / 2, H - 14, !drop)}</g>`;
    else if (E.mod12(p) === 0) s += `<text x="${x + ww / 2}" y="${H - 9}" text-anchor="middle" font-size="9" fill="${p === 60 ? 'var(--text)' : 'var(--text2)'}" opacity="${p === 60 ? 1 : 0.7}" pointer-events="none">C${E.octaveOf(p)}</text>`;
  }
  for (let p = o.lo; p <= o.hi; p++) {
    if (isWhite(p) || !xi.has(p - 1) || !xi.has(p + 1)) continue;
    const x = (xi.get(p - 1) + 1) * ww - bw / 2, nt = o.notes.get(p), drop = nt && nt.status === 'dropped';
    s += `<rect data-p="${p}" x="${x}" y="0" width="${bw}" height="${bh}" rx="2.5" fill="${nt && !drop ? nt.col : 'var(--black-key)'}" stroke="${drop ? 'var(--deep)' : 'var(--hairline)'}" stroke-width="${drop ? 2 : 1}"/>`;
    if (nt) s += `<g pointer-events="none">${mark(Object.assign({ sel: !drop }, nt), x + bw / 2, bh - 9, !drop)}</g>`;
  }
  return s + '</svg>';
}
function keyNotes(A, pitches, top, bass, statusOf) {
  const m = new Map();
  for (const p of pitches) m.set(p, { col: noteColour(A, p, p === top, p === bass), label: noteLabel(A, p), status: statusOf ? statusOf[p] : null });
  return m;
}

/* ───────── render ───────── */
/* ───────── space, zoom and the divider ───────── */
// Settings that depend on the screen are kept per screen (Duo outer, Duo inner, iPad), whatever the orientation.
const screenKey = () => { const a = Math.round(Math.min(screen.width, screen.height)), b = Math.round(Math.max(screen.width, screen.height)); return a + 'x' + b; };
const bigScreen = () => Math.min(screen.width, screen.height) >= 700;
function perScreen(name) { const all = S.settings[name] || (S.settings[name] = {}); return all[screenKey()] || (all[screenKey()] = {}); }
// Both strips show whenever each can have at least 150 pt after the top bar, the bridge band and the divider.
// A small margin either way keeps the layout from flipping back and forth at the edge.
function fitsBoth() {
  const app = $('#app'), bar = $('.bar'), bridge = $('.bridge');
  const bridgeH = ses.roomy ? bridge.offsetHeight : (window.innerWidth < 600 ? 128 : 92);
  const each = (app.clientHeight - bar.offsetHeight - bridgeH - 20 - 14) / 2;
  return ses.roomy ? each >= 144 : each >= 150;
}
function layout() {
  ses.roomy = fitsBoth();
  const app = $('#app');
  const split = perScreen('split').share || 0.5;
  app.style.setProperty('--top', split + 'fr'); app.style.setProperty('--bot', (1 - split) + 'fr');
  app.classList.toggle('roomy', ses.roomy); app.classList.toggle('compact', !ses.roomy);
  app.classList.toggle('detailed', detailed());
  document.querySelectorAll('.strip').forEach((el) => el.classList.toggle('active', el.dataset.side === ses.view));
}
function press(sel, v) { document.querySelectorAll(sel + ' button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
function render() {
  layout();
  $('#chipSrc').innerHTML = `<i>From</i>${esc(side('src').name)}`;
  $('#chipTgt').innerHTML = `<i>To</i>${esc(side('tgt').name)}`;
  press('#segMode', S.settings.mode); press('#segPlay', S.settings.play); press('#segView', ses.view);
  renderSource(); renderBridge(); renderTarget();
}
function statusMap() {
  const c = ses.pending ? null : currentCard(), m = {};
  if (c && !ses.editing) for (const x of c.compromise.sourceMap) m[x.pitch] = x.status === 'kept' ? null : x.status;
  return m;
}
function renderSource() {
  const inst = side('src'), A = ses.A, box = $('#srcScroll'), piano = isPiano(inst);
  let iv = '';
  if (detailed() && A && !A.empty) iv = A.notes.map((n, i) => esc(n.nameOct) + (A.intervals[i] ? `<i class="${A.intervals[i].rub ? 'rub' : ''}">${A.intervals[i].short}${A.intervals[i].rub ? ' rub' : ''}</i>` : '')).join('');
  const capoOn = !piano && S.work.srcCapos.length;
  $('#srcRow').innerHTML = `<span class="rubric srcname">Source · ${esc(inst.name)}</span><span class="grow ivals">${iv}</span>` +
    `<button class="iconbtn" data-act="view" data-d="-1" aria-label="${piano ? 'Show lower keys' : 'Show lower frets'}">${ICON.left}</button><button class="iconbtn" data-act="view" data-d="1" aria-label="${piano ? 'Show higher keys' : 'Show higher frets'}">${ICON.right}</button>` +
    `<button class="txtbtn" data-act="octchord" data-d="-1" id="octDown" aria-label="Move the chord down an octave">Oct ↓</button><button class="txtbtn" data-act="octchord" data-d="1" id="octUp" aria-label="Move the chord up an octave">Oct ↑</button>` +
    (piano ? '' : `<button class="txtbtn" data-act="nextshape" id="nextShape" aria-label="Same notes, next position"><span class="long">Next shape</span><span class="short">Shape</span></button><button class="txtbtn ${capoOn ? 'on' : ''}" data-act="instr" data-side="src">Capo${capoOn ? ' ' + S.work.srcCapos.map((c) => c.fret).join('+') : ''}</button>`) +
    `<button class="txtbtn" data-act="clear">Clear</button>`;
  const W = box.clientWidth, H = box.clientHeight;
  if (W < 20 || H < 20) return;
  const keep = box.scrollLeft, st = statusMap();
  if (piano) {
    box.innerHTML = drawKeyboard({ lo: 21, hi: 108, ww: keyWidth(W), H, id: 'src', notes: keyNotes(A, S.work.piano, A && A.top ? A.top.pitch : -1, A && A.bass ? A.bass.pitch : -1, st) });
  } else {
    const cw = fretWidth(W), fc = Math.min(inst.fretCount || 22, 24);
    box.innerHTML = drawFretboard({ inst, capos: S.work.srcCapos, fing: srcFing(), start: 0, count: fc, W: 56 + cw * fc, H, A, status: st, top: A && A.top ? A.top.pitch : -1, bass: A && A.bass ? A.bass.pitch : -1, id: 'src' });
  }
  box.scrollLeft = ses.fit.src ? chordScroll('src', box, piano ? S.work.piano : srcFing()) : keep;
  ses.fit.src = false;
  updateMoveButtons();
}
// Where to scroll so the entered notes are in view: centred on a keyboard, from just below the lowest fret on a
// fretboard. With nothing entered, C3 on a keyboard and the nut on a fretboard.
function chordScroll(id, box, notes) {
  const g = GEO[id];
  if (g.xOf) {
    const ps = notes.slice().sort((a, b) => a - b);
    if (!ps.length) return g.xOf(48);
    return (g.xOf(ps[0]) + g.xOf(ps[ps.length - 1]) + g.ww) / 2 - box.clientWidth / 2;
  }
  const fr = notes.filter((f) => f > 0);
  if (!fr.length) return 0;
  const lo = Math.min(...fr), hi = Math.max(...fr), seen = Math.floor((box.clientWidth - g.zone) / g.cw);
  return hi <= seen ? 0 : Math.max(0, (lo - 2) * g.cw);
}
function compText() {
  const c = ses.pending ? null : currentCard();
  if (!c) return '';
  const extra = [...c.flags.map((f) => f.text), ...(ses.out.flags || []).filter((f) => f.code === 'bassInside').map((f) => f.text)];
  return esc([c.compromise.text, ...new Set(extra)].join(' '));
}
function renderBridge() {
  const A = ses.A, mid = $('#bridgeMid');
  $('#saveTest').disabled = !ses.picked;
  if (!A || A.empty) {
    mid.innerHTML = `<div class="chord empty">Enter a voicing</div><div class="lines"><div class="line colour">Tap the ${isPiano(side('src')) ? 'keys' : 'frets'} on the source strip to begin.</div></div>`;
    return;
  }
  let h = `<button class="chord" data-act="showcomp" aria-label="Chord ${esc(A.name)}. Show what the translation gave up.">${esc(A.name)}</button>`;
  if (ses.reasons) h += `<div class="reasons" id="reasons">${Object.keys(E.CHIP_KEYS).map((k) => `<button data-act="reason" data-k="${k}" class="${ses.reasons[k] ? 'on' : ''}"><span>${k}</span></button>`).join('')}</div>`;
  else {
    h += `<div class="lines ${ses.showComp ? 'showcomp' : ''}" id="lines"><div class="line colour">${esc(A.colourLine)}</div><div class="line comp">${compText()}</div></div>`;
    if (ses.capoHint) h += `<button class="capohint" data-act="applycapo">Closer with ${esc(ses.capoHint.label)}: score ${fmt(ses.capoHint.from)} to ${fmt(ses.capoHint.to)}. Tap to try it.</button>`;
  }
  mid.innerHTML = h;
}
function flashComp() {
  ses.showComp = true; clearTimeout(ses.compT);
  const l = $('#lines'); if (l) { l.classList.add('showcomp'); $('.line.comp', l).innerHTML = compText(); }
  ses.compT = setTimeout(() => { ses.showComp = false; const x = $('#lines'); if (x) x.classList.remove('showcomp'); }, 4000);
}
function resultSVG(res, W, H) {
  const A = ses.A, tgt = side('tgt'), top = res.mains[res.mains.length - 1], bass = res.pitches[0];
  if (res.kind === 'piano') {
    let lo = res.pitches[0] - 3, hi = res.pitches[res.pitches.length - 1] + 3;
    const want = ses.roomy ? 36 : 24;
    while (hi - lo < want) { lo -= 1; if (hi - lo < want) hi += 1; }
    lo = clamp(lo - E.mod12(lo), 24, 96); hi = clamp(hi + (11 - E.mod12(hi)), lo + 23, 107);
    let whites = 0; for (let p = lo; p <= hi; p++) if (isWhite(p)) whites++;
    return drawKeyboard({ lo, hi, ww: W / whites, H, notes: keyNotes(A, res.pitches, top, bass) });
  }
  const vis = visibleFrets(), fc = Math.min(tgt.fretCount || 22, 24);
  let lo = 99, hi = 0;
  for (const f of res.fingering) if (f > 0) { lo = Math.min(lo, f); hi = Math.max(hi, f); }
  let start = 0, count = Math.min(vis, fc);
  if (hi > count) { start = Math.max(0, lo - 2); count = Math.min(Math.max(vis, hi - start + 1), fc - start); }
  return drawFretboard({ inst: tgt, capos: S.work.tgtCapos, fing: res.fingering, start, count, W, H, A, top, bass });
}
const favKey = (res) => S.settings.tgt + '|' + JSON.stringify(isPiano(side('tgt')) ? [] : S.work.tgtCapos) + '|' + res.text;
function renderTarget() {
  const box = $('#tgtBody'), tgt = side('tgt'), W = box.clientWidth, H = box.clientHeight;
  markBusy();
  if (W < 20 || H < 20) return;
  if (ses.editing) {
    box.innerHTML = `<div class="card" style="height:100%"><div class="card-body"><div class="scroll" id="editScroll"></div></div><div class="card-row"><span class="rubric grow">Your voicing · ${esc(tgt.name)}</span><button class="txtbtn" data-act="editcancel">Cancel</button><button class="use" data-act="editsave"><span>Save</span></button></div></div>`;
    drawEditor();
    return;
  }
  if (!ses.out || !ses.out.results.length) {
    box.innerHTML = `<div class="none"><p class="rubric">Translation · ${esc(tgt.name)}</p><p>${ses.pending ? 'Finding voicings…' : ses.A && !ses.A.empty ? 'No playable voicing found.' : 'The closest playable voicings will appear here.'}</p></div>`;
    return;
  }
  const cards = allCards(), n = ses.out.results.length;
  let h = '<div class="cards" id="cards">';
  cards.forEach((res, i) => {
    const picked = ses.picked && ses.picked.key === res.multiKey, fav = S.favourites.some((f) => f.id === favKey(res));
    const pos = res.custom ? 'Yours' : `${i + 1 - (ses.custom ? 1 : 0)} / ${n}`;
    h += `<article class="card ${picked ? 'picked' : ''}" aria-label="Voicing ${pos}"><div class="card-body">${resultSVG(res, W, H - 45)}</div><div class="card-row">
      <span class="pos">${pos}</span>
      <button class="fig" data-act="why" data-i="${i}" aria-label="Sound score ${fmt(res.score)}. Show why."><span>Score</span> <b>${fmt(res.score)}</b></button>
      <span class="fig"><span class="long">Difficulty</span><span class="short">Diff</span> <b>${fmt(res.difficulty)}</b></span>
      <span class="tab grow">${detailed() ? esc(res.kind === 'piano' ? res.label : res.text) : ''}</span>
      <button class="iconbtn star ${fav ? 'on' : ''}" data-act="star" data-i="${i}" aria-label="${fav ? 'Remove from' : 'Add to'} favourites" aria-pressed="${fav}">${ICON.star}</button>
      <button class="use ${picked ? 'done' : ''}" data-act="use" data-i="${i}"><span>${picked ? 'Chosen' : 'Use this'}</span></button></div></article>`;
  });
  h += `<article class="card" aria-label="None of these"><div class="none"><h3>None of these</h3><p>Enter the voicing you wanted on the ${esc(tgt.name.toLowerCase())}. It counts double when the app learns your taste.</p><button class="pill primary" data-act="none"><span>Enter my voicing</span></button></div></article></div>`;
  box.innerHTML = h;
  const el = $('#cards');
  el.scrollLeft = ses.card * W;
  let t = 0;
  el.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== ses.card) { ses.card = i; renderSource(); flashComp(); }
    }, 90);
  }, { passive: true });
}
function drawEditor() {
  const box = $('#editScroll'), tgt = side('tgt');
  if (!box) return;
  const W = box.clientWidth, H = box.clientHeight, keep = box.scrollLeft, A = ses.A;
  if (isPiano(tgt)) {
    const ps = ses.editing.pitches.slice().sort((a, b) => a - b);
    box.innerHTML = drawKeyboard({ lo: 21, hi: 108, ww: keyWidth(W), H, id: 'edit', notes: keyNotes(A, ps, ps[ps.length - 1], ps[0]) });
    box.scrollLeft = ses.editing.init && !ses.fit.edit ? keep : chordScroll('edit', box, ps.length ? ps : S.work.piano);
  } else {
    const cw = fretWidth(W), fc = Math.min(tgt.fretCount || 22, 24);
    const P = E.prepare(tgt, S.work.tgtCapos), mains = [];
    ses.editing.fing.forEach((f, c) => { if (f != null && f >= 0) { const o = f === 0 ? P.open[c] : P.fret[c][f]; if (o) mains.push(o.main); } });
    box.innerHTML = drawFretboard({ inst: tgt, capos: S.work.tgtCapos, fing: ses.editing.fing, start: 0, count: fc, W: 56 + cw * fc, H, A, top: Math.max(-1, ...mains), bass: Math.min(999, ...mains), id: 'edit' });
    box.scrollLeft = ses.editing.init && !ses.fit.edit ? keep : chordScroll('edit', box, ses.editing.fing.map((f) => (f == null ? -1 : f)));
  }
  ses.editing.init = true; ses.fit.edit = false;
}

/* ───────── toast ───────── */
let toastT = 0;
function toast(msg, action) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button class="txtbtn accent" data-act="${action.act}">${esc(action.label)}</button>` : '');
  el.classList.add('open'); clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('open'), action ? 6000 : 3200);
}

/* ───────── board taps ───────── */
function boardTap(id, e, svg) {
  const g = GEO[id], srcSide = id === 'src', inst = side(srcSide ? 'src' : 'tgt');
  if (isPiano(inst)) {
    const key = e.target.closest('[data-p]');
    if (!key) return;
    const p = +key.dataset.p, list = srcSide ? S.work.piano : ses.editing.pitches, i = list.indexOf(p);
    if (i >= 0) list.splice(i, 1); else if (list.length < 10) list.push(p); else return toast('Ten notes is the most two hands can hold.');
  } else {
    const rect = svg.getBoundingClientRect(), x = e.clientX - rect.left, yy = e.clientY - rect.top;
    let c = 0, best = 1e9;
    for (let i = 0; i < g.n; i++) { const d = Math.abs(g.y(i) - yy); if (d < best) { best = d; c = i; } }
    const fing = srcSide ? srcFing() : ses.editing.fing;
    if (x < g.zone) fing[c] = fing[c] == null || fing[c] > 0 ? 0 : fing[c] === 0 ? -1 : null;
    else {
      const f = clamp(g.start + Math.ceil((x - g.zone) / g.cw), 1, g.fretCount);
      if (f <= g.P.minEff[c]) return toast(inst.courses[c].startFret >= f ? `That string starts at fret ${inst.courses[c].startFret}.` : 'That fret is behind the capo.');
      if (g.P.collide[c][f]) return toast('A finger there would collide with the capo.');
      fing[c] = fing[c] === f ? null : f;
    }
  }
  if (srcSide) { save(true); recompute(60, true); renderSource(); renderBridge(); markBusy(); } else drawEditor();
}

/* ───────── actions ───────── */
const ACT = {
  mode(el) { S.settings.mode = el.dataset.v; save(); render(); },
  playmode(el) { S.settings.play = el.dataset.v; save(); press('#segPlay', S.settings.play); },
  view(el) { ses.view = el.dataset.v; render(); },
  view(el) { const b = $('#srcScroll'), g = GEO.src; b.scrollBy({ left: +el.dataset.d * (g.ww ? g.ww * 7 : g.cw * 5), behavior: 'smooth' }); },
  clear() {
    if (isPiano(side('src'))) S.work.piano = []; else S.work.fing[side('src').id] = side('src').courses.map(() => null);
    save(true); recompute(); render();
  },
  play(el) {
    Snd.unlock();
    if (el.dataset.side === 'src') { const s = currentSource(); return Snd.play(eventsOf(side('src'), S.work.srcCapos, s), s.kind === 'piano'); }
    const tgt = side('tgt');
    if (ses.editing) return Snd.play(eventsOf(tgt, S.work.tgtCapos, ses.editing), isPiano(tgt));
    const c = currentCard();
    if (c) Snd.play(eventsOf(tgt, S.work.tgtCapos, c), isPiano(tgt));
  },
  swap() {
    const cur = currentCard(), a = S.settings.src, b = S.settings.tgt;
    S.settings.src = b; S.settings.tgt = a;
    [S.work.srcCapos, S.work.tgtCapos] = [S.work.tgtCapos, S.work.srcCapos];
    if (cur) { if (cur.kind === 'piano') S.work.piano = cur.pitches.slice(); else S.work.fing[b] = cur.fingering.map((f) => (f < 0 ? null : f)); }
    ses.fit.src = true; save(); recompute(); render();
  },
  showcomp() { if (ses.out) flashComp(); },
  applycapo() { if (!ses.capoHint) return; S.work.tgtCapos = clone(ses.capoHint.capos); save(); recompute(0, true); render(); toast('Capo applied. Remove it from the target instrument sheet.'); },
  why(el) { openWhy(+el.dataset.i); },
  star(el) {
    const res = allCards()[+el.dataset.i]; if (!res) return;
    const id = favKey(res), i = S.favourites.findIndex((f) => f.id === id), tgt = side('tgt');
    if (i >= 0) S.favourites.splice(i, 1);
    else S.favourites.unshift({ id, t: Date.now(), chord: ses.A.name, instr: tgt.id, instrName: tgt.name, capos: isPiano(tgt) ? [] : clone(S.work.tgtCapos), voicing: packVoicing(res), text: res.text });
    save(); renderTarget(); toast(i >= 0 ? 'Removed from favourites.' : 'Added to favourites.');
  },
  use(el) { usePick(+el.dataset.i); },
  reason(el) {
    const k = el.dataset.k;
    if (!ses.picked || !ses.reasons || ses.reasons[k]) return;
    ses.reasons[k] = true;
    S.taste = E.learn(S.taste, { ctxKey: ses.ctx, winner: ses.picked.result, losers: ses.picked.losers, strength: ses.picked.strength, onlyKeys: E.CHIP_KEYS[k], count: false });
    save(); el.classList.add('on'); fadeReasons(1800);
  },
  none() {
    const tgt = side('tgt');
    ses.editing = isPiano(tgt) ? { pitches: [] } : { fing: tgt.courses.map(() => null) };
    renderTarget(); renderSource();
  },
  editcancel() { ses.editing = null; renderTarget(); renderSource(); },
  editsave() {
    const tgt = side('tgt'), ed = ses.editing;
    const count = isPiano(tgt) ? ed.pitches.length : ed.fing.filter((f) => f != null && f >= 0).length;
    if (!count) return toast('Enter at least one note first.');
    const res = E.evaluate(Object.assign({}, ses.req, { analysis: ses.A, fingering: isPiano(tgt) ? null : ed.fing.map((f) => (f == null ? -1 : f)), pitches: isPiano(tgt) ? ed.pitches : null }));
    res.custom = true;
    ses.custom = res; ses.editing = null; ses.card = 0;
    usePick(0);
  },
  savetest() {
    if (!ses.picked) return toast('Choose a voicing first, then save it as a test.');
    const r = ses.picked.result, tgt = side('tgt');
    const tc = { id: 'u' + Date.now(), name: ses.A.name, source: packSource(), target: tgt.id, capos: isPiano(tgt) ? [] : clone(S.work.tgtCapos), note: 'Saved from the main screen.', status: 'confirmed' };
    if (r.kind === 'piano') tc.acceptNotes = [r.pitches.slice()]; else tc.accept = [r.fingering.slice()];
    S.tests.push(tc); save(); $('#toast').classList.remove('open');
    toast('Saved as a test. Find it in Settings, under Lab.');
  },
};
function fadeReasons(ms) {
  clearTimeout(ses.reasonT);
  ses.reasonT = setTimeout(() => { const r = $('#reasons'); if (r) r.style.opacity = '0'; setTimeout(() => { ses.reasons = null; renderBridge(); }, 260); }, ms);
}
// Every pick is a vote: this one beat the others shown.
function usePick(i) {
  const res = allCards()[i];
  if (!res || (ses.picked && ses.picked.key === res.multiKey)) return;
  const losers = ses.out.results.filter((r) => r.multiKey !== res.multiKey), strength = res.custom ? 2 : 1, tgt = side('tgt');
  S.taste = E.learn(S.taste, { ctxKey: ses.ctx, winner: res, losers, strength });
  const capos = isPiano(tgt) ? [] : clone(S.work.tgtCapos);
  S.picks.push({ t: Date.now(), ctx: ses.ctx, chord: ses.A.name, src: packSource(), tgt: tgt.id, capos, win: packVoicing(res), shown: ses.out.results.map((r) => r.text), custom: !!res.custom });
  if (S.picks.length > 1500) S.picks.splice(0, S.picks.length - 1500);
  S.translations.unshift({ id: 't' + Date.now(), t: Date.now(), chord: ses.A.name, src: packSource(), srcName: side('src').name, tgt: tgt.id, tgtName: tgt.name, capos, voicing: packVoicing(res), text: res.text });
  if (S.translations.length > 300) S.translations.length = 300;
  ses.picked = { key: res.multiKey, result: res, losers, strength };
  save();
  ses.reasons = detailed() && losers.length ? {} : null;
  renderTarget(); renderBridge(); renderSource();
  if (ses.reasons) fadeReasons(4000);
  toast(res.custom ? 'Saved. Your voicing counts double.' : 'Pick saved.', { label: 'Save as test', act: 'savetest' });
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) { const fn = ACT[el.dataset.act]; if (fn) fn(el, e); return; }
  const svg = e.target.closest('svg[data-board]');
  if (svg && isTap()) boardTap(svg.dataset.board, e, svg);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });



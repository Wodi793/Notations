/* STAFF — written notation as a third surface. Either strip can show it. As the source it is an input; as the
   target it notates the source chord exactly, so there is nothing to rank. Drawn with VexFlow 5.0.0 (vendored;
   the artifact build loads the same file from jsDelivr with an integrity check). The note colours, root rings,
   ghosts and taps are drawn and handled here, on top of VexFlow's engraving. */
const STAFF = { id: 'staff', kind: 'staff', name: 'Staff', group: 'Surfaces' };
const isStaff = (i) => !!i && i.kind === 'staff';
const VEXFLOW_LOCAL = 'vendor/vexflow-5.0.0/vexflow-bravura.js';
const VEXFLOW_CDN = 'https://cdn.jsdelivr.net/npm/vexflow@5.0.0/build/cjs/vexflow-bravura.js';
const VEXFLOW_SRI = 'sha384-eVgY5nkAnSIGsItE78COaqJXhVabClly0vVcDkXMbaW4PRKzKyRqNXRXXWmWjVx0';
let vfPromise = null;
function loadVexFlow() {
  if (window.VexFlow) return Promise.resolve(window.VexFlow);
  if (!vfPromise) vfPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    if (BUILD === 'artifact') { s.src = VEXFLOW_CDN; s.integrity = VEXFLOW_SRI; s.crossOrigin = 'anonymous'; } else s.src = VEXFLOW_LOCAL;
    s.onload = async () => {
      const VF = window.VexFlow || (window.Vex && window.Vex.Flow);
      if (!VF) { vfPromise = null; return reject(new Error('VexFlow did not start')); }
      window.VexFlow = VF;
      try { if (VF.setFonts) VF.setFonts('Bravura'); await document.fonts.load('30pt Bravura'); } catch (e) { /* drawn with what is loaded */ }
      resolve(VF);
    };
    s.onerror = () => { vfPromise = null; reject(new Error('VexFlow did not load')); };
    document.head.appendChild(s);
  });
  return vfPromise;
}

/* ───────── spelling ───────── */
const LETTERS = 'CDEFGAB', LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const DEFAULT_NAME = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const accOf = (name) => [...name.slice(1)].reduce((a, ch) => a + (ch === '♯' ? 1 : ch === '♭' ? -1 : ch === '𝄪' ? 2 : ch === '𝄫' ? -2 : 0), 0);
const accSym = (a) => ({ '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' })[a];
// A pitch written with a given name: letter, accidental, octave and its staff step (letter + 7 × octave).
function written(pitch, name) {
  const L = LETTERS.indexOf(name[0]), acc = accOf(name), octave = Math.floor((pitch - acc - LETTER_PC[L]) / 12) - 1;
  return { pitch, letter: L, acc, octave, step: L + 7 * octave, name: LETTERS[L] + accSym(acc) };
}
const naturalPitch = (step) => { const L = ((step % 7) + 7) % 7, o = Math.floor(step / 7); return (o + 1) * 12 + LETTER_PC[L]; };

/* Keys: all major and minor keys, by signature (sharps positive, flats negative). */
const KEY_LIST = [
  ...[['C', 0], ['G', 1], ['D', 2], ['A', 3], ['E', 4], ['B', 5], ['F♯', 6], ['C♯', 7], ['F', -1], ['B♭', -2], ['E♭', -3], ['A♭', -4], ['D♭', -5], ['G♭', -6], ['C♭', -7]].map(([t, sig]) => ({ name: t + ' major', tonic: t, mode: 'major', sig })),
  ...[['A', 0], ['E', 1], ['B', 2], ['F♯', 3], ['C♯', 4], ['G♯', 5], ['D♯', 6], ['A♯', 7], ['D', -1], ['G', -2], ['C', -3], ['F', -4], ['B♭', -5], ['E♭', -6], ['A♭', -7]].map(([t, sig]) => ({ name: t + ' minor', tonic: t, mode: 'minor', sig })),
];
function keyInfo(key) {
  const accs = [0, 0, 0, 0, 0, 0, 0];
  if (key.sig > 0) 'FCGDAEB'.slice(0, key.sig).split('').forEach((l) => { accs[LETTERS.indexOf(l)] = 1; });
  if (key.sig < 0) 'BEADGCF'.slice(0, -key.sig).split('').forEach((l) => { accs[LETTERS.indexOf(l)] = -1; });
  const names = LETTERS.split('').map((l, i) => l + accSym(accs[i])), byPc = {};
  names.forEach((n, i) => { byPc[((LETTER_PC[i] + accs[i]) % 12 + 12) % 12] = n; });
  const vf = key.tonic.replace('♯', '#').replace('♭', 'b') + (key.mode === 'minor' ? 'm' : '');
  return Object.assign({}, key, { accs, names, byPc, vf });
}
const staffSettings = () => S.settings.staff || (S.settings.staff = { layout: 'auto', spelling: 'acc', key: 'predict', written: false });
// The key the staff uses, or null for Accidentals. Predict guesses from the progression (or the current chord).
function staffKey() {
  const st = staffSettings();
  if (st.spelling !== 'key') return null;
  if (st.key !== 'predict') { const k = KEY_LIST.find((x) => x.name === st.key); return k ? Object.assign(keyInfo(k), { predicted: false }) : null; }
  const chords = typeof progressionPitches === 'function' ? progressionPitches() : [];
  if (!chords.length && ses.A && !ses.A.empty) chords.push(ses.A.notes.map((n) => n.pitch));
  const guess = E.predictKey(chords);
  if (!guess) return Object.assign(keyInfo(KEY_LIST[0]), { predicted: true, confidence: 0 });
  const k = KEY_LIST.find((x) => x.name === guess.key.name) || KEY_LIST[0];
  return Object.assign(keyInfo(k), { predicted: true, confidence: guess.confidence, alternatives: guess.alternatives.map((a) => a.name) });
}
// Spell every note from the chord once there is one (two or more pitch classes). With a key signature on, the
// chord is respelled from its other root name if that agrees with the key better. A manual flip always wins.
function staffSpelling(pitches, A, key) {
  const over = S.work.staffSpell || {};
  let names = null;
  if (A && !A.empty && A.pcs.length >= 2) {
    names = {}; for (const pc of A.pcs) names[pc] = A.roleOfPc[pc].name;
    if (key && E.ENHARMONIC[A.rootName]) {
      const alt = E.spellChord(A, E.ENHARMONIC[A.rootName]), fit = (m) => A.pcs.filter((pc) => key.names.includes(m[pc])).length;
      if (fit(alt) > fit(names)) names = alt;
    }
  }
  return pitches.map((p) => written(p, over[p] || (names && names[E.mod12(p)]) || (key && key.byPc[E.mod12(p)]) || DEFAULT_NAME[E.mod12(p)]));
}

/* ───────── layout ───────── */
const CLEF = { treble: { top: 38, bottom: 30 }, bass: { top: 26, bottom: 18 } }; // F5–E4, A3–G2 as steps
const ledgers = (step, clef) => (step > CLEF[clef].top ? Math.floor((step - CLEF[clef].top) / 2) : step < CLEF[clef].bottom ? Math.floor((CLEF[clef].bottom - step) / 2) : 0);
// Auto: a grand staff, unless every note fits one staff with at most two ledger lines. Grand: C4 and up on the
// treble staff unless a note needs fewer ledger lines on the other. Single: whichever staff needs fewer in all.
function staffLayout(notes, mode) {
  const total = (clef) => notes.reduce((a, n) => a + ledgers(n.step, clef), 0);
  const single = () => {
    const t = total('treble'), b = total('bass');
    const avg = notes.length ? notes.reduce((a, n) => a + n.step, 0) / notes.length : 30;
    return t < b || (t === b && avg >= 28) ? 'treble' : 'bass';
  };
  if (mode === 'single' || (mode === 'auto' && notes.length && ['treble', 'bass'].some((c) => notes.every((n) => ledgers(n.step, c) <= 2)))) {
    const c = mode === 'auto' ? (['treble', 'bass'].filter((cl) => notes.every((n) => ledgers(n.step, cl) <= 2)).sort((a, b) => total(a) - total(b))[0] || single()) : single();
    return [{ clef: c, notes }];
  }
  const tre = [], bas = [];
  for (const n of notes) { const lt = ledgers(n.step, 'treble'), lb = ledgers(n.step, 'bass'); (lt < lb || (lt === lb && n.pitch >= 60) ? tre : bas).push(n); }
  return [{ clef: 'treble', notes: tre }, { clef: 'bass', notes: bas }];
}

/* ───────── drawing ───────── */
const HEX = { top: '#F5F7F2', guide: '#22C55E', gentle: '#FACC15', eleven: '#F97316', alt: '#DC2626', bass: '#2563EB', root: '#6B7280', fifth: '#6B7280', other: '#8DA399' };
const vfKey = (n) => 'cdefgab'[n.letter] + ({ '-2': 'bb', '-1': 'b', 0: '', 1: '#', 2: '##' })[n.acc] + '/' + n.octave;
const vfAcc = (a) => ({ '-2': 'bb', '-1': 'b', 0: 'n', 1: '#', 2: '##' })[a];
// o: { id, pitches, A, status, top, bass, written (octaves up for "Written for") }
async function drawStaff(box, o) {
  const VF = await loadVexFlow().catch(() => null);
  if (!box.isConnected) return;
  if (!VF) { box.innerHTML = '<p class="note staffnote">The staff could not load. Check the connection, then reopen this instrument.</p>'; return; }
  const st = staffSettings(), key = staffKey(), w = o.written || 0, A = o.A;
  let notes = staffSpelling(o.pitches.slice().sort((a, b) => a - b), A, key);
  if (w) notes = notes.map((n) => Object.assign(written(n.pitch + 12 * w, n.name), { sounding: n.pitch }));
  else notes.forEach((n) => { n.sounding = n.pitch; });
  const staves = w ? [{ clef: 'treble', notes, octave: true }] : staffLayout(notes, st.layout);
  // Vertical room, in staff spaces of 10 units: ledger lines the notes need plus the area Bill has opened up.
  const ext = ses.staffExt || (ses.staffExt = { up: 2, down: 2 });
  const first = staves[0], last = staves[staves.length - 1];
  const needUp = Math.max(ext.up, ...first.notes.map((n) => ledgers(n.step, first.clef) * (n.step > CLEF[first.clef].top ? 1 : 0))) + 1.5;
  const needDown = Math.max(ext.down, ...last.notes.map((n) => ledgers(n.step, last.clef) * (n.step < CLEF[last.clef].bottom ? 1 : 0))) + 1.5;
  const gap = 60, unitsH = needUp * 10 + 40 + (staves.length === 2 ? gap + 40 : 0) + needDown * 10 + 16;
  const W = box.clientWidth, H = box.clientHeight, k = clamp(H / unitsH, 0.6, 2.6), Wu = W / k, Hu = H / k;
  box.innerHTML = '';
  const host = document.createElement('div'); box.appendChild(host);
  const ren = new VF.Renderer(host, VF.Renderer.Backends.SVG); ren.resize(Wu, Hu);
  const ctx = ren.getContext(); ctx.setFillStyle('#ECF4F0'); ctx.setStrokeStyle('#5A6661');
  const top0 = (Hu - (unitsH - 16)) / 2 + needUp * 10;
  const x0 = staves.length === 2 ? 22 : 12, width = Math.max(120, Wu - x0 - 12);
  const drawn = staves.map((sv, i) => {
    const s = new VF.Stave(x0, 0, width, { spaceAboveStaffLn: 0, spaceBelowStaffLn: 0 });
    s.setY(top0 + i * (40 + gap) - (s.getYForLine(0) - s.getY()));
    s.setStyle({ strokeStyle: '#5A6661', fillStyle: '#ECF4F0' });
    s.addClef(sv.clef, 'default', sv.octave ? '8vb' : undefined);
    if (key) s.addKeySignature(key.vf);
    s.setContext(ctx).draw();
    return s;
  });
  if (drawn.length === 2) {
    new VF.StaveConnector(drawn[0], drawn[1]).setType('brace').setContext(ctx).draw();
    new VF.StaveConnector(drawn[0], drawn[1]).setType('singleLeft').setContext(ctx).draw();
  }
  const voices = [], snotes = [];
  staves.forEach((sv) => {
    const ns = sv.notes.slice().sort((a, b) => a.step - b.step);
    sv.sorted = ns;
    let note;
    if (!ns.length) note = new VF.GhostNote({ duration: 'w' });
    else {
      note = new VF.StaveNote({ keys: ns.map(vfKey), duration: 'w', clef: sv.clef });
      ns.forEach((n, i) => {
        const shown = key ? n.acc !== key.accs[n.letter] : n.acc !== 0;
        if (shown) note.addModifier(new VF.Accidental(vfAcc(n.acc)), i);
        const style = noteStyle(A, n.sounding, n.sounding === o.top, n.sounding === o.bass), ghost = (o.status || {})[n.sounding] === 'dropped';
        const col = HEX[style.fn === 'other' ? 'other' : n.sounding === o.top ? 'top' : n.sounding === o.bass ? 'bass' : style.fn];
        note.setKeyStyle(i, { fillStyle: ghost ? col + '66' : col, strokeStyle: ghost ? col + '66' : col });
      });
      note.setLedgerLineStyle({ strokeStyle: '#5A6661' });
    }
    snotes.push(note);
    voices.push(new VF.Voice({ numBeats: 4, beatValue: 4 }).addTickables([note]));
  });
  const fmt = new VF.Formatter();
  voices.forEach((v) => fmt.joinVoices([v]));
  fmt.format(voices, Math.max(60, width - (drawn[0].getNoteStartX() - x0) - 30));
  voices.forEach((v, i) => v.draw(ctx, drawn[i]));
  // Fit the SVG to the strip, then add what VexFlow does not draw: root rings, and pitch tags for the light-up.
  const svg = host.querySelector('svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${Wu} ${Hu}`);
  svg.style.width = W + 'px'; svg.style.height = H + 'px';
  box.scrollLeft = 0;
  if (o.id) host.setAttribute('data-board', o.id);
  host.style.height = H + 'px';
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Staff'); svg.setAttribute('data-vf', '');
  const NS = 'http://www.w3.org/2000/svg', geo = { staff: true, k, staves: [], notes: [], written: w };
  const groups = [...svg.querySelectorAll('.vf-stavenote')];
  let gi = 0;
  staves.forEach((sv, si) => {
    const sn = snotes[si], s = drawn[si];
    geo.staves.push({ clef: sv.clef, y0: s.getYForLine(0), topStep: CLEF[sv.clef].top });
    if (!sv.sorted.length) return;
    const heads = groups[gi++] ? [...groups[gi - 1].querySelectorAll('.vf-notehead')] : [];
    sv.sorted.forEach((n, i) => {
      const nh = sn.noteHeads && sn.noteHeads[i], y = sn.getYs()[i], x = nh ? nh.getAbsoluteX() : sn.getNoteHeadBeginX(), hw = nh ? nh.getWidth() : 16;
      if (heads[i]) { heads[i].setAttribute('data-np', n.sounding); heads[i].classList.add('nt'); }
      geo.notes.push({ pitch: n.sounding, step: n.step, staff: si, acc: n.acc, x: x + hw / 2, y });
      const style = noteStyle(A, n.sounding, false, false);
      if (style.root) {
        const e = document.createElementNS(NS, 'ellipse');
        Object.entries({ cx: x + hw / 2, cy: y, rx: hw / 2 + 3.6, ry: 7.6, fill: 'none', stroke: '#E5E7EB', 'stroke-width': 1.6, opacity: (o.status || {})[n.sounding] === 'dropped' ? 0.4 : 1, 'pointer-events': 'none' }).forEach(([a, v]) => e.setAttribute(a, v));
        svg.appendChild(e);
      }
    });
  });
  if (o.id) GEO[o.id] = geo;
  return geo;
}

/* ───────── input ───────── */
// Tap a line or space to add a natural note; tap a note to remove it. A note with an accidental flips to its
// other name on the first tap (C♯ to D♭) and is removed on the next. Taps at the edge open more ledger room.
function staffTap(id, e, svg) {
  const g = GEO[id];
  if (!g) return;
  const rect = svg.getBoundingClientRect(), y = (e.clientY - rect.top) / g.k;
  let si = 0, best = 1e9;
  g.staves.forEach((s, i) => { const d = Math.abs(y - (s.y0 + 20)); if (d < best) { best = d; si = i; } });
  const sv = g.staves[si], step = sv.topStep - Math.round((y - sv.y0) / 5) - 7 * g.written;
  const pitch = naturalPitch(step);
  if (pitch < 21 || pitch > 108) return toast('The staff covers A0 to C8.');
  const ext = ses.staffExt;
  if (si === 0 && step + 7 * g.written > sv.topStep + 2 * ext.up - 1) ext.up = Math.min(ext.up + 1, 8);
  if (si === g.staves.length - 1 && step + 7 * g.written < CLEF[sv.clef].bottom - 2 * ext.down + 1) ext.down = Math.min(ext.down + 1, 8);
  const list = S.work.staff, over = S.work.staffSpell || (S.work.staffSpell = {});
  const hit = g.notes.find((n) => n.step - 7 * g.written === step && n.staff === si);
  if (hit) {
    if (hit.acc !== 0 && !over['flip' + hit.pitch]) {
      const cur = staffSpelling([hit.pitch], ses.A, staffKey())[0];
      const other = DEFAULT_NAME[E.mod12(hit.pitch)] === cur.name ? E.ENHARMONIC[cur.name] || cur.name : DEFAULT_NAME[E.mod12(hit.pitch)];
      over[hit.pitch] = other.length > 1 && other !== cur.name ? other : (E.ENHARMONIC[cur.name] || cur.name);
      over['flip' + hit.pitch] = 1;
      S.work.staffLast = hit.pitch;
      toast('Respelled. Tap it again to remove it.');
    } else {
      S.work.staff = list.filter((p) => p !== hit.pitch);
      delete over[hit.pitch]; delete over['flip' + hit.pitch];
    }
  } else if (list.includes(pitch)) {
    // The same pitch is shown under another name (F written as E♯): a tap on its natural line still removes it.
    S.work.staff = list.filter((p) => p !== pitch); delete over[pitch]; delete over['flip' + pitch];
  } else {
    if (list.length >= 10) return toast('Ten notes is the most two hands can hold.');
    list.push(pitch); S.work.staffLast = pitch;
  }
  save(true); recompute(60, true); renderSource(); renderBridge(); markBusy();
}
// ♯, ♭ and ♮ change the last-touched note, keeping its letter.
function staffAccidental(v) {
  const last = S.work.staffLast, list = S.work.staff;
  if (last == null || !list.includes(last)) return toast('Tap a note on the staff first.');
  const cur = staffSpelling([last], ses.A, staffKey())[0], step = cur.step, np = naturalPitch(step) + v;
  if (np < 21 || np > 108) return;
  if (np !== last && list.includes(np)) return toast('That note is already there.');
  const over = S.work.staffSpell || (S.work.staffSpell = {});
  delete over[last]; delete over['flip' + last];
  S.work.staff = list.map((p) => (p === last ? np : p));
  over[np] = LETTERS[cur.letter] + accSym(v);
  S.work.staffLast = np;
  save(true); recompute(60, true); renderSource(); renderBridge(); markBusy();
}

/* ───────── controls ───────── */
function staffControls(otherInst) {
  const st = staffSettings(), key = staffKey();
  const keyLabel = key && key.predicted ? `${key.name}${key.confidence < 0.5 ? '?' : ''}, predicted` : '';
  const canWrite = otherInst && otherInst.writtenOctave;
  return `<select class="mini" data-chg="stafflayout" id="staffLayout" aria-label="Staff layout">${[['auto', 'Auto'], ['grand', 'Grand'], ['single', 'Single']].map(([v, l]) => `<option value="${v}" ${st.layout === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <select class="mini" data-chg="staffspell" id="staffSpell" aria-label="Accidentals or key signature"><option value="acc" ${st.spelling === 'acc' ? 'selected' : ''}>Accidentals</option><option value="predict" ${st.spelling === 'key' && st.key === 'predict' ? 'selected' : ''}>Key: predict</option>${KEY_LIST.map((k) => `<option value="${k.name}" ${st.spelling === 'key' && st.key === k.name ? 'selected' : ''}>Key: ${k.name}</option>`).join('')}</select>
    ${keyLabel ? `<span class="keyguess">${esc(keyLabel)}</span>` : ''}
    ${canWrite ? `<button class="txtbtn ${st.written ? 'on' : ''}" data-act="staffwritten" aria-pressed="${!!st.written}">Written for ${esc(otherInst.name.split(',')[0])}</button>` : ''}`;
}
Object.assign(ACT, {
  staffacc(el) { staffAccidental(+el.dataset.v); },
  staffwritten() { const st = staffSettings(); st.written = !st.written; save(); render(); },
});
Object.assign(CHG, {
  stafflayout(el) { staffSettings().layout = el.value; save(); render(); },
  staffspell(el) { const st = staffSettings(); if (el.value === 'acc') st.spelling = 'acc'; else { st.spelling = 'key'; st.key = el.value; } save(); render(); },
});
// What the target staff shows: the source chord at sounding pitch, as a single card.
function staffResult(src) {
  const ps = E.sourceNotes(src).filter((n) => n.weight >= 1).map((n) => n.pitch).sort((a, b) => a - b), uniq = [...new Set(ps)];
  return { kind: 'staff', pitches: uniq, mains: uniq, multiKey: uniq.join(','), score: 0, breakdown: [], difficulty: 0, difficultyParts: [], flags: [], why: [], text: '', compromise: { text: 'Notated at sounding pitch.', dropped: [], doubled: [], sourceMap: uniq.map((p) => ({ pitch: p, status: 'kept' })), exact: true } };
}

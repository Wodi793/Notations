/* ENGINE — Notations chord-voicing translator.
   Pure functions only: no DOM, no storage, no clock, no randomness.
   Same input always gives the same output. Written to be ported to Swift;
   the TESTS block is the parity suite for that port. */
const Engine = (function () {
  'use strict';
  const VERSION = '1.2.0';

  /* ───────────── 1. Notes ───────────── */
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const LETTERS = 'CDEFGAB';
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const ROOT_MAJOR = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const ROOT_MINOR = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
  const mod12 = (n) => ((n % 12) + 12) % 12;
  const octaveOf = (p) => Math.floor(p / 12) - 1;
  const num = (a, b) => a - b;
  const r2 = (x) => Math.round(x * 100) / 100;

  function pitchName(p, flat) { return (flat ? FLAT : SHARP)[mod12(p)] + octaveOf(p); }
  function parseNote(s) {
    const m = /^\s*([A-Ga-g])([#♯b♭]?)(-?\d)\s*$/.exec(s);
    if (!m) throw new Error('Bad note: ' + s);
    let pc = LETTER_PC[LETTERS.indexOf(m[1].toUpperCase())];
    if (m[2] === '#' || m[2] === '♯') pc += 1;
    if (m[2] === 'b' || m[2] === '♭') pc -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  }
  const parseNotes = (s) => s.trim().split(/\s+/).map(parseNote);

  function spell(rootName, interval, deg) {
    const rootPc = mod12(LETTER_PC[LETTERS.indexOf(rootName[0])] + (rootName[1] === '♯' ? 1 : rootName[1] === '♭' ? -1 : 0));
    const li = (LETTERS.indexOf(rootName[0]) + deg) % 7;
    const target = mod12(rootPc + interval);
    const acc = mod12(target - LETTER_PC[li] + 6) - 6;
    if (acc === 0) return LETTERS[li];
    if (acc === 1) return LETTERS[li] + '♯';
    if (acc === -1) return LETTERS[li] + '♭';
    return (rootName[1] === '♭' ? FLAT : SHARP)[target]; // no double accidentals
  }

  /* ───────────── 2. Chord analysis ───────────── */
  // Reads the interval set above one candidate root. Returns roles and a
  // complexity cost; the cheapest reading across all roots names the chord.
  function interpret(S) {
    const has = (i) => (S >> i) & 1;
    const R = {};
    let cost = 0;
    R[0] = { role: 'root', label: 'R', deg: 0 };
    const third = has(4) ? 'maj' : has(3) ? 'min' : null;
    let sus = 0;
    if (third === 'maj') {
      R[4] = { role: 'third', label: '3', deg: 2 };
      if (has(3)) { R[3] = { role: 'alt', label: '♯9', deg: 1 }; cost += 2; }
    } else if (third === 'min') {
      R[3] = { role: 'third', label: '♭3', deg: 2 };
    } else if (has(5)) {
      sus = 4; R[5] = { role: 'third', label: '4', deg: 3 }; cost += 1;
    } else if (has(2)) {
      sus = 2; R[2] = { role: 'third', label: '2', deg: 1 }; cost += 1;
    }
    const p5 = has(7);
    if (p5) R[7] = { role: 'fifth', label: '5', deg: 4 };
    const dimCtx = third === 'min' && has(6) && !p5;
    let sev = null;
    if (has(10)) {
      R[10] = { role: 'seventh', label: '♭7', deg: 6 }; sev = 'b7'; cost += 1;
      if (has(11)) { R[11] = { role: 'alt', label: '7', deg: 6 }; cost += 3; }
    } else if (has(11)) {
      R[11] = { role: 'seventh', label: '7', deg: 6 }; sev = 'M7'; cost += third === 'min' ? 1.5 : 1;
    }
    if (has(9)) {
      if (!sev && dimCtx) { R[9] = { role: 'seventh', label: '°7', deg: 6 }; sev = 'd7'; cost += 0.5; }
      else if (sev) { R[9] = { role: 'ext', label: '13', deg: 5 }; cost += 1; }
      else { R[9] = { role: 'seventh', label: '6', deg: 5 }; sev = '6'; cost += 1; }
    }
    if (has(6)) {
      if (p5) { R[6] = { role: 'alt', label: '♯11', deg: 3 }; cost += 2; }
      else { R[6] = { role: 'alt', label: '♭5', deg: 4 }; cost += dimCtx ? (sev === 'b7' ? 0.5 : 1) : 2; }
    }
    if (has(8)) {
      if (p5) { R[8] = { role: 'alt', label: '♭13', deg: 5 }; cost += 2; }
      else { R[8] = { role: 'alt', label: '♯5', deg: 4 }; cost += third === 'maj' && !sev ? 1.5 : 2; }
    }
    if (has(1)) { R[1] = { role: 'alt', label: '♭9', deg: 1 }; cost += 2; }
    if (has(2) && sus !== 2) { R[2] = { role: 'ext', label: '9', deg: 1 }; cost += sev ? 0.5 : 1.5; }
    if (has(5) && sus !== 4) { R[5] = { role: 'ext', label: '11', deg: 3 }; cost += sev && sev !== '6' ? 1 : 1.5; }
    const power = S === ((1 << 0) | (1 << 7));
    let missing = 0;
    if (!third && !sus && S !== 1) { cost += power ? 1 : 3; missing += power ? 0 : 1; }
    if (!(p5 || has(6) || has(8)) && S !== 1) { cost += 0.5; missing += 1; }

    // name
    const lab = (i) => (R[i] ? R[i].label : '');
    let alts = ['♭5', '♯5', '♭9', '♯9', '♯11', '♭13'].filter((a) => Object.keys(R).some((k) => R[k].role === 'alt' && R[k].label === a));
    const drop = (a) => { alts = alts.filter((x) => x !== a); };
    const m = third === 'min' ? 'm' : '';
    const n9 = lab(2) === '9', n11 = lab(5) === '11', n13 = lab(9) === '13';
    const top = n13 ? 13 : n11 ? 11 : n9 ? 9 : 7;
    let core, family;
    if (sev === 'd7') { core = 'dim7'; drop('♭5'); family = 'diminished'; }
    else if (dimCtx && sev === 'b7') { core = 'm' + top + '♭5'; drop('♭5'); family = 'half-diminished'; }
    else if (dimCtx && !sev) { core = 'dim'; drop('♭5'); family = 'diminished'; }
    else if (third === 'maj' && lab(8) === '♯5' && !sev) { core = '+' + (n9 ? 'add9' : ''); drop('♯5'); family = 'other'; }
    else if (sev === 'b7' || sev === 'M7') {
      core = sev === 'M7' ? (m ? 'm(maj' + top + ')' : 'maj' + top) : m + top;
      if (sus) family = 'suspended';
      else if (sev === 'M7') family = m ? 'other' : 'major 7';
      else if (m) family = 'minor 7';
      else if (!third) family = 'other';
      else family = alts.length ? 'altered dominant' : 'dominant';
    } else if (sev === '6') {
      core = m + '6' + (n9 ? '/9' : '') + (n11 ? 'add11' : '');
      family = sus ? 'suspended' : m ? 'minor' : third ? 'major' : 'other';
    } else {
      core = m + (n9 ? 'add9' : '') + (n11 ? 'add11' : '');
      family = sus ? 'suspended' : m ? 'minor' : third ? 'major' : 'other';
    }
    if (sus) core += 'sus' + sus;
    if (!third && !sus && S !== 1) core = power ? '5' : core + '(no3)';
    return { R, cost, missing, third, sus, sev, dimCtx, quality: core + alts.join(''), family, power };
  }

  const INTERVAL_NAMES = ['unison', 'half step', 'whole step', 'minor 3rd', 'major 3rd', '4th', 'tritone', '5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];
  const INTERVAL_SHORT = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7'];
  function intervalShort(semis) {
    if (semis === 12) return 'P8';
    return (semis > 12 ? '8+' : '') + INTERVAL_SHORT[semis % 12];
  }

  // input: array of MIDI numbers, or of {pitch, weight}. Weight 0.5 marks an
  // octave string on a strung source; it counts half for top-note and register.
  function analyze(input) {
    const byPitch = new Map();
    for (const it of input || []) {
      const pitch = typeof it === 'number' ? it : it.pitch;
      const weight = typeof it === 'number' ? 1 : (it.weight == null ? 1 : it.weight);
      if (!byPitch.has(pitch) || byPitch.get(pitch) < weight) byPitch.set(pitch, weight);
    }
    const raw = [...byPitch.entries()].map(([pitch, weight]) => ({ pitch, weight })).sort((a, b) => a.pitch - b.pitch);
    if (!raw.length) return { empty: true, name: '', notes: [], pitches: [], pcs: [], pcMask: 0, rubs: [], intervals: [], family: 'other', colourLine: '' };

    let pcMask = 0;
    for (const n of raw) pcMask |= 1 << mod12(n.pitch);
    const bassPc = mod12(raw[0].pitch);
    let best = null;
    const order = [];
    for (const n of raw) if (!order.includes(mod12(n.pitch))) order.push(mod12(n.pitch));
    for (const rootPc of order) {
      let S = 0;
      for (let pc = 0; pc < 12; pc++) if ((pcMask >> pc) & 1) S |= 1 << mod12(pc - rootPc);
      const I = interpret(S);
      I.rootPc = rootPc;
      I.rank = I.cost - (rootPc === bassPc ? 0.75 : 0);
      // tie: bass as root is already in rank; then fewer missing tones, then simpler name
      if (!best || I.rank < best.rank - 1e-9 ||
        (Math.abs(I.rank - best.rank) < 1e-9 && (I.missing < best.missing || (I.missing === best.missing && I.quality.length < best.quality.length)))) best = I;
    }
    const I = best;
    const rootPc = I.rootPc;
    const rootName = (I.third === 'min' ? ROOT_MINOR : ROOT_MAJOR)[rootPc];
    const roleOfPc = {};
    for (const k of Object.keys(I.R)) {
      const iv = +k, pc = mod12(rootPc + iv);
      roleOfPc[pc] = { role: I.R[k].role, label: I.R[k].label, name: spell(rootName, iv, I.R[k].deg), interval: iv, deg: I.R[k].deg };
    }
    const notes = raw.map((n) => {
      const pc = mod12(n.pitch), r = roleOfPc[pc];
      return { pitch: n.pitch, pc, weight: n.weight, role: r.role, label: r.label, name: r.name, nameOct: r.name + octaveOf(n.pitch) };
    });
    const mainNotes = notes.filter((n) => n.weight >= 1);
    const topNote = (mainNotes.length ? mainNotes : notes)[(mainNotes.length ? mainNotes : notes).length - 1];
    const last = notes[notes.length - 1];
    const octTop = last.pitch > topNote.pitch ? last : null;
    const bass = notes[0];
    const isSlash = bass.pc !== rootPc;
    const rubs = [], intervals = [];
    for (let i = 0; i + 1 < notes.length; i++) {
      const d = notes[i + 1].pitch - notes[i].pitch;
      const rub = d === 1 || d === 2;
      intervals.push({ lo: notes[i].pitch, hi: notes[i + 1].pitch, semis: d, short: intervalShort(d), rub });
      if (rub) rubs.push({ lo: notes[i].pitch, hi: notes[i + 1].pitch, pcLo: notes[i].pc, pcHi: notes[i + 1].pc, semis: d });
    }
    const pcsOf = (role) => Object.keys(roleOfPc).map(Number).filter((pc) => roleOfPc[pc].role === role);
    const family = I.family;
    const altPcs = pcsOf('alt'), extPcs = pcsOf('ext');
    const thirdPc = pcsOf('third')[0], seventhPc = pcsOf('seventh')[0], fifthPc = pcsOf('fifth')[0];
    const definingPcs = [];
    if (thirdPc != null) definingPcs.push(thirdPc);
    if (seventhPc != null) definingPcs.push(seventhPc);
    if (family === 'altered dominant') for (const pc of altPcs) definingPcs.push(pc);
    const colourPcs = [...extPcs, ...altPcs].filter((pc) => !definingPcs.includes(pc));
    const pcCount = new Array(12).fill(0);
    for (const n of mainNotes) pcCount[n.pc]++;
    const A = {
      empty: false, rootPc, rootName, quality: I.quality, family,
      name: rootName + I.quality + (isSlash ? '/' + roleOfPc[bass.pc].name : ''),
      notes, pitches: notes.map((n) => n.pitch), pcs: Object.keys(roleOfPc).map(Number), pcMask,
      roleOfPc, top: topNote, octTop, bass, isSlash, rubs, intervals,
      thirdPc, seventhPc, fifthPc, altPcs, extPcs, definingPcs, colourPcs, pcCount,
      flat: rootName[1] === '♭' || (I.third === 'min' && rootName.length === 1 && [0, 2, 5, 7].includes(rootPc)),
    };
    A.colourLine = colourLine(A, I);
    return A;
  }

  // One rule-generated sentence naming what gives the chord its sound.
  function colourLine(A, I) {
    const byLabel = (l) => { const pc = A.pcs.find((p) => A.roleOfPc[p].label === l); return pc == null ? null : A.roleOfPc[pc].name; };
    const third = A.thirdPc != null ? A.roleOfPc[A.thirdPc].name : '';
    let s = '';
    const alt = ['♯9', '♭9', '♯11', '♭13', '♯5', '♭5'].find((l) => byLabel(l) && !(l === '♭5' && I.dimCtx));
    if (alt === '♯9') s = `The bite: the ♯9, ${byLabel(alt)}, rubbing against the major 3rd.`;
    else if (alt === '♭9') s = `The tension: the ♭9, ${byLabel(alt)}, a half step above the root.`;
    else if (alt === '♯11') s = `The lift: the ♯11, ${byLabel(alt)}, a tritone above the root.`;
    else if (alt === '♭13') s = `The ache: the ♭13, ${byLabel(alt)}, a half step above the 5th.`;
    else if (alt === '♯5') s = `The reach: the raised 5th, ${byLabel(alt)}.`;
    else if (alt === '♭5') s = `The lean: the lowered 5th, ${byLabel(alt)}, a tritone above the root.`;
    else if (I.sev === 'd7') s = 'The squeeze: stacked minor 3rds, with no note at rest.';
    else if (I.dimCtx && I.sev === 'b7') s = `The shadow: the ♭5, ${byLabel('♭5')}, under a minor 7th.`;
    else if (I.dimCtx) s = `The squeeze: the ♭5, ${byLabel('♭5')}, a tritone above the root.`;
    else if (byLabel('13')) s = `The warmth: the 13th, ${byLabel('13')}, a whole step above the 5th.`;
    else if (byLabel('11')) s = `The openness: the 11th, ${byLabel('11')}, a 4th above the root.`;
    else if (byLabel('9')) s = `The glow: the 9th, ${byLabel('9')}, a whole step above the root.`;
    else if (I.sev === 'M7' && I.third === 'min') s = `The mystery: a major 7th, ${byLabel('7')}, over a minor 3rd.`;
    else if (I.sev === 'M7') s = `The sweetness: the major 7th, ${byLabel('7')}, a half step under the root.`;
    else if (I.sev === 'b7' && I.third === 'maj') s = `The pull: the ♭7, ${byLabel('♭7')}, a tritone from the 3rd, ${third}.`;
    else if (I.sev === 'b7' && I.third === 'min') s = `The softness: the ♭7, ${byLabel('♭7')}, over the minor 3rd, ${third}.`;
    else if (I.sev === 'b7') s = `The float: the ♭7, ${byLabel('♭7')}, with no 3rd to settle it.`;
    else if (I.sev === '6') s = `The ease: the 6th, ${byLabel('6')}, a whole step above the 5th.`;
    else if (I.sus === 4) s = `The suspense: the 4th, ${third}, where the 3rd would be.`;
    else if (I.sus === 2) s = `The openness: the 2nd, ${third}, where the 3rd would be.`;
    else if (I.third === 'min') s = `The shade: the minor 3rd, ${third}.`;
    else if (I.third === 'maj') s = `The brightness: the major 3rd, ${third}.`;
    else if (I.power) s = 'Bare and strong: root and 5th, no 3rd.';
    else s = A.notes.length === 1 ? 'A single note.' : 'An open sound with no 3rd.';
    if (A.isSlash) {
      const r = A.roleOfPc[A.bass.pc];
      const what = { '3': '3rd', '♭3': 'minor 3rd', '5': '5th', '♭7': '♭7', '7': 'major 7th' }[r.label] || r.label;
      s += ` The ${what}, ${r.name}, is in the bass.`;
    }
    return s;
  }

  // The chord's notes spelled from another name for the same root (G♯ for A♭): pitch class → name.
  const ENHARMONIC = { 'C♯': 'D♭', 'D♭': 'C♯', 'D♯': 'E♭', 'E♭': 'D♯', 'F♯': 'G♭', 'G♭': 'F♯', 'G♯': 'A♭', 'A♭': 'G♯', 'A♯': 'B♭', 'B♭': 'A♯', 'B': 'C♭', 'C♭': 'B', 'E': 'F♭', 'F': 'E♯', 'C': 'B♯' };
  function spellChord(A, rootName) {
    const out = {};
    for (const pc of A.pcs) { const r = A.roleOfPc[pc]; out[pc] = spell(rootName, r.interval, r.deg); }
    return out;
  }

  /* ───────────── 2b. Key prediction ───────────── */
  // Krumhansl–Kessler key profiles, major and minor, from the tonic up.
  const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const KEY_MAJOR = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  const KEY_MINOR = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
  const keyOf = (tonic, mode) => ({ tonic, mode, name: (mode === 'major' ? KEY_MAJOR : KEY_MINOR)[tonic] + (mode === 'major' ? ' major' : ' minor') });
  function corr(a, b) {
    const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
    return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
  }
  // chords: a list of pitch lists (lowest note first is not assumed). Returns the most likely key, a confidence
  // from 0 to 1, and the next two candidates. One chord: the keys where it is diatonic, preferring it as I, then V, then IV.
  function predictKey(chords) {
    const lists = (chords || []).map((c) => (Array.isArray(c) ? c : c.pitches || [])).filter((c) => c.length);
    if (!lists.length) return null;
    const w = new Array(12).fill(0);
    // Each note counts once and each bass note once more. A run usually ends at home, so the last chord counts
    // double and its bass note gets a further bonus.
    lists.forEach((ps, i) => {
      const last = i === lists.length - 1 && lists.length > 1, k = last ? 2 : 1, lo = Math.min(...ps);
      for (const p of ps) w[mod12(p)] += k;
      w[mod12(lo)] += last ? 3 : 1;
    });
    const all = [];
    for (let t = 0; t < 12; t++) for (const [mode, prof] of [['major', KK_MAJOR], ['minor', KK_MINOR]]) {
      const rot = prof.map((_, i) => prof[mod12(i - t)]);
      all.push({ key: keyOf(t, mode), r: corr(w, rot) });
    }
    if (lists.length === 1) {
      const A = analyze(lists[0]), pcs = A.pcs;
      const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10, 11];
      for (const c of all) {
        const scale = (c.key.mode === 'major' ? MAJ : MIN).map((i) => mod12(c.key.tonic + i));
        const diatonic = pcs.every((pc) => scale.includes(pc));
        const deg = mod12(A.rootPc - c.key.tonic);
        c.pref = !diatonic ? 0 : deg === 0 ? 4 : deg === 7 ? 3 : deg === 5 ? 2 : 1;
      }
      all.sort((a, b) => b.pref - a.pref || b.r - a.r || a.key.tonic - b.key.tonic);
      const conf = all[0].pref >= 4 && all[1].pref < 4 ? 0.5 : 0.3;
      return { key: all[0].key, confidence: conf, alternatives: [all[1].key, all[2].key] };
    }
    all.sort((a, b) => b.r - a.r || a.key.tonic - b.key.tonic);
    const conf = Math.max(0, Math.min(1, (all[0].r - all[1].r) / 0.15)) * Math.max(0, Math.min(1, all[0].r / 0.75));
    return { key: all[0].key, confidence: r2(conf), alternatives: [all[1].key, all[2].key] };
  }

  /* ───────────── 3. Instruments, presets, capos ───────────── */
  // course spec: "E2+E3" (main first; same pitch = unison, other = octave), "G4@5" (starts at fret 5)
  function mk(id, name, group, scale, spec, fretCount) {
    const courses = spec.split(/\s+/).map((c) => {
      const [body, start] = c.split('@');
      const ps = body.split('+').map(parseNote);
      return { startFret: start ? +start : 0, strings: ps.map((p, i) => ({ pitch: p, role: i === 0 ? 'main' : p === ps[0] ? 'unison' : 'octave' })) };
    });
    return { id, name, group, scaleLengthMm: scale, fretCount: fretCount || 22, courses };
  }
  const PIANO = { id: 'piano', kind: 'piano', name: 'Piano', group: 'Keys' };
  const PRESETS = [
    mk('guitar', 'Guitar, standard', 'Guitar', 648, 'E2 A2 D3 G3 B3 E4'),
    mk('guitar-dropd', 'Guitar, drop D', 'Guitar', 648, 'D2 A2 D3 G3 B3 E4'),
    mk('guitar-ddd', 'Guitar, double drop D', 'Guitar', 648, 'D2 A2 D3 G3 B3 D4'),
    mk('guitar-dadgad', 'Guitar, DADGAD', 'Guitar', 648, 'D2 A2 D3 G3 A3 D4'),
    mk('guitar-openg', 'Guitar, open G', 'Guitar', 648, 'D2 G2 D3 G3 B3 D4'),
    mk('guitar-opend', 'Guitar, open D', 'Guitar', 648, 'D2 A2 D3 F#3 A3 D4'),
    mk('guitar-nashville', 'Guitar, Nashville (high-strung)', 'Guitar', 648, 'E3 A3 D4 G4 B3 E4'),
    mk('guitar-12', '12-string', 'Guitar', 648, 'E2+E3 A2+A3 D3+D4 G3+G4 B3+B3 E4+E4'),
    mk('baritone-b', 'Baritone guitar, B', 'Guitar', 686, 'B1 E2 A2 D3 F#3 B3'),
    mk('baritone-a', 'Baritone guitar, A', 'Guitar', 686, 'A1 D2 G2 C3 E3 A3'),
    mk('tenor-cgda', 'Tenor guitar, CGDA', 'Guitar', 584, 'C3 G3 D4 A4', 20),
    mk('tenor-chicago', 'Tenor guitar, Chicago', 'Guitar', 584, 'D3 G3 B3 E4', 20),
    mk('mandolin', 'Mandolin', 'Mandolin family', 349, 'G3+G3 D4+D4 A4+A4 E5+E5', 20),
    mk('mandola', 'Mandola', 'Mandolin family', 420, 'C3+C3 G3+G3 D4+D4 A4+A4', 20),
    mk('octave-mandolin', 'Octave mandolin', 'Mandolin family', 560, 'G2+G2 D3+D3 A3+A3 E4+E4', 20),
    mk('uke', 'Ukulele, re-entrant', 'Ukulele', 432, 'G4 C4 E4 A4', 18),
    mk('uke-lowg', 'Ukulele, low G', 'Ukulele', 432, 'G3 C4 E4 A4', 18),
    mk('uke-baritone', 'Baritone ukulele', 'Ukulele', 483, 'D3 G3 B3 E4', 18),
    mk('banjo-g', '5-string banjo, open G', 'Banjo', 667, 'G4@5 D3 G3 B3 D4'),
    mk('banjo-doublec', '5-string banjo, double C', 'Banjo', 667, 'G4@5 C3 G3 C4 D4'),
    mk('banjo-sawmill', '5-string banjo, sawmill', 'Banjo', 667, 'G4@5 D3 G3 C4 D4'),
    mk('tenor-banjo', 'Tenor banjo, CGDA', 'Banjo', 533, 'C3 G3 D4 A4', 19),
    mk('tenor-banjo-irish', 'Tenor banjo, Irish', 'Banjo', 584, 'G2 D3 A3 E4', 19),
  ];
  // Written octave: how many octaves above sounding pitch the instrument is traditionally written (the staff's
  // "Written for" switch). Guitars, 12-string, 5-string banjo and octave mandolin are written an octave up. Where
  // tradition varies (baritone and tenor guitar, tenor banjo, mandola) they stay at sounding pitch for Bill to decide.
  const WRITTEN_UP = ['guitar', 'guitar-dropd', 'guitar-ddd', 'guitar-dadgad', 'guitar-openg', 'guitar-opend', 'guitar-nashville', 'guitar-12', 'banjo-g', 'banjo-doublec', 'banjo-sawmill', 'octave-mandolin'];
  for (const p of PRESETS) p.writtenOctave = WRITTEN_UP.includes(p.id) ? 1 : 0;
  // Tiple tunings vary by tradition. These are starting points Bill must confirm; neither is a live preset.
  const TIPLE_TEMPLATES = [
    mk('tiple-colombian', 'Tiple (Colombian, DGBE)', 'Tiple', 530, 'D3+D4+D4 G3+G4+G4 B3+B3+B3 E4+E4+E4', 20),
    mk('tiple-martin', 'Tiple (American, ADF♯B)', 'Tiple', 432, 'A3+A4 D3+D4+D4 F#3+F#4+F#4 B4+B4', 18),
  ];

  const mainOf = (course) => (course.strings.find((s) => s.role === 'main') || course.strings[0]).pitch;
  const fullCapo = (instr, fret) => partialCapo(instr, fret, instr.courses.map((_, i) => i));
  function partialCapo(instr, fret, courseIdxs) {
    const strings = [];
    for (const c of courseIdxs) instr.courses[c].strings.forEach((_, s) => strings.push(c + ':' + s));
    return { fret, strings };
  }

  // Distance from nut to fret n; a finger sits midway between fret n-1 and n.
  const fretDist = (L, n) => L * (1 - Math.pow(2, -n / 12));
  const fingerPos = (L, n) => (fretDist(L, n - 1) + fretDist(L, n)) / 2;
  const spanMm = (L, lo, hi) => (hi > lo ? fingerPos(L, hi) - fingerPos(L, lo) : 0);

  // Precompute, for every course, what sounds when it is open or fretted.
  function prepare(instr, capos) {
    capos = capos || [];
    const n = instr.courses.length, fretCount = Math.min(instr.fretCount || 22, 24);
    const P = { instr, capos, n, fretCount, L: instr.scaleLengthMm, open: [], fret: [], minEff: [], covered: [], split: [] };
    P.pos = [0]; for (let f = 1; f <= fretCount; f++) P.pos.push(fingerPos(P.L, f));
    for (let c = 0; c < n; c++) {
      const course = instr.courses[c], start = course.startFret || 0;
      const effs = course.strings.map((_, s) => {
        let e = start;
        for (const cp of capos) if (cp.strings.includes(c + ':' + s) && cp.fret > e) e = cp.fret;
        return e;
      });
      const minEff = Math.min(...effs);
      P.minEff.push(minEff);
      P.split.push(Math.max(...effs) !== minEff);
      const make = (f) => {
        const o = { f, main: 0, pitches: [], octs: [], pcm: 0 };
        course.strings.forEach((st, s) => {
          const p = st.pitch + (Math.max(f, effs[s]) - start);
          o.pitches.push(p); o.pcm |= 1 << mod12(p);
          if (st.role === 'octave') o.octs.push(p);
        });
        o.main = o.pitches[Math.max(0, course.strings.findIndex((s) => s.role === 'main'))];
        return o;
      };
      P.open.push(make(0));
      const row = new Array(fretCount + 1).fill(null);
      for (let f = minEff + 1; f <= fretCount; f++) row[f] = make(f);
      P.fret.push(row);
    }
    // capo collision table: collide[c][f] true when fretting course c at f sits beside a capo pad at f
    P.collide = [];
    for (let c = 0; c < n; c++) {
      const row = {};
      for (const cp of capos) {
        const cov = (i) => i >= 0 && i < n && instr.courses[i].strings.some((_, s) => cp.strings.includes(i + ':' + s));
        const all = instr.courses[c].strings.every((_, s) => cp.strings.includes(c + ':' + s));
        if (!all && (cov(c - 1) || cov(c + 1) || cov(c))) row[cp.fret] = true;
      }
      P.collide.push(row);
    }
    return P;
  }

  function insert(arr, v) { let i = arr.length; arr.push(v); while (i > 0 && arr[i - 1] > v) { arr[i] = arr[i - 1]; i--; } arr[i] = v; }
  const NO_OCTS = [];
  function voicingOf(P, fr) {
    const mains = [], multi = [];
    let octs = NO_OCTS, mask = 0, pos = 0;
    for (let c = 0; c < P.n; c++) {
      const f = fr[c];
      if (f < 0) continue;
      if (f > 0 && (pos === 0 || f < pos)) pos = f;
      const o = f === 0 ? P.open[c] : P.fret[c][f];
      if (!o) continue;
      insert(mains, o.main); mask |= o.pcm;
      const ps = o.pitches;
      for (let i = 0; i < ps.length; i++) insert(multi, ps[i]);
      if (o.octs.length) { if (octs === NO_OCTS) octs = []; for (let i = 0; i < o.octs.length; i++) octs.push(o.octs[i]); }
    }
    let all = multi;
    for (let i = 1; i < multi.length; i++) if (multi[i] === multi[i - 1]) { all = multi.filter((p, k) => k === 0 || p !== multi[k - 1]); break; }
    return { mains, all, multi, octs, mask, pos };
  }

  // Fingers, barre, span and position of a fingering.
  function handShape(P, fr) {
    const n = P.n;
    let lo = 99, hi = 0, opens = 0, sounding = 0, first = -1, last = -1;
    for (let c = 0; c < n; c++) {
      const f = fr[c];
      if (f >= 0) { sounding++; if (first < 0) first = c; last = c; }
      if (f === 0) opens++;
      if (f > 0) { if (f < lo) lo = f; if (f > hi) hi = f; }
    }
    let mutes = 0;
    for (let c = first + 1; c < last; c++) if (fr[c] < 0) mutes++;
    if (hi === 0) return { fingers: 0, barre: false, span: 0, lo: 0, hi: 0, opens, sounding, interiorMutes: mutes };
    let above = 0, runs = 0, inRun = false, barre = false;
    for (let c = 0; c < n; c++) {
      const f = fr[c];
      if (f > lo) above++;
      if (f === lo) { if (!inRun) { runs++; inRun = true; } else barre = true; }
      else if (f === 0) inRun = false; // an open course breaks a barre
    }
    return { fingers: above + runs, barre, span: hi > lo ? P.pos[hi] - P.pos[lo] : 0, lo, hi, opens, sounding, interiorMutes: mutes };
  }

  /* ───────────── 4. Scoring ───────────── */
  const DEFAULT_WEIGHTS = {
    topOctave: 8, topDifferent: 40, octaveOverTop: 6, colourMissing: 25, rubLost: 15, bassMissing: 10,
    registerPerSemitone: 1, registerCap: 30, lowMud: 6, doubledThird: 6, doubledColour: 8,
    rootMissing: 4, fifthMissing: 1, highPosition: 2, definingLost: 60, tieWindow: 3, easeWeight: 2,
  };
  const WEIGHT_INFO = {
    topOctave: ['Top note moved an octave', 'per octave'],
    topDifferent: ['Top note is a different note', ''],
    octaveOverTop: ['Octave string over the top', ''],
    colourMissing: ['Colour tone missing', 'each'],
    rubLost: ['Rub lost', 'each'],
    bassMissing: ['Bass missing', ''],
    registerPerSemitone: ['Register shift', 'per semitone'],
    registerCap: ['Register shift, most it can cost', ''],
    lowMud: ['Low mud', 'each'],
    doubledThird: ['Doubled 3rd', ''],
    doubledColour: ['Doubled colour tone', ''],
    rootMissing: ['Root missing', ''],
    fifthMissing: ['5th missing', ''],
    highPosition: ['High position', 'per fret above 12'],
    definingLost: ['Defining tone lost (rule relaxed)', 'each'],
    tieWindow: ['Tie window where difficulty decides', 'points'],
    easeWeight: ['Prefer easier: points per difficulty step', ''],
  };
  const LEARNABLE = ['topOctave', 'topDifferent', 'octaveOverTop', 'colourMissing', 'rubLost', 'bassMissing', 'registerPerSemitone', 'lowMud', 'doubledThird', 'doubledColour', 'rootMissing', 'fifthMissing', 'highPosition'];
  const DEFAULT_OPTIONS = { comfortMm: 105, impossibleMm: 135, preferEasier: false, maxResults: 4, ranked: 0 };

  // Source and result pitches paired in sorted order: lowest with lowest,
  // highest with highest, the rest spread evenly across the longer list.
  function registerShift(src, res) {
    const m = src.length, n = res.length;
    if (!m || !n) return 0;
    let sum = 0;
    if (m <= n) for (let i = 0; i < m; i++) { const j = m === 1 ? n - 1 : Math.round((i * (n - 1)) / (m - 1)); sum += Math.abs(res[j] - src[i].pitch) * src[i].weight; }
    else for (let j = 0; j < n; j++) { const i = n === 1 ? m - 1 : Math.round((j * (m - 1)) / (n - 1)); sum += Math.abs(res[j] - src[i].pitch) * src[i].weight; }
    return sum;
  }

  const nameIn = (A, p) => (A.roleOfPc[mod12(p)] ? A.roleOfPc[mod12(p)].name : (A.flat ? FLAT : SHARP)[mod12(p)]) + octaveOf(p);
  function topPenalty(A, src, top, f, W, bd) {
    if (src.pitch === top) return 0;
    const half = f < 1 ? ' (half weight)' : '';
    if (src.pc === mod12(top)) {
      const oct = Math.abs(top - src.pitch) / 12, pts = W.topOctave * oct * f;
      if (bd && pts > 0) bd.push({ rule: 'Top note changed', key: 'topOctave', detail: `${nameIn(A, src.pitch)} → ${nameIn(A, top)}, ${oct === 1 ? 'an octave' : oct + ' octaves'} ${top > src.pitch ? 'up' : 'down'}${half}`, points: r2(pts) });
      return pts;
    }
    const pts = W.topDifferent * f;
    if (bd && pts > 0) bd.push({ rule: 'Top note changed', key: 'topDifferent', detail: `${nameIn(A, src.pitch)} → ${nameIn(A, top)}, a different note${half}`, points: r2(pts) });
    return pts;
  }
  const CNT = new Int8Array(12);
  // One implementation for ranking and for explaining: detail only adds the wording.
  function scoreVoicing(A, V, W, detail) {
    const bd = detail ? [] : null, mains = V.mains, all = V.all, mask = V.mask, role = A.roleOfPc;
    if (!mains.length) return { score: 999, breakdown: bd || [] };
    let s = 0;
    const top = mains[mains.length - 1];
    const add = (rule, key, pts, det) => { bd.push({ rule, key, detail: det, points: r2(pts) }); };
    // top note
    if (A.octTop) s += topPenalty(A, A.top, top, 0.5, W, bd) + topPenalty(A, A.octTop, top, 0.5, W, bd);
    else s += topPenalty(A, A.top, top, 1, W, bd);
    // octave string over the top
    for (let i = 0; i < V.octs.length; i++) if (V.octs[i] > top) { s += W.octaveOverTop; if (bd && W.octaveOverTop > 0) add('Octave string over the top', 'octaveOverTop', W.octaveOverTop, `an octave string sounds above ${nameIn(A, top)}`); break; }
    // defining tones (only reachable when the hard rule was relaxed)
    for (let i = 0; i < A.definingPcs.length; i++) { const pc = A.definingPcs[i]; if (!((mask >> pc) & 1)) { s += W.definingLost; if (bd && W.definingLost > 0) add('Defining tone lost', 'definingLost', W.definingLost, `no ${roleWord(role[pc])} (${role[pc].name})`); } }
    // colour tones
    for (let i = 0; i < A.colourPcs.length; i++) { const pc = A.colourPcs[i]; if (!((mask >> pc) & 1)) { s += W.colourMissing; if (bd && W.colourMissing > 0) add('Colour tone missing', 'colourMissing', W.colourMissing, `no ${roleWord(role[pc])} (${role[pc].name})`); } }
    // rubs
    for (let r = 0; r < A.rubs.length; r++) {
      const rub = A.rubs[r];
      let kept = false;
      for (let i = 0; i < all.length && !kept; i++) {
        const a = all[i] % 12;
        if (a !== rub.pcLo && a !== rub.pcHi) continue;
        for (let j = i + 1; j < all.length && all[j] - all[i] <= 2; j++) {
          const b = all[j] % 12;
          if ((a === rub.pcLo && b === rub.pcHi) || (a === rub.pcHi && b === rub.pcLo)) { kept = true; break; }
        }
      }
      if (!kept) { s += W.rubLost; if (bd && W.rubLost > 0) add('Rub lost', 'rubLost', W.rubLost, `${nameIn(A, rub.lo)} against ${nameIn(A, rub.hi)} no longer sit side by side`); }
    }
    // bass
    if (!A.isSlash && all[0] % 12 !== A.bass.pc) { s += W.bassMissing; if (bd && W.bassMissing > 0) add('Bass missing', 'bassMissing', W.bassMissing, `${nameIn(A, all[0])} is on the bottom, not ${A.bass.name}`); }
    // register
    const semis = registerShift(A.notes, mains);
    if (semis > 0) {
      const raw = semis * W.registerPerSemitone, capped = Math.min(raw, W.registerCap);
      s += capped;
      if (bd && capped > 0) add('Register shift', 'registerPerSemitone', capped, `${r2(semis)} semitones of movement${raw > capped ? `, capped at ${W.registerCap}` : ''}`);
    }
    // low mud: mud the source already had is part of its sound, so only new mud is charged
    for (let i = 0; i + 1 < all.length && all[i] < 55; i++) {
      if (all[i + 1] - all[i] <= 4 && !(A.pitches.includes(all[i]) && A.pitches.includes(all[i + 1]))) { s += W.lowMud; if (bd && W.lowMud > 0) add('Low mud', 'lowMud', W.lowMud, `${nameIn(A, all[i])} and ${nameIn(A, all[i + 1])} are close together below G3`); }
    }
    // doubling (across courses; a unison or octave string in one course is not a doubling)
    CNT.fill(0);
    let dbl = false;
    for (let i = 0; i < mains.length; i++) if (++CNT[mains[i] % 12] > 1) dbl = true;
    if (dbl) for (let pc = 0; pc < 12; pc++) {
      if (CNT[pc] < 2 || CNT[pc] <= A.pcCount[pc] || !role[pc]) continue;
      const rl = role[pc].role;
      if (rl === 'third') { s += W.doubledThird; if (bd && W.doubledThird > 0) add('Bad doubling', 'doubledThird', W.doubledThird, `the ${roleWord(role[pc])} (${role[pc].name}) is doubled`); }
      else if (rl === 'ext' || rl === 'alt') { s += W.doubledColour; if (bd && W.doubledColour > 0) add('Bad doubling', 'doubledColour', W.doubledColour, `the ${roleWord(role[pc])} (${role[pc].name}) is doubled`); }
    }
    if (!((mask >> A.rootPc) & 1)) { s += W.rootMissing; if (bd && W.rootMissing > 0) add('Root missing', 'rootMissing', W.rootMissing, `no ${A.rootName}`); }
    if (A.fifthPc != null && !((mask >> A.fifthPc) & 1)) { s += W.fifthMissing; if (bd && W.fifthMissing > 0) add('5th missing', 'fifthMissing', W.fifthMissing, `no ${role[A.fifthPc].name}`); }
    // high position: fretted notes far up the neck sound shorter and duller than the same pitches lower down
    if (V.pos > 12) { const pts = (V.pos - 12) * W.highPosition; s += pts; if (bd && pts > 0) add('High position', 'highPosition', pts, `the hand sits at fret ${V.pos}, ${V.pos - 12} above the 12th`); }
    return { score: r2(s), breakdown: bd };
  }

  function roleWord(r) {
    if (!r) return 'note';
    return { 'R': 'root', '3': '3rd', '♭3': 'minor 3rd', '4': '4th', '2': '2nd', '5': '5th', '♭7': '♭7', '7': 'major 7th', '6': '6th', '°7': 'diminished 7th', '9': '9th', '11': '11th', '13': '13th' }[r.label] || r.label;
  }

  /* ───────────── 5. Difficulty (never part of the sound score) ───────────── */
  function difficultyOf(P, fr, opt, detail) {
    const h = handShape(P, fr), parts = detail ? [] : null;
    let total = 0;
    const add = (label, v) => { total += v; if (parts && v) parts.push({ label, value: r2(v) }); };
    add(parts ? `${h.fingers} finger${h.fingers === 1 ? '' : 's'}` : '', [0, 0.5, 1.5, 2.5, 3.5][Math.min(h.fingers, 4)]);
    const r = h.span / opt.comfortMm;
    if (r > 0) add(parts ? `${Math.round(h.span)} mm stretch` : '', r2(r * 2.5 + (r > 1 ? (r - 1) * 6 : 0)));
    if (h.barre) add('barre', 1);
    if (h.interiorMutes) add(parts ? `${h.interiorMutes} muted inside string${h.interiorMutes === 1 ? '' : 's'}` : '', Math.min(h.interiorMutes, 2));
    if (h.lo > 12) add('high position', 1); else if (h.lo > 7) add('upper position', 0.5);
    if (h.opens) add(parts ? `${h.opens} open string${h.opens === 1 ? '' : 's'}` : '', -0.4 * Math.min(h.opens, 3));
    return { value: Math.max(0, Math.min(10, Math.round(total * 2) / 2)), parts, shape: h };
  }

  /* ───────────── 6. Listing fingerings ───────────── */
  // Every playable fingering that uses only the source's pitch classes,
  // searched by hand position (the lowest fretted fret).
  // visit(sel) is called for each playable fingering, with a scratch array it must copy if it keeps it.
  function enumerate(P, A, opt, minSound, need, visit) {
    const n = P.n, sel = new Array(n).fill(-1), mask = A.pcMask;
    let count = 0;
    const openOk = P.open.map((o) => (o.pcm & ~mask) === 0);
    let p = 0, hi = 0;
    // canP[c]: some course from c onwards can be fretted at p. A branch that has not yet placed a finger at p
    // and can no longer do so would be rejected at its end, so it is dropped now.
    const canP = new Uint8Array(n + 1);
    // above: fingers above the lowest fret; runs: barre runs at the lowest fret (an open course breaks a run).
    // Both only grow along a branch, so a branch past four fingers is dropped as soon as it gets there.
    const dfs = (c, above, atP, sound, got, runs, inRun) => {
      if (sound + (n - c) < minSound) return;
      if (need) { const miss = need & ~got; if (miss && POP[miss] > n - c) return; }
      if (p > 0 && atP === 0 && !canP[c]) return;
      if (c === n) { count++; visit(sel); return; }
      sel[c] = -1; dfs(c + 1, above, atP, sound, got, runs, inRun);
      if (openOk[c]) { sel[c] = 0; dfs(c + 1, above, atP, sound + 1, got | P.open[c].pcm, runs, false); }
      if (p > 0) {
        const row = P.fret[c], col = P.collide[c];
        for (let f = p; f <= hi; f++) {
          const o = row[f];
          if (!o || (o.pcm & ~mask) !== 0 || col[f]) continue;
          if (f === p) {
            const r = inRun ? runs : runs + 1;
            if (above + r > 4) continue;
            sel[c] = f; dfs(c + 1, above, atP + 1, sound + 1, got | o.pcm, r, true);
          } else {
            if (above + 1 + runs > 4) continue;
            sel[c] = f; dfs(c + 1, above + 1, atP, sound + 1, got | o.pcm, runs, inRun);
          }
        }
      }
      sel[c] = -1;
    };
    dfs(0, 0, 0, 0, 0, 0, false);
    for (p = 1; p <= P.fretCount; p++) {
      hi = p;
      while (hi + 1 <= P.fretCount && P.pos[hi + 1] - P.pos[p] <= opt.impossibleMm) hi++;
      canP[n] = 0;
      for (let c = n - 1; c >= 0; c--) { const o = P.fret[c][p]; canP[c] = canP[c + 1] || (o && (o.pcm & ~mask) === 0 && !P.collide[c][p]) ? 1 : 0; }
      dfs(0, 0, 0, 0, 0, 0, false);
    }
    return count;
  }

  // The same voicing voicingOf builds, written into reusable arrays: used while scoring every candidate, so the
  // search allocates nothing per fingering. Only candidates that can still reach the results become objects.
  function scratchVoicing() { return { mains: [], all: null, multi: [], dedup: [], octs: [], mask: 0, pos: 0 }; }
  function voicingInto(P, fr, V) {
    const mains = V.mains, multi = V.multi, octs = V.octs;
    mains.length = 0; multi.length = 0; octs.length = 0;
    let mask = 0, pos = 0;
    for (let c = 0; c < P.n; c++) {
      const f = fr[c];
      if (f < 0) continue;
      if (f > 0 && (pos === 0 || f < pos)) pos = f;
      const o = f === 0 ? P.open[c] : P.fret[c][f];
      if (!o) continue;
      insert(mains, o.main); mask |= o.pcm;
      const ps = o.pitches;
      for (let i = 0; i < ps.length; i++) insert(multi, ps[i]);
      for (let i = 0; i < o.octs.length; i++) octs.push(o.octs[i]);
    }
    let all = multi;
    for (let i = 1; i < multi.length; i++) if (multi[i] === multi[i - 1]) {
      const d = V.dedup; d.length = 0;
      for (let k = 0; k < multi.length; k++) if (k === 0 || multi[k] !== multi[k - 1]) d.push(multi[k]);
      all = d; break;
    }
    V.all = all; V.mask = mask; V.pos = pos;
    return V;
  }
  const POP = new Uint8Array(4096);
  for (let i = 1; i < 4096; i++) POP[i] = POP[i >> 1] + (i & 1);

  /* ───────────── 7. Ranking and results ───────────── */
  // Order by slash-bass tier, then score. Difficulty only breaks ties inside
  // the tie window (or is added in when "prefer easier" is on).
  function cmpFr(a, b) { for (let i = 0; i < a.length && i < b.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }
  // prep(c) fills in difficulty and the pitch key; it is only run on candidates still in contention.
  function rankAll(cands, W, opt, prep) {
    const n = cands.length;
    if (opt.preferEasier) for (let i = 0; i < n; i++) { prep(cands[i]); cands[i].key = cands[i].score + W.easeWeight * cands[i].diff; }
    else for (let i = 0; i < n; i++) cands[i].key = cands[i].score;
    let pool = cands;
    if (n > 3000) {
      const ks = new Float64Array(n);
      for (let i = 0; i < n; i++) ks[i] = cands[i].tier * 1e6 + cands[i].key;
      ks.sort();
      const thr = ks[1500] + W.tieWindow;
      pool = cands.filter((c) => c.tier * 1e6 + c.key <= thr);
    }
    for (let i = 0; i < pool.length; i++) prep(pool[i]);
    pool.sort((a, b) => a.tier - b.tier || a.key - b.key || a.diff - b.diff || cmpFr(a.fr, b.fr));
    const seen = new Set(), list = [];
    for (const c of pool) { if (seen.has(c.multiKey)) continue; seen.add(c.multiKey); list.push(c); if (list.length >= 400) break; }
    return list;
  }
  function pickOrdered(list, W, limit, diverse) {
    const rest = list.slice(), out = [];
    while (rest.length && out.length < limit) {
      const head = rest[0];
      let bi = 0;
      for (let i = 1; i < rest.length; i++) {
        const c = rest[i];
        if (c.tier !== head.tier || c.key > head.key + W.tieWindow) break;
        if (c.diff < rest[bi].diff) bi = i;
      }
      const c = rest.splice(bi, 1)[0];
      if (diverse && c.pos != null && out.filter((o) => Math.abs(o.pos - c.pos) <= 2).length >= 2) continue;
      out.push(c);
    }
    return out;
  }

  function compromiseOf(A, V, breakdown, tier) {
    const dropped = [], doubled = [], parts = [];
    for (const pc of A.pcs) if (!((V.mask >> pc) & 1)) dropped.push({ pc, label: A.roleOfPc[pc].label, word: roleWord(A.roleOfPc[pc]), name: A.roleOfPc[pc].name });
    const cnt = new Array(12).fill(0);
    for (const p of V.mains) cnt[mod12(p)]++;
    for (const pc of A.pcs) if (cnt[pc] >= 2 && cnt[pc] > A.pcCount[pc]) doubled.push({ pc, label: A.roleOfPc[pc].label, word: roleWord(A.roleOfPc[pc]), name: A.roleOfPc[pc].name });
    const join = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
    if (dropped.length) parts.push('dropped the ' + join(dropped.map((d) => d.word)));
    const top = V.mains[V.mains.length - 1];
    if (top !== A.top.pitch) {
      if (mod12(top) === A.top.pc) { const o = Math.abs(top - A.top.pitch) / 12; parts.push(`top note ${top > A.top.pitch ? 'up' : 'down'} ${o === 1 ? 'an octave' : o + ' octaves'}`); }
      else parts.push(`top note is now ${A.roleOfPc[mod12(top)] ? A.roleOfPc[mod12(top)].name : SHARP[mod12(top)]}`);
    }
    const low = V.all[0];
    if (A.isSlash) {
      if (tier === 2) parts.push(`${A.bass.name} kept inside the chord, not on the bottom`);
      else if (tier === 1 && low !== A.bass.pitch) parts.push(`bass ${low > A.bass.pitch ? 'up' : 'down'} ${Math.abs(low - A.bass.pitch) / 12 === 1 ? 'an octave' : Math.abs(low - A.bass.pitch) / 12 + ' octaves'}`);
    } else if (mod12(low) !== A.bass.pc && ((V.mask >> A.bass.pc) & 1)) parts.push(`${A.roleOfPc[mod12(low)] ? A.roleOfPc[mod12(low)].name : SHARP[mod12(low)]} on the bottom`);
    const strong = doubled.filter((d) => ['third', 'ext', 'alt'].includes(A.roleOfPc[d.pc].role));
    if (strong.length) parts.push('doubled the ' + join(strong.map((d) => d.word)));
    for (const b of breakdown) if (b.key === 'rubLost') { parts.push('lost a rub'); break; }
    let text;
    const same = V.all.length === A.pitches.length && V.all.every((p, i) => p === A.pitches[i]);
    if (same) text = 'Exact: every note at its own pitch.';
    else if (!parts.length) text = 'Every note kept, in a new spacing.';
    else { text = parts.join(', '); text = text[0].toUpperCase() + text.slice(1) + '.'; }
    // what happened to each source note, for the source strip
    const sourceMap = A.notes.map((nt) => {
      if (V.all.includes(nt.pitch)) return { pitch: nt.pitch, status: 'kept' };
      const samePc = V.all.filter((p) => mod12(p) === nt.pc);
      if (!samePc.length) return { pitch: nt.pitch, status: 'dropped' };
      const near = samePc.reduce((a, b) => (Math.abs(b - nt.pitch) < Math.abs(a - nt.pitch) ? b : a));
      return { pitch: nt.pitch, status: near > nt.pitch ? 'up' : 'down', to: near };
    });
    // why each dropped note was the one to go, from the weights that priced it
    return { dropped, doubled, text, sourceMap, exact: same };
  }

  function whyDropped(A, W, d) {
    const role = A.roleOfPc[d.pc].role;
    if (role === 'fifth') return `The 5th (${d.name}) went: it costs ${W.fifthMissing}, the least of any tone, because the ear fills it in.`;
    if (role === 'root') return `The root (${d.name}) went: it costs ${W.rootMissing}, less than any colour or guide tone it would have pushed out.`;
    if (role === 'ext' || role === 'alt') return `The ${d.word} (${d.name}) went at a cost of ${W.colourMissing}: no playable shape kept it without losing more elsewhere.`;
    return `The ${d.word} (${d.name}) is a defining tone. It went only because no playable shape could hold it, at a cost of ${W.definingLost}.`;
  }

  function tierOf(A, V) {
    if (!A.isSlash) return 0;
    if (mod12(V.all[0]) === A.bass.pc) return 1;
    return (V.mask >> A.bass.pc) & 1 ? 2 : 3;
  }

  function finishStrings(P, A, W, opt, c) {
    const V = c.V, sc = scoreVoicing(A, V, W, true), d = difficultyOf(P, c.fr, opt, true);
    const comp = compromiseOf(A, V, sc.breakdown, c.tier);
    const flags = [];
    if (c.tier === 3) flags.push({ code: 'needsBass', text: 'This one needs a bass instrument or a second player.' });
    const lost = A.definingPcs.filter((pc) => !((V.mask >> pc) & 1));
    if (lost.length) flags.push({ code: 'definingLost', text: 'No playable shape keeps the ' + lost.map((pc) => roleWord(A.roleOfPc[pc])).join(' and ') + '.' });
    return {
      kind: 'strings', fingering: c.fr.slice(), text: c.fr.map((f) => (f < 0 ? 'x' : f)).join('-'),
      courses: c.fr.map((f, i) => (f < 0 ? null : { fret: f, pitches: (f === 0 ? P.open[i] : P.fret[i][f]).pitches.slice(), main: (f === 0 ? P.open[i] : P.fret[i][f]).main, octs: (f === 0 ? P.open[i] : P.fret[i][f]).octs.slice() })),
      pitches: V.all.slice(), mains: V.mains.slice(), multiKey: V.multi.join(','),
      score: sc.score, breakdown: sc.breakdown, difficulty: d.value, difficultyParts: d.parts,
      fingers: d.shape.fingers, barre: d.shape.barre, spanMm: Math.round(d.shape.span), position: d.shape.lo,
      bassTier: c.tier, compromise: comp, why: comp.dropped.map((x) => whyDropped(A, W, x)), flags,
    };
  }

  function sourceNotes(source) {
    if (!source) return [];
    if (source.kind === 'strings') {
      const P = prepare(source.instrument, source.capos), out = [];
      source.fingering.forEach((f, c) => {
        if (f == null || f < 0) return;
        const o = f === 0 ? P.open[c] : P.fret[c][f];
        if (!o) return;
        o.pitches.forEach((p, s) => out.push({ pitch: p, weight: source.instrument.courses[c].strings[s].role === 'octave' ? 0.5 : 1 }));
      });
      return out;
    }
    return (source.pitches || []).map((p) => ({ pitch: p, weight: 1 }));
  }

  function translate(req) {
    // req.previousVoicing is accepted and ignored: the hook for voice leading later.
    const W = Object.assign({}, DEFAULT_WEIGHTS, req.weights || {});
    const opt = Object.assign({}, DEFAULT_OPTIONS, req.options || {});
    const A = analyze(sourceNotes(req.source));
    const flags = [];
    if (A.empty) return { analysis: A, results: [], flags, ranked: [] };
    if (req.target && req.target.kind === 'piano') return translateToPiano(A, W, opt);
    const P = prepare(req.target, req.capos);
    let need = 0;
    for (const pc of A.definingPcs) need |= 1 << pc;
    // Score every playable fingering into flat arrays: fingerings, scores and bass tiers.
    const n = P.n, frs = [], scores = [], tiers = [], SV = scratchVoicing();
    const visit = (sel) => {
      for (let c = 0; c < n; c++) frs.push(sel[c]);
      voicingInto(P, sel, SV);
      scores.push(scoreVoicing(A, SV, W, false).score); tiers.push(tierOf(A, SV));
    };
    let minSound = Math.min(3, A.pcs.length, P.n), found = 0, relaxed = false;
    for (; minSound >= 1 && !found; minSound--) {
      found = enumerate(P, A, opt, minSound, need, visit);
      if (!found && need) { found = enumerate(P, A, opt, minSound, 0, visit); relaxed = found > 0; }
    }
    if (relaxed) flags.push({ code: 'definingRelaxed', text: 'No playable shape keeps every defining tone, so that rule was relaxed.' });
    const frAt = (i) => frs.slice(i * n, i * n + n);
    // Ranking key: the score, plus difficulty when "prefer easier" is on.
    const keys = new Float64Array(found);
    if (opt.preferEasier) for (let i = 0; i < found; i++) keys[i] = scores[i] + W.easeWeight * difficultyOf(P, frAt(i), opt, false).value;
    else for (let i = 0; i < found; i++) keys[i] = scores[i];
    // Past 3,000 candidates, only those within the tie window of the best 1,501 can reach the results.
    let thr = Infinity;
    if (found > 3000) {
      const ks = new Float64Array(found);
      for (let i = 0; i < found; i++) ks[i] = tiers[i] * 1e6 + keys[i];
      ks.sort();
      thr = ks[1500] + W.tieWindow;
    }
    const cands = [];
    for (let i = 0; i < found; i++) {
      if (tiers[i] * 1e6 + keys[i] > thr) continue;
      const fr = frAt(i);
      cands.push({ fr, V: voicingOf(P, fr), score: scores[i], tier: tiers[i], key: keys[i], diff: -1, multiKey: null, pos: 0 });
    }
    const prep = (c) => {
      if (c.multiKey) return;
      c.diff = difficultyOf(P, c.fr, opt, false).value;
      c.multiKey = c.V.multi.join(',');
      let lo = 0; for (const f of c.fr) if (f > 0 && (lo === 0 || f < lo)) lo = f;
      c.pos = lo;
    };
    for (let i = 0; i < cands.length; i++) prep(cands[i]);
    cands.sort((a, b) => a.tier - b.tier || a.key - b.key || a.diff - b.diff || cmpFr(a.fr, b.fr));
    const seen = new Set(), list = [];
    for (const c of cands) { if (seen.has(c.multiKey)) continue; seen.add(c.multiKey); list.push(c); if (list.length >= 400) break; }
    const results = pickOrdered(list, W, opt.maxResults, true).map((c) => finishStrings(P, A, W, opt, c));
    if (A.isSlash && results.length) {
      if (results[0].bassTier === 2) flags.push({ code: 'bassInside', text: `${A.bass.name} can't sit on the bottom here, so it is kept inside the chord.` });
      if (results[0].bassTier === 3) flags.push({ code: 'needsBass', text: 'This one needs a bass instrument or a second player.' });
    }
    const ranked = opt.ranked ? pickOrdered(list, W, opt.ranked, false).map((c) => finishStrings(P, A, W, opt, c)) : [];
    return { analysis: A, results, flags, ranked, considered: found };
  }

  // Score one given fingering (Bill's own, or a test's expected answer), even if it breaks a hard rule.
  function evaluate(req) {
    const W = Object.assign({}, DEFAULT_WEIGHTS, req.weights || {});
    const opt = Object.assign({}, DEFAULT_OPTIONS, req.options || {});
    const A = req.analysis || analyze(sourceNotes(req.source));
    if (req.target && req.target.kind === 'piano') return finishPiano(A, W, { pitches: req.pitches.slice().sort(num), label: 'Your voicing' });
    const P = prepare(req.target, req.capos);
    const fr = req.fingering.map((f, c) => (f == null || f < 0 ? -1 : f === 0 ? 0 : P.fret[c][f] ? f : -1));
    const V = voicingOf(P, fr);
    const c = { fr, V, tier: tierOf(A, V) };
    const res = finishStrings(P, A, W, opt, c);
    const h = handShape(P, fr), v = [];
    if (h.fingers > 4) v.push('needs more than four fingers');
    if (h.span > opt.impossibleMm) v.push(`a ${Math.round(h.span)} mm stretch, past the limit`);
    if (V.mask & ~A.pcMask) v.push('adds a note that is not in the source');
    fr.forEach((f, i) => { if (f > 0 && P.collide[i][f]) v.push('a finger collides with the capo'); });
    res.violations = v;
    return res;
  }

  /* ───────────── 8. Strings to piano ───────────── */
  function splitHands(ps) {
    const n = ps.length;
    let best = null;
    for (let k = 0; k <= n; k++) {
      const L = ps.slice(0, k), R = ps.slice(k);
      if (L.length > 5 || R.length > 5) continue;
      const sl = L.length ? L[L.length - 1] - L[0] : 0, sr = R.length ? R[R.length - 1] - R[0] : 0;
      if (sl > 16 || sr > 16) continue;
      const gap = k > 0 && k < n ? ps[k] - ps[k - 1] : 0;
      const q = (sl > 14 ? 100 : 0) + (sr > 14 ? 100 : 0) + Math.max(sl, sr) - gap;
      if (!best || q < best.q) best = { q, left: L, right: R, maxSpan: Math.max(sl, sr) };
    }
    return best;
  }
  function finishPiano(A, W, c) {
    const ps = c.pitches, hands = splitHands(ps);
    let mask = 0; for (const p of ps) mask |= 1 << mod12(p);
    const V = { mains: ps, all: ps, multi: ps, octs: [], mask, pos: 0 };
    const tier = tierOf(A, V), sc = scoreVoicing(A, V, W, true), comp = compromiseOf(A, V, sc.breakdown, tier);
    const parts = [{ label: `${ps.length} notes`, value: ps.length > 8 ? 3 : ps.length > 5 ? 2 : 1 }];
    const span = hands ? hands.maxSpan : 24;
    if (span > 14) parts.push({ label: 'a hand stretched past a 9th', value: 4 });
    else if (span > 12) parts.push({ label: 'a hand at a 9th', value: 2 });
    const flags = hands ? [] : [{ code: 'unplayable', text: 'Too wide for two hands: roll it or drop a note.' }];
    return {
      kind: 'piano', label: c.label, pitches: ps.slice(), mains: ps.slice(), multiKey: ps.join(','),
      text: ps.map((p) => (A.roleOfPc[mod12(p)] ? A.roleOfPc[mod12(p)].name : SHARP[mod12(p)]) + octaveOf(p)).join(' '),
      hands: hands ? { left: hands.left, right: hands.right } : { left: [], right: ps.slice() },
      score: sc.score, breakdown: sc.breakdown, difficulty: Math.min(10, parts.reduce((a, p) => a + p.value, 0) + (hands ? 0 : 5)), difficultyParts: parts,
      bassTier: tier, compromise: comp, why: comp.dropped.map((x) => whyDropped(A, W, x)), flags, playable: !!hands,
    };
  }
  function translateToPiano(A, W, opt) {
    const inRange = (p) => p >= 21 && p <= 108;
    const exact = A.pitches.slice();
    const top = A.top.pitch, cands = [{ label: 'Exact pitches', pitches: exact }];
    if (inRange(A.bass.pitch - 12)) cands.push({ label: 'Bass doubled an octave below', pitches: [A.bass.pitch - 12, ...exact] });
    // close right hand under the top note, over a left-hand bass
    let pcs = A.pcs.slice();
    const closeUnder = (list) => list.map((pc) => top - mod12(top - pc)).sort(num);
    let rh = closeUnder(pcs);
    if (rh.length > 5) rh = closeUnder(pcs.filter((pc) => pc !== A.fifthPc)).slice(-5);
    let lb = A.bass.pitch;
    while (lb > rh[0] - 3 || lb > 55) lb -= 12;
    if (inRange(lb)) cands.push({ label: 'Close right hand over a left-hand bass', pitches: [lb, ...rh] });
    // spread: bass plus 7th (or 5th) in the left hand, the rest under the top note
    const second = A.seventhPc != null && A.seventhPc !== A.bass.pc ? A.seventhPc : A.fifthPc != null && A.fifthPc !== A.bass.pc ? A.fifthPc : null;
    let sb = A.bass.pitch; while (sb > 48) sb -= 12;
    const lh = [sb];
    if (second != null) lh.push(sb + mod12(second - A.bass.pc));
    const rest = pcs.filter((pc) => pc !== A.bass.pc && pc !== second);
    let sr = closeUnder(rest.includes(A.top.pc) ? rest : [...rest, A.top.pc]);
    while (sr.length && sr[0] <= lh[lh.length - 1]) sr.shift();
    if (inRange(sb) && sr.length) cands.push({ label: 'Spread, top note kept', pitches: [...lh, ...sr] });
    const seen = new Set(), done = [];
    for (const c of cands) {
      c.pitches = [...new Set(c.pitches)].sort(num);
      const k = c.pitches.join(',');
      if (seen.has(k) || !c.pitches.every(inRange)) continue;
      seen.add(k);
      const r = finishPiano(A, W, c);
      r.tier = r.bassTier; r.diff = r.difficulty; r.fr = r.pitches; r.pos = null;
      done.push(r);
    }
    const list = rankAll(done, W, opt, () => {});
    const results = pickOrdered(list, W, opt.maxResults, false);
    // the piano can play the source as it stands, so the exact pitches always lead
    const ex = results.findIndex((r) => r.label === 'Exact pitches' && r.playable);
    if (ex > 0) results.unshift(results.splice(ex, 1)[0]);
    return { analysis: A, results, flags: [], ranked: opt.ranked ? results.slice() : [], considered: done.length };
  }

  /* ───────────── 9. Explain ───────────── */
  function explain(result) {
    const lines = result.breakdown.map((b) => `${b.rule}: ${b.detail}. ${b.points} point${b.points === 1 ? '' : 's'}.`);
    if (!lines.length) lines.push('Nothing given up. 0 points.');
    lines.push(`Sound score: ${result.score}. Lower is closer.`);
    lines.push(`Difficulty ${result.difficulty} of 10 (${result.difficultyParts.map((p) => p.label).join(', ') || 'open strings only'}). Difficulty never changes the sound score.`);
    return lines;
  }

  /* ───────────── 10. Capo suggestions ───────────── */
  function capoShapes(instr) {
    const n = instr.courses.length, shapes = [];
    const strs = (idx) => { const a = idx.map((i) => n - i).sort(num); return a.length > 1 && a[a.length - 1] - a[0] === a.length - 1 ? `strings ${a[0]}–${a[a.length - 1]}` : 'string' + (a.length > 1 ? 's ' : ' ') + a.join(', '); };
    const push = (kind, fret, idx) => shapes.push({ label: `${kind} at ${fret} on ${strs(idx)}`, capos: [partialCapo(instr, fret, idx)] });
    if (n >= 5) { push('a cut capo', 2, [n - 5, n - 4, n - 3]); push('a partial capo', 2, [n - 4, n - 3, n - 2]); }
    if (n >= 4) push('a partial capo', 2, instr.courses.map((_, i) => i).slice(1));
    instr.courses.forEach((c, i) => { if (c.startFret > 0) for (const f of [7, 9]) if (f > c.startFret) shapes.push({ label: `a spike at ${f} on string ${n - i}`, capos: [partialCapo(instr, f, [i])] }); });
    return shapes;
  }
  // Tries common partial-capo shapes and saved setups. Suggests one only when
  // the top score improves by at least 15%. The caller shows it; nothing is applied silently.
  function suggestCapo(req, setups) {
    if (!req.target || req.target.kind === 'piano') return null;
    const base = translate(req);
    const trials = capoTrials(req, setups);
    for (const t of trials) { const r = translate(Object.assign({}, req, { capos: t.capos })); t.top = r.results[0] || null; }
    return capoVerdict(base.results[0] || null, trials);
  }
  // The capo setups worth trying, in the order they are judged: common shapes first, then Bill's saved setups.
  // The app runs these one at a time so the search can be stopped between them.
  function capoTrials(req, setups) {
    if (!req.target || req.target.kind === 'piano') return [];
    const cur = JSON.stringify(req.capos || []), out = [];
    for (const s of capoShapes(req.target)) if (JSON.stringify(s.capos) !== cur) out.push({ label: s.label, capos: s.capos });
    for (const s of setups || []) if (JSON.stringify(s.capos) !== cur) out.push({ label: `your “${s.name}” setup`, capos: s.capos });
    return out;
  }
  // baseTop: the top result without the change; trials: capoTrials, each with .top set to its top result (or null).
  function capoVerdict(baseTop, trials) {
    if (!baseTop || baseTop.score <= 0) return null;
    const baseScore = baseTop.score;
    let best = null;
    for (const t of trials) {
      if (!t.top || t.top.bassTier > baseTop.bassTier) continue;
      const gain = (baseScore - t.top.score) / baseScore;
      if (gain >= 0.15 && (!best || gain > best.gain)) best = { label: t.label, capos: t.capos, gain: r2(gain), from: baseScore, to: t.top.score };
    }
    return best;
  }

  /* ───────────── 10b. Same notes, other fingerings ───────────── */
  // Every playable fingering on the same instrument and capos that sounds exactly the same pitches as the given
  // one, the given fingering left out. Ordered by hand position, then difficulty.
  function sameNotes(req) {
    const opt = Object.assign({}, DEFAULT_OPTIONS, req.options || {});
    const P = prepare(req.target, req.capos), n = P.n;
    const given = req.fingering.map((f) => (f == null || f < 0 ? -1 : f));
    const V0 = voicingOf(P, given), want = new Map();
    for (const p of V0.mains) want.set(p, (want.get(p) || 0) + 1);
    const key0 = V0.multi.join(','), out = [], sel = new Array(n).fill(-1);
    let left = V0.mains.length;
    const take = (p) => { const k = want.get(p) || 0; if (!k) return false; want.set(p, k - 1); left--; return true; };
    const give = (p) => { want.set(p, want.get(p) + 1); left++; };
    const dfs = (c) => {
      if (left > n - c) return;
      if (c === n) {
        if (left) return;
        const fr = sel.slice(), h = handShape(P, fr);
        if (h.fingers > 4 || h.span > opt.impossibleMm || cmpFr(fr, given) === 0) return;
        if (voicingOf(P, fr).multi.join(',') !== key0) return;
        out.push({ fingering: fr, text: fr.map((f) => (f < 0 ? 'x' : f)).join('-'), position: h.lo, difficulty: difficultyOf(P, fr, opt, false).value });
        return;
      }
      sel[c] = -1; dfs(c + 1);
      if (take(P.open[c].main)) { sel[c] = 0; dfs(c + 1); give(P.open[c].main); }
      for (let f = P.minEff[c] + 1; f <= P.fretCount; f++) {
        const o = P.fret[c][f];
        if (!o || P.collide[c][f] || !take(o.main)) continue;
        sel[c] = f; dfs(c + 1); give(o.main);
      }
      sel[c] = -1;
    };
    if (left) dfs(0);
    out.sort((a, b) => a.position - b.position || a.difficulty - b.difficulty || cmpFr(a.fingering, b.fingering));
    return out;
  }

  /* ───────────── 11. Learning from picks (weight nudging, not machine learning) ───────────── */
  function traits(instr) {
    if (!instr || instr.kind === 'piano' || !instr.courses) return { piano: true };
    const mains = instr.courses.map(mainOf), n = mains.length;
    let reentrant = false;
    for (let i = 1; i < n; i++) if (mains[i] < mains[i - 1]) reentrant = true;
    const low = Math.min(...mains);
    return { courses: n <= 4 ? '4' : n === 5 ? '5' : '6+', reentrant, range: low < 48 ? 'low' : low < 55 ? 'mid' : 'high' };
  }
  function contextKey(analysis, instr) {
    const t = traits(instr);
    return analysis.family + '|' + (t.piano ? 'piano' : `${t.courses}|${t.reentrant ? 're-entrant' : 'linear'}|${t.range}`);
  }
  function contextLabel(key) {
    const [fam, a, b, c] = key.split('|');
    const famWord = { 'major': 'major chords', 'minor': 'minor chords', 'dominant': 'dominants', 'altered dominant': 'altered dominants', 'major 7': 'major 7ths', 'minor 7': 'minor 7ths', 'half-diminished': 'half-diminished chords', 'diminished': 'diminished chords', 'suspended': 'suspended chords', 'other': 'other chords' }[fam] || fam;
    return a === 'piano' ? `${famWord}, on piano` : `${famWord}, on ${c}-range ${b === 're-entrant' ? 're-entrant ' : ''}${a === '6+' ? 'six-course' : a === '5' ? 'five-course' : 'four-course'} instruments`;
  }
  const newTaste = () => ({ global: {}, contexts: {} });
  function effectiveMultipliers(taste, ctxKey) {
    const ctx = (taste.contexts || {})[ctxKey], share = ctx ? ctx.n / (ctx.n + 8) : 0, out = {};
    for (const k of Object.keys(DEFAULT_WEIGHTS)) {
      const g = (taste.global || {})[k] || 1, c = ctx && ctx.mult[k] ? ctx.mult[k] : g;
      out[k] = (1 - share) * g + share * c;
    }
    return out;
  }
  function effectiveWeights(base, taste, ctxKey) {
    const W = Object.assign({}, DEFAULT_WEIGHTS, base || {}), m = effectiveMultipliers(taste || newTaste(), ctxKey);
    for (const k of Object.keys(W)) W[k] = r2(W[k] * m[k]);
    return W;
  }
  const pointsByKey = (result) => { const o = {}; for (const b of result.breakdown) o[b.key] = (o[b.key] || 0) + b.points; return o; };
  // pick: {ctxKey, winner, losers, strength (1, or 2 for "none of these"), onlyKeys (a reason chip), count}
  function learn(taste, pick) {
    const t = JSON.parse(JSON.stringify(taste || newTaste()));
    if (!t.contexts[pick.ctxKey]) t.contexts[pick.ctxKey] = { n: 0, mult: {} };
    const ctx = t.contexts[pick.ctxKey];
    const losers = pick.losers || [];
    if (pick.count !== false) ctx.n += 1;
    if (!losers.length) return t;
    const lr = (0.05 * (pick.strength || 1)) / losers.length;
    const w = pointsByKey(pick.winner);
    const clamp = (x) => Math.max(0.25, Math.min(4, x));
    const keys = pick.onlyKeys || LEARNABLE;
    for (const l of losers) {
      const lp = pointsByKey(l);
      for (const k of keys) {
        let dir = 0;
        if (k === 'tieWindow') dir = pick.winner.difficulty < l.difficulty ? 1 : 0;
        else { const a = w[k] || 0, b = lp[k] || 0; dir = a > b ? -1 : a < b ? 1 : 0; }
        if (!dir) continue;
        const f = 1 + dir * lr;
        const g0 = t.global[k] || 1; // a context starts from where the global weight stood
        t.global[k] = r2x(clamp(g0 * f));
        ctx.mult[k] = r2x(clamp((ctx.mult[k] || g0) * f));
      }
    }
    return t;
  }
  const r2x = (x) => Math.round(x * 10000) / 10000;
  const CHIP_KEYS = {
    'top note': ['topOctave', 'topDifferent', 'octaveOverTop'],
    'fuller': ['rootMissing', 'fifthMissing', 'bassMissing', 'colourMissing'],
    'the rub': ['rubLost'],
    'smoother': ['registerPerSemitone', 'lowMud', 'doubledThird', 'doubledColour', 'highPosition'],
    'easier': ['tieWindow'],
  };
  const TASTE_PHRASE = {
    topOctave: ['you keep the top note in its own octave', 'you let the top note change octave'],
    topDifferent: ['you hold on to the top note', 'you let the top note change'],
    octaveOverTop: ['you keep octave strings under the melody', "you don't mind an octave string over the top"],
    colourMissing: ['you keep the colour tones', 'you let colour tones go first'],
    rubLost: ['you keep the rubs', 'you let the rubs go'],
    bassMissing: ['you want the bass note on the bottom', "you don't need the bass note on the bottom"],
    registerPerSemitone: ['you stay close to the original register', 'you are happy to move register'],
    lowMud: ['you avoid close notes down low', "you don't mind close notes down low"],
    doubledThird: ['you avoid doubling the 3rd', "you don't mind a doubled 3rd"],
    doubledColour: ['you avoid doubling colour tones', "you don't mind doubled colour tones"],
    rootMissing: ['you keep the root', 'you drop the root freely'],
    fifthMissing: ['you keep the 5th', 'you drop the 5th freely'],
    highPosition: ['you stay below the 12th fret', 'you are happy high up the neck'],
    tieWindow: ['you take the easier shape when two are close', 'you take the closer sound even when it is harder'],
  };
  function tasteNotes(taste, minPicks, threshold) {
    const out = [];
    for (const key of Object.keys((taste || {}).contexts || {}).sort()) {
      const ctx = taste.contexts[key];
      if (ctx.n < (minPicks || 5)) continue;
      const m = effectiveMultipliers(taste, key);
      for (const k of Object.keys(TASTE_PHRASE)) {
        if (Math.abs(m[k] - 1) <= (threshold || 0.25)) continue;
        const label = contextLabel(key);
        out.push({ ctxKey: key, key: k, mult: r2(m[k]), picks: ctx.n, text: `On ${label}, ${TASTE_PHRASE[k][m[k] > 1 ? 0 : 1]}.` });
      }
    }
    return out;
  }

  /* ───────────── 12. Test runner ───────────── */
  // tc: {source:{kind:'piano',notes}|{kind:'strings',instrument:id,fingering,capos}, target:id, capos, accept:[fingering…] | acceptNotes:['C3 E3…']}
  function resolveSource(src, find) {
    if (src.kind === 'strings') return { kind: 'strings', instrument: find(src.instrument), fingering: src.fingering, capos: src.capos || [] };
    return { kind: 'piano', pitches: src.pitches || parseNotes(src.notes) };
  }
  function runTest(tc, find, weights, options) {
    const source = resolveSource(tc.source, find), target = find(tc.target);
    if (!target || (source.kind === 'strings' && !source.instrument)) return { rank: 0, results: [], ranked: [], accepted: [], missing: true };
    const req = { source, target, capos: tc.capos || [], weights, options: Object.assign({ ranked: 12 }, options || {}) };
    const out = translate(req);
    const accepted = target.kind === 'piano'
      ? (tc.acceptNotes || []).map((s) => (Array.isArray(s) ? s.slice() : parseNotes(s)).sort(num).join(','))
      : (tc.accept || []).map((f) => evaluate(Object.assign({}, req, { fingering: f, analysis: out.analysis })).multiKey);
    let rank = 0;
    out.results.forEach((r, i) => { if (!rank && accepted.includes(r.multiKey)) rank = i + 1; });
    return { rank, results: out.results, ranked: out.ranked, accepted, analysis: out.analysis, flags: out.flags };
  }

  return {
    VERSION, PIANO, PRESETS, TIPLE_TEMPLATES, DEFAULT_WEIGHTS, DEFAULT_OPTIONS, WEIGHT_INFO, LEARNABLE, CHIP_KEYS,
    analyze, translate, evaluate, explain, suggestCapo, capoShapes, capoTrials, capoVerdict, sameNotes,
    prepare, voicingOf, handShape, difficultyOf, sourceNotes, fullCapo, partialCapo, mainOf, spanMm, fingerPos, fretDist,
    spellChord, ENHARMONIC, predictKey, traits, contextKey, contextLabel, newTaste, effectiveWeights, effectiveMultipliers, learn, tasteNotes,
    runTest, resolveSource, parseNote, parseNotes, pitchName, roleWord, intervalShort, mod12, octaveOf,
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Engine;

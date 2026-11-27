/* CHORDNAME — reading a typed chord name, and building a sensible piano voicing from it. Pure functions, no page
   access, like the engine, so they port with it. The engine itself is unchanged: a typed name becomes notes here,
   and those notes go through the usual translation.

   Conventions (listed for Bill to overrule): 7alt means 7♭9♯9♭13. A 13 chord leaves out the 11 unless the name
   asks for it, as players do; 9, 11 and 13 chords include the 7th. */
const ChordName = (function () {
  'use strict';
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const mod12 = (n) => ((n % 12) + 12) % 12;
  // Spellings people type: # and b for ♯ and ♭, - and – for minor, o for diminished, Δ for major 7th.
  function normalise(text) {
    return String(text || '').trim()
      .replace(/^([A-Ga-g])#/, '$1♯').replace(/^([A-Ga-g])b/, '$1♭')
      .replace(/\/([A-Ga-g])#/, '/$1♯').replace(/\/([A-Ga-g])b(?![0-9])/, '/$1♭')
      .replace(/#/g, '♯').replace(/b(?=\d)/g, '♭').replace(/–/g, '-').replace(/∆/g, 'Δ').replace(/\s+/g, '');
  }
  function parseNote(s) {
    const m = /^([A-Ga-g])(♯|♭)?$/.exec(s);
    if (!m) return null;
    const pc = mod12(LETTER_PC[m[1].toUpperCase()] + (m[2] === '♯' ? 1 : m[2] === '♭' ? -1 : 0));
    return { pc, name: m[1].toUpperCase() + (m[2] || '') };
  }
  // Tokens, longest first, so "maj7" is not read as "m" + "aj7".
  const TOKENS = [
    ['m(maj', 'minmaj'], ['m(Δ', 'minmaj'], ['mM', 'minmaj'], ['mΔ', 'minmaj'], ['min(maj', 'minmaj'], ['-Δ', 'minmaj'],
    ['maj', 'maj'], ['Maj', 'maj'], ['Δ', 'maj'], ['M', 'maj'],
    ['min', 'min'], ['mi', 'min'], ['m', 'min'], ['-', 'min'],
    ['dim', 'dim'], ['°', 'dim'], ['o', 'dim'], ['ø', 'half'], ['Ø', 'half'],
    ['aug', 'aug'], ['+', 'aug'],
    ['sus2', 'sus2'], ['sus4', 'sus4'], ['sus', 'sus4'],
    ['add', 'add'], ['alt', 'alt'], ['(no3)', 'no3'], ['no3', 'no3'], ['(no5)', 'no5'], ['no5', 'no5'],
    ['6/9', 'six9'], ['69', 'six9'],
  ];
  // Returns { ok, rootPc, rootName, bassPc, bassName, pcs (intervals above the root), understood, message }.
  function parse(text) {
    const t = normalise(text);
    const rm = /^([A-Ga-g](?:♯|♭)?)/.exec(t);
    if (!rm) return { ok: false, understood: '', message: 'Start with the root: a letter A to G.' };
    const root = parseNote(rm[1]);
    let rest = t.slice(rm[1].length), bass = null;
    const sm = /\/([A-Ga-g](?:♯|♭)?)$/.exec(rest);
    if (sm && !/\d$/.test(rest.slice(0, sm.index))) { bass = parseNote(sm[1]); rest = rest.slice(0, sm.index); }
    else if (sm && /^\/[A-Ga-g]/.test(sm[0])) { bass = parseNote(sm[1]); rest = rest.slice(0, sm.index); }
    const f = { third: 'maj', fifth: 7, seventh: null, majSeventh: false, ext: new Set(), implied9: false, adds: new Set(), alts: new Map(), sus: null, power: false, no3: false, no5: false, six: false, nine: false };
    let i = 0, understood = root.name;
    const fail = () => ({ ok: false, understood, message: understood.length > root.name.length ? `Understood ${understood}, but not “${rest.slice(i)}”.` : `Didn't recognise “${rest.slice(i)}”.` });
    while (i < rest.length) {
      const ch = rest[i];
      if (ch === '(' || ch === ')' || ch === ',') { i++; continue; }
      let tok = null;
      for (const [s, kind] of TOKENS) if (rest.startsWith(s, i)) { tok = [s, kind]; break; }
      if (tok) {
        const [s, kind] = tok;
        i += s.length;
        if (kind === 'maj') f.majSeventh = true;
        else if (kind === 'min') f.third = 'min';
        else if (kind === 'minmaj') { f.third = 'min'; f.majSeventh = true; }
        else if (kind === 'dim') { f.third = 'min'; f.fifth = 6; f.dim = true; }
        else if (kind === 'half') { f.third = 'min'; f.fifth = 6; f.seventh = 10; }
        else if (kind === 'aug') f.fifth = 8;
        else if (kind === 'sus2') f.sus = 2;
        else if (kind === 'sus4') f.sus = 5;
        else if (kind === 'alt') { f.seventh = 10; f.alts.set(1, 9); f.alts.set(3, 9); f.alts.set(8, 13); }
        else if (kind === 'no3') f.no3 = true;
        else if (kind === 'no5') f.no5 = true;
        else if (kind === 'six9') { f.six = true; f.nine = true; }
        else if (kind === 'add') {
          const m = /^(♭|♯)?(\d+)/.exec(rest.slice(i));
          if (!m) return fail();
          i += m[0].length;
          const n = +m[2], a = m[1] === '♭' ? -1 : m[1] === '♯' ? 1 : 0;
          const iv = { 2: 2, 9: 2, 4: 5, 11: 5, 6: 9, 13: 9 }[n];
          if (iv == null) return fail();
          f.adds.add(mod12(iv + a));
        }
        understood = root.name + rest.slice(0, i);
        continue;
      }
      const m = /^(♭|♯)?(\d+)/.exec(rest.slice(i));
      if (!m) return fail();
      const n = +m[2], a = m[1] === '♭' ? -1 : m[1] === '♯' ? 1 : 0;
      i += m[0].length;
      if (a) {
        // Alterations: ♭5 ♯5 ♭9 ♯9 ♯11 ♭13. Each replaces the plain tone it alters.
        const iv = { 5: 7, 9: 2, 11: 5, 13: 9 }[n];
        if (iv == null) return fail();
        f.alts.set(mod12(iv + a), n);
        if (n === 5) f.fifth = null;
      } else if (n === 5 && !f.seventh && i === m[0].length && rest.length === m[0].length) f.power = true;
      else if (n === 6) f.six = true;
      else if (n === 7) f.seventh = f.seventh || 10;
      else if (n === 9) { f.seventh = f.seventh || (f.six ? null : 10); f.nine = true; }
      else if (n === 11) { f.seventh = f.seventh || 10; f.implied9 = true; f.ext.add(5); }
      else if (n === 13) { f.seventh = f.seventh || 10; f.implied9 = true; f.ext.add(9); }
      else if (n === 5) f.fifth = 7;
      else return fail();

      understood = root.name + rest.slice(0, i);
    }
    // Assemble the intervals above the root.
    const pcs = new Set([0]);
    if (f.power) pcs.add(7);
    else {
      if (f.sus) pcs.add(f.sus); else if (!f.no3) pcs.add(f.third === 'min' ? 3 : 4);
      if (f.fifth != null && !f.no5) pcs.add(f.fifth);
      if (f.dim && f.seventh === 10 && !f.half) { /* "dim7" written as dim + 7 is a diminished 7th */ pcs.add(9); f.seventh = null; }
      if (f.seventh) pcs.add(f.majSeventh ? 11 : f.seventh);
      else if (f.majSeventh && (f.ext.size || f.nine)) pcs.add(11);
      if (f.six) pcs.add(9);
      if (f.nine) pcs.add(2);
      for (const e of f.ext) pcs.add(e);
      for (const a of f.adds) pcs.add(a);
      // An 11 or 13 implies the 9th, unless the name alters it (13♭9 has a flat 9 instead).
      if (f.implied9 && ![...f.alts.values()].includes(9)) pcs.add(2);
      for (const [a] of f.alts) pcs.add(a);
    }
    const out = [...pcs].sort((a, b) => a - b);
    // Tones the name implies that players often leave out: the 5th, and the 9th under an 11 or 13.
    const optional = [7].concat(f.implied9 ? [2] : []).filter((iv) => pcs.has(iv));
    return { ok: true, optional, rootPc: root.pc, rootName: root.name, bassPc: bass ? bass.pc : null, bassName: bass ? bass.name : null, intervals: out, pcs: out.map((iv) => mod12(root.pc + iv)), understood: root.name + rest + (bass ? '/' + bass.name : '') };
  }

  // A sensible piano voicing: the bass (the root, or the slash note) around C3, the other tones in close position
  // above it from about C4, the top note the highest chord tone. With more than six upper tones the 5th goes first.
  function voicing(parsed) {
    const bassPc = parsed.bassPc != null ? parsed.bassPc : parsed.rootPc;
    const bass = 48 + bassPc;
    let upper = parsed.intervals.map((iv) => mod12(parsed.rootPc + iv)).filter((pc) => pc !== bassPc || parsed.bassPc != null);
    if (parsed.bassPc != null) upper = upper.filter((pc) => pc !== parsed.bassPc);
    const fifth = mod12(parsed.rootPc + 7);
    if (upper.length > 6 && upper.includes(fifth)) upper = upper.filter((pc) => pc !== fifth);
    const pitches = upper.map((pc) => 60 + mod12(pc)).sort((a, b) => a - b);
    return [bass, ...pitches.filter((p) => p > bass)];
  }

  return { parse, voicing, normalise };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ChordName;

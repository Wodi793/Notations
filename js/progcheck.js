/* PROGCHECK — the Lab's progression and key checks, shared by the command-line tests and the engine worker.
   Pure: takes the engine and the cases, returns results. */
const ProgCheck = (function () {
  'use strict';
  // Properties, not exact answers: the top line moves by step where some choice allows it, a note is held where
  // some choice could hold one, and no hand shift is longer than the comfortable reach.
  function run(E, data, find, comfortMm) {
    const P = (s) => E.parseNotes(s.replace(/♭/g, 'b'));
    const out = { progressions: [], keys: [] };
    for (const tc of data.progressions) {
      const target = find(tc.target), chords = tc.chords.map((c) => ({ source: { kind: 'piano', pitches: P(c) } }));
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      const r = E.progression({ chords, target, capos: [], options: { comfortMm } });
      const ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
      const problems = [];
      for (let i = 1; i < r.chords.length; i++) {
        const a = r.chords[i - 1], b = r.chords[i], A = a.chosen, B = b.chosen;
        if (!A || !B) { problems.push(`${a.name}→${b.name}: no playable voicing`); continue; }
        const top = (x) => x.mains[x.mains.length - 1];
        const stepPossible = a.candidates.some((x) => b.candidates.some((y) => Math.abs(top(x) - top(y)) <= 2));
        if (stepPossible && Math.abs(top(A) - top(B)) > 2) problems.push(`${a.name}→${b.name}: the top line leaps ${Math.abs(top(A) - top(B))} semitones though a step was possible`);
        const holdPossible = a.candidates.some((x) => b.candidates.some((y) => x.mains.some((p) => y.mains.includes(p))));
        if (holdPossible && !r.steps[i - 1].lines.some((l) => l.key === 'vlCommon')) problems.push(`${a.name}→${b.name}: a note could be held but none is`);
        if (A.position && B.position && target.scaleLengthMm) {
          const mm = E.spanMm(target.scaleLengthMm, Math.min(A.position, B.position), Math.max(A.position, B.position));
          if (mm > (comfortMm || 105)) problems.push(`${a.name}→${b.name}: the hand moves ${Math.round(mm)} mm`);
        }
      }
      out.progressions.push({ id: tc.id, name: tc.name, ms, problems, run: r.chords.map((c) => (c.chosen ? `${c.name} ${c.chosen.text}` : `${c.name} –`)) });
    }
    for (const k of data.keys) {
      const g = E.predictKey(k.chords.map(P));
      out.keys.push({ want: k.key, got: g ? g.key.name : null, confidence: g ? g.confidence : 0, ok: !!g && g.key.name === k.key, chords: k.chords.length });
    }
    return out;
  }
  return { run };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = ProgCheck;

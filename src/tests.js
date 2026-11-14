/* TESTS — starter set. Every case is provisional: the expected answers were
   written from common practice before the engine was run, and Bill has not
   confirmed them. Fingerings read low course to high; -1 is muted, 0 is open.
   A result passes when it sounds the same pitches as an accepted answer. */
const STARTER_TESTS = [
  { id: 's01', name: 'Close C triad', source: { kind: 'piano', notes: 'C4 E4 G4' }, target: 'mandolin', accept: [[5, 2, 3, 3], [0, 2, 3, 3], [-1, 2, 3, 3]], note: 'G should stay on top. The usual shapes put it on the E course.' },
  { id: 's02', name: 'Cmaj7, B on top', source: { kind: 'piano', notes: 'C4 E4 G4 B4' }, target: 'mandolin', accept: [[5, 2, 2, -1], [5, 5, 7, 7], [0, 2, 2, -1]], note: 'Root, 3rd and 7th with B on top, or the four-course shape an octave up.' },
  { id: 's03', name: 'G7', source: { kind: 'piano', notes: 'G3 B3 D4 F4' }, target: 'mandolin', accept: [[0, 0, 2, 1], [0, 3, 2, 1]], note: 'The open G7. F has to move up an octave.' },
  { id: 's04', name: 'D7♯9', source: { kind: 'piano', notes: 'D3 F#3 C4 F4' }, target: 'mandolin', accept: [[7, 4, 3, 1], [-1, 4, 3, 1]], note: 'The whole voicing an octave up, or 3, ♭7, ♯9 without the root.' },
  { id: 's05', name: 'Am7, 9th on top', source: { kind: 'piano', notes: 'A3 C4 E4 G4 B4' }, target: 'mandolin', accept: [[5, 5, 2, -1], [2, 5, 3, 7], [5, 5, 7, 7]], note: 'Five notes on four courses: the root or the 5th has to go, the 9th stays.' },
  { id: 's06', name: 'F/A', source: { kind: 'piano', notes: 'A3 C4 F4' }, target: 'mandolin', accept: [[2, 3, 3, 1], [2, 3, 3, -1], [2, 3, 0, 1]], note: 'A on the bottom comes first.' },
  { id: 's07', name: 'C/E', source: { kind: 'piano', notes: 'E4 G4 C5' }, target: 'mandolin', accept: [[9, 5, 3, -1]], note: 'Playable at pitch.' },
  { id: 's08', name: 'F triad, C on top', source: { kind: 'piano', notes: 'F4 A4 C5' }, target: 'uke', accept: [[2, 0, 1, 3], [2, -1, 1, 3], [5, 5, 5, 3]], note: 'The everyday F with a high C. The open C string sits below the source.' },
  { id: 's09', name: 'Close C triad', source: { kind: 'piano', notes: 'C4 E4 G4' }, target: 'uke', accept: [[0, 0, 0, -1], [0, 0, 0, 3]], note: 'Three open strings give the exact pitches.' },
  { id: 's10', name: 'G7', source: { kind: 'piano', notes: 'G3 B3 D4 F4' }, target: 'uke-lowg', accept: [[0, 2, 1, 2]], note: 'The standard G7 shape, low G on the bottom. It puts B on top, not F.' },
  { id: 's11', name: 'Open G', source: { kind: 'strings', instrument: 'guitar', fingering: [3, 2, 0, 0, 0, 3] }, target: 'mandolin', accept: [[0, 0, 2, 3], [7, 5, 2, 3]], note: 'Open G, or the chop shape.' },
  { id: 's12', name: 'E7 shape', source: { kind: 'strings', instrument: 'guitar', fingering: [0, 2, 0, 1, 0, 0] }, target: 'mandolin', accept: [[1, 0, 2, 0]], note: 'The standard mandolin E7. G♯ ends up on the bottom.' },
  { id: 's13', name: 'Open Cadd9', source: { kind: 'strings', instrument: 'guitar', fingering: [-1, 3, 2, 0, 3, 3] }, target: 'mandolin', accept: [[5, 2, 5, 3], [0, 2, 5, 3]], note: 'Root, 3rd, 9th, 5th with G on top.' },
  { id: 's14', name: 'DADGAD Dsus4, all open', source: { kind: 'strings', instrument: 'guitar-dadgad', fingering: [0, 0, 0, 0, 0, 0] }, target: 'mandolin', accept: [[7, 5, 0, -1], [7, 5, 5, -1], [7, 5, 0, 10]], note: 'The G-against-A rub and the D on top pull against each other.' },
  { id: 's15', name: 'G chop chord', source: { kind: 'strings', instrument: 'mandolin', fingering: [7, 5, 2, 3] }, target: 'guitar', accept: [[-1, -1, 12, 12, 12, 15], [-1, -1, 0, 0, 0, 3], [3, 2, 0, 0, 0, 3]], note: 'At pitch up the neck, or the same shape an octave down.' },
  { id: 's16', name: 'A minor', source: { kind: 'strings', instrument: 'mandolin', fingering: [2, 2, 3, 0] }, target: 'guitar', accept: [[-1, 0, 2, 2, 1, 0], [-1, -1, 2, 2, 1, 0]], note: 'A guitarist would play open Am, an octave down.' },
  { id: 's17', name: 'Close G triad', source: { kind: 'piano', notes: 'G3 B3 D4' }, target: 'banjo-g', accept: [[-1, -1, 0, 0, 0], [-1, 0, 0, 0, 0], [0, 0, 0, 0, 0]], note: 'Open strings. The 5th-string drone sits above the source top.' },
  { id: 's18', name: 'Close C triad', source: { kind: 'piano', notes: 'C4 E4 G4' }, target: 'banjo-g', accept: [[-1, -1, 5, 5, 5], [0, -1, 5, 5, 5], [0, 2, 0, 1, 2]], note: 'The barre at 5, or the open C shape with the drone on top.' },
  { id: 's19', name: 'A, capo at 2', source: { kind: 'piano', notes: 'A3 C#4 E4 A4' }, target: 'guitar', capoFret: 2, accept: [[5, 4, 0, 0, 0, 5], [-1, -1, 7, 6, 5, 5], [-1, -1, 0, 0, 0, 5]], note: 'G shape over the capo, or the barre at 5.' },
  { id: 's20', name: 'Open C', source: { kind: 'strings', instrument: 'guitar', fingering: [-1, 3, 2, 0, 1, 0] }, target: 'piano', acceptNotes: ['C3 E3 G3 C4 E4'], note: 'The piano can play the exact pitches. This case only proves the path works.' },
  { id: 's21', name: 'G chop chord', source: { kind: 'strings', instrument: 'mandolin', fingering: [7, 5, 2, 3] }, target: 'piano', acceptNotes: ['D4 G4 B4 G5'], note: 'Exact pitches again. This case only proves the path works.' },
].map((t) => Object.assign({ status: 'provisional', capos: [] }, t));
if (typeof module !== 'undefined' && module.exports) module.exports = STARTER_TESTS;

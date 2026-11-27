/* MUSICXML — reserved for the analysis round. Score import will turn a MusicXML passage into the progression
   format (docs/progression-format.md): a chord per beat with its sounding pitches, bar and beat, and each
   instrument's line in concert pitch. The entry point is defined so the rest of the app can be built against it;
   the parser is not built, and its test is pending. It must stay pure (no DOMParser: Web Workers and Swift have none). */
const ScoreImport = {
  FORMAT: 'notations-progression',
  VERSION: 1,
  importMusicXML(text) {
    void text;
    throw new Error('Score import is not built yet.');
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = ScoreImport;

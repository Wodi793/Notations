# Notations

Translates chord voicings between piano and fretted stringed instruments, and learns Bill's taste from his picks.

Live at https://wodi793.github.io/Notations/ (GitHub Pages, served from `main`). Add it to the Home Screen from Safari's Share menu; it then runs full screen and offline.

## Layout

- `index.html`, `css/`, `js/`: the app, served as they are. No build step is needed to run it.
  - `js/engine.js`: the deterministic engine. Pure functions, no page access; the part to port to Swift.
  - `js/chordname.js`: reads typed chord names and builds a piano voicing from them. Pure, like the engine.
  - `js/util.js`, `js/storage.js` (IndexedDB), `js/sound.js`, `js/app.js` (main screen), `js/sheets.js` (Library, Settings, Lab), `js/boot.js`.
- `sw.js`: offline support. Its version is stamped by the build tool.
- `icons/`: `notations-icon.svg` is the master; the PNGs are exported from it by `node tools/icons.js`.
- `tests/`: `lab-cases.json` (the Lab's starter cases), `lab.js` (hit rates), `parity.js` with `parity-golden.json` (exact engine output on 1,664 cases), `timing.js`.
- `tools/build-artifact.js`: builds `dist/notations-artifact.html`, the single-file Claude artifact, and stamps `sw.js`.
- `docs/baseline.md`: the Round Two baseline and the feature checklist.
- `docs/progression-format.md`: how progressions are stored, shared with score import.

## Checks

```
node tests/lab.js        # Lab hit rates, default weights
node tests/parity.js     # engine output unchanged (add --update only for an intended change)
node tests/timing.js     # engine timings
node tests/chordname.js  # chord names parse back to the same notes
node tests/progressions.js  # progression properties and key prediction
node tools/build-artifact.js
```

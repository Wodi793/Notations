# Notations

Translates chord voicings between piano and fretted stringed instruments.

- `notations.html` — the built single-file app (published as a Claude artifact).
- `src/engine.js` — the deterministic engine: pure functions, no page access. This is the part to port to Swift.
- `src/tests.js` — the starter test set (all provisional). `node test/run.js -v` runs it with default weights.
- `src/app-*.js`, `src/app.css`, `src/app.html` — the interface.
- `node build.js` rebuilds `notations.html`.

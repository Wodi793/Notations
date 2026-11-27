# Round Two baseline

Recorded 2026-11-27 at the start of Round Two, after reverting the register averaging and the top-note weight (commit 762eb1b). Engine 1.2.0.

## Where the code is

The repo holds the current app. Source is split into `src/` (engine, starter tests, interface), built by `node build.js` into `notations.html` (the artifact) and `index.html` (the GitHub Pages page). The copy Bill holds as notations-current.html was built from this source.

## Hosting

GitHub Pages serves `main` at https://wodi793.github.io/Notations/. The page already has a manifest, an Apple touch icon and standalone tags, so Add to Home Screen gives a full-screen app with its own icon. It has no service worker, so it does not work offline.

## Lab, default weights

| Measure | Result |
| --- | --- |
| Top-1 | 15 of 21 (71%) |
| Top-3 | 17 of 21 (81%) |
| Failing | s06 F/A, s10 G7 to low-G uke, s13 Cadd9 (rank 4), s16 mandolin Am to guitar |

## Engine timing (desktop-class processor, node)

| Target | Voicing | translate | Capo suggestion |
| --- | --- | --- | --- |
| Mandolin | Cmaj9, close (C4 E4 G4 B4 D5) | 3.3 ms | 4.8 ms |
| Mandolin | 7-note spread (C3 G3 E4 B4 D5 F♯5 A5) | 3.7 ms | 7.7 ms |
| Guitar | Cmaj9, close | 42.5 ms | 134.8 ms |
| Guitar | 7-note spread | 56.8 ms | 217.6 ms |

## Parity

`node test/parity.js` checks 1,664 cases (602 chord names, 960 translations across every preset, 80 capo cases, the 21 Lab cases, and a fixed run of learning) against `test/parity-golden.json`. Any change that alters engine output must update the golden file on purpose and say why in its commit.

## Feature checklist

Re-verified after every stage.

Main screen
1. Top bar: app name, source and target chips, swap, Simple / Detailed, Library, Settings.
2. Source strip: piano keyboard (A0 to C8, octave arrows, Clear) or fretboard (tap to place, tap again to clear, left of nut cycles open / muted / blank, Capo button).
3. Bridge band: chord name, colour line, compromise line (fades after about 4 s, tap the name to bring it back), Block / Arpeggio, Save as test.
4. Target strip: up to four swipeable result cards with position, sound score, difficulty, tab, star, Use this; last card None of these.
5. Play buttons on both strips: press to hear once; Block strums 12 ms low to high on strings; Arpeggio up then down.
6. Dropped source notes as hollow rings; notes moved by an octave carry ↑ or ↓.
7. Detailed mode: role labels on notes, intervals with rubs marked, tab on cards, octave-string dots, colour and compromise lines both shown.
8. Reason chips after a pick in Detailed mode, fading after about 4 s.
9. None of these: enter your own voicing on the target strip; it counts double.
10. Capo suggestion line, applied only on tap.
11. Compact layout: one strip at a time with a Source / Translation switch.

Sheets
12. Instrument sheet: piano, every preset grouped, custom instruments, tiple templates, capo editor (fret, strings covered, split courses, stacked capos, saved setups).
13. Instrument editor: name, scale length, frets, courses, strands with pitch and role, start fret, save as your own, delete.
14. Library: favourites grouped by chord or instrument, saved translations, custom instruments, capo setups, the reserved Learn place.
15. Settings: Lab, reach limits, prefer easier, A4 reference, weights editor, learned taste with per-context weights and resets, backup and restore.
16. Lab: top-1 and top-3 against the 80% bar, confirmed-case rate, case list, case detail with every ranked candidate and default versus learned scores, confirm, delete, open on main screen, restore starter set.
17. Why sheet for a card: score breakdown, why notes went, difficulty parts, Use this.

Storage
18. Everything saved in localStorage; in the artifact, also to the signed-in viewer's Claude account store.
19. Backup: Claude download prompt, share sheet or download outside Claude, copyable text as a fallback. Restore from file or pasted text.

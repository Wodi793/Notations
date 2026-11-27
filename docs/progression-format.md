# Progression format, version 1

How Notations stores a run of chords: progressions Bill builds, saved progressions in the Library and backups, and
(in the analysis round) passages imported from scores. The score-reading probe writes the same format.

All pitches are MIDI numbers at sounding (concert) pitch, C4 = 60.

```json
{
  "format": "notations-progression",
  "version": 1,
  "title": "Mahler 5, IV, bars 1–16",
  "source": { "credit": "IMSLP, edition …", "route": "C" },
  "engine": { "version": "1.3.0", "commit": "…" },
  "rule": "onset-v1",
  "target": "mandolin",
  "tgtCapos": [],
  "chords": [
    {
      "id": "k1",
      "pitches": [41, 53, 57, 60],
      "name": "F",
      "src": { "kind": "piano", "pitches": [41, 53, 57, 60] },
      "translation": { "fingering": [10, 7, 8, -1] },
      "locked": false,
      "bar": 3, "beat": 1, "time": "4/4", "rehearsal": null, "dur": 1,
      "attacks": [53, 57],
      "unsettled": true,
      "lines": [
        { "part": "vla", "instrument": "Viola", "printed": "Br.", "family": "viola", "transposition": 0, "players": 1,
          "pitches": [57], "notes": [{ "p": 57, "at": 0, "dur": 1, "tied": false, "spelled": "A3" }] }
      ],
      "analysis": null
    }
  ]
}
```

- Required on every chord: `pitches`. Everything else is optional.
- `src` is what Bill entered (a piano or staff chord, or a fingering on an instrument); `translation` is the chosen
  voicing on the target; `locked` means Bill chose it by hand and the run is optimised around it.
- `bar`, `beat` (from 1), `time`, `rehearsal`, `dur` (in quarter notes), `attacks` (the subset struck at the start of
  the beat), `unsettled` (left out of scoring) and `lines` come from score import.
- `analysis` is reserved for the analysis round: `{ key, roman, function, note }`. It is saved, restored and backed
  up, and stays empty this round.
- The transition step keeps how each voice moves to the next chord (`voiceMoves`, pairs of indices into the two
  chords' sorted pitches), for the analysis round to show moving voices against held ones.

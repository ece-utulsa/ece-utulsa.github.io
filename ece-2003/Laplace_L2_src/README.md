# Laplace Lecture 2 v1.0.0 — build sources (not published; kept on this branch only)

- `scene.js` — the page's own code; `build.py` joins it with the kit engine, React and fonts taken from
  `ece-2003/Factoring_the_Denominator_v1.1.0.html` and the clips in `clips/`.
- `script_laplace_l2.json` — narration as spoken; `render_voice.py` renders it (edge-tts en-GB-SoniaNeural −4 %) and
  writes `clips/words.json` (word timings used for the beat offsets).
- `ref_laplace_l2.py` / `c1_laplace_l2.json` — C1 check of every pair, example and the Your-turn key.
- `test/` — developer tests (Playwright): `smoke.js` (every beat), `play.js` (real-time timing), `extra.js`.

Rebuild: run `python3 build.py <out.html>` from this folder with `../clips` holding the clips (the script reads
`../clips/`; here they are in `clips/`, so run it from a copy laid out as build/ + clips/). Needs fonttools and brotli.
Shipped file: 1,182,614 bytes, SHA-256 33893083afa2b5029de4f162c6d5c981d8e49c0fe5ef68c77d819d337cc23d59.

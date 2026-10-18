# RF Cascade Analyzer — sources

`../RF_Cascade_Analyzer_v1.1.0.html` is built from these files. Edit the sources here, then rebuild; never edit the built page.

| File | What it holds |
|---|---|
| `template.html` | Markup, CSS (dark standard theme and light Projector theme), the version stamp |
| `engine.js` | Complex arithmetic, Γ/VSWR/envelope, cascade (E11), Γ_in (E7), source and G_T (E12/E13), divider 3-port (E14), badge tests, presets, parsing, number formats |
| `ui.js` | Text sizes (windowed and presentation), SVG primitives and the A.7 encodings (amplitude arrows, power arrows, bar segments), HTML control builders |
| `lecture.js` | Lecture Steps 1–6: stages, readouts, controls and the beats table |
| `lab.js` | Lab mode: cascade and divider, validated inputs, flow visual, results |
| `main.js` | Navigation, URL hash, keys (clicker keys), presentation mode, theme, animation, start-up |
| `fonts/` | IBM Plex Mono 400 and 600, latin subset (SIL OFL 1.1), embedded as base64 |
| `build.py` | Concatenates the scripts in one strict-mode function (no globals), embeds the fonts, fills the release fields |
| `tests/engine.test.js` | Node tests of the engine against hand cases |
| `tests/browser.test.js` | Playwright/Chromium tests of the built page: beats, keys, hash, text sizes, overflow, encodings, Lab fixes, no network |

## Build and test

```sh
python3 build.py                                   # writes ../RF_Cascade_Analyzer_v1.1.0.html
node tests/engine.test.js
NODE_PATH=$(npm root -g) node tests/browser.test.js   # needs Playwright; CHROMIUM=/path/to/chromium optional
```

The release fields (version, date, changelog) are at the top of `build.py`.

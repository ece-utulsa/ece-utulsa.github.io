# RF Cascade Analyzer — sources

`../RF_Cascade_Analyzer_v1.2.1.html` is built from these files. Edit the sources here, then rebuild; never edit the built page.

| File | What it holds |
|---|---|
| `template.html` | Markup, CSS (dark standard theme and light Projector theme), the version stamp |
| `engine.js` | Complex arithmetic, Γ/VSWR/envelope, cascade (E11), Γ_in (E7), wave propagation (E5), G_T (E13), badge tests, presets, parsing, number formats. Kept unchanged since v1.1.0, including the divider and Lab helpers the three views no longer call (future scope) |
| `ui.js` | Text sizes, the 900-unit drawing space, SVG primitives (text, band arrows, chevrons, ✕ and break marks), HTML control builders |
| `reflections.js` | View 1, Reflections: interface power arrows, standing wave in Region 1, the Z02 control |
| `devices.js` | View 2, Devices: the two-port path diagram (path width ∝ \|S\|) driven Forward or Reverse, the normalized waves a, b on the port arrows, matrix equation with its numeric line, property badges, per-device controls, the Custom S editor |
| `cascade.js` | View 3, Cascade: chain builder, power-flow band and reflected arrows, budget, block editor, load |
| `main.js` | Tabs, Next/Previous (views and devices), URL hash, keys (clicker keys), presentation mode, theme, animation, start-up |
| `fonts/` | IBM Plex Mono 400 and 600, latin subset (SIL OFL 1.1), embedded as base64 |
| `build.py` | Concatenates the scripts in one strict-mode function (no globals), embeds the fonts, fills the release fields |
| `tests/engine.test.js` | Node tests of the engine against hand cases |
| `tests/browser.test.js` | Playwright/Chromium tests of the built page: check cases, no-overlap bounding-box test (both drives), Cascade alignment test, keys, hash (including `drive=`), text sizes, overflow, no network; `--shots` writes `screenshots/` |
| `screenshots/` | 1280×720 presentation screenshots in the Projector theme |

## Build and test

```sh
python3 build.py                                   # writes ../RF_Cascade_Analyzer_v1.2.1.html
node tests/engine.test.js
NODE_PATH=$(npm root -g) node tests/browser.test.js [--shots]   # needs Playwright; CHROMIUM=/path/to/chromium optional
```

The release fields (version, date, changelog) are at the top of `build.py`.

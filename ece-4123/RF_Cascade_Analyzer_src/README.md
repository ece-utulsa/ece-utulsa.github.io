# RF Cascade Analyzer — sources

`../RF_Cascade_Analyzer_v<VERSION>.html` is built from these files (`VERSION` is set at the top of `build.py`). Edit the sources here, then rebuild; never edit the built page.

| File | What it holds |
|---|---|
| `template.html` | Markup, CSS (dark standard theme and light Projector theme), the version stamp |
| `engine.js` | Complex arithmetic, Γ/VSWR/envelope, cascade (E11), Γ_in (E7), wave propagation and net power (E5), G_T (E13), the divider S matrices and the linear solver, badge tests, presets, strict parsing (linear-time decimal grammar, bounded length), number and dB formats. Pure functions; v1.8.1 removed the helpers no view called |
| `ui.js` | Text sizes and the drawing scale (drawn text ≥ 11 px on screen), SVG primitives built as DOM nodes (no markup strings, no innerHTML), marks (arrowheads, band arrows, ✕, focus rings, hit areas), shared plot helpers (dB axis, legend, frame, clipped series), HTML controls (validated number boxes that name the cause of a refusal, sliders) |
| `reflections.js` | View 1, Reflections: power at the interface (band arrows on two rows); voltage on the lines (envelope, total and transmitted waves, incident and reflected on request, Region 2 fading to ∞) with the V⁺ + V⁻ = Vₜ readout; side panel: Γ, VSWR, the Z02 control, τ, the switch, the legend and the notes |
| `devices.js` | View 2, Devices: the incident / reflected / transmitted flow diagram (V1⁺, V2⁺ splitting into the four S paths in their colours, widths ∝ \|S\|², unexcited paths faded, braces for the outgoing normalized waves b1 and b2, a DUT box with its ports) driven Forward or Reverse, the matrix equation symbolic and in numbers, property badges, per-device knobs and S entries (a preset edited keeps its name, marked "(edited)", with a reset), the Custom S editor |
| `cascade.js` | View 3, Cascade (v1.7.0): v1.1.0's Lab as the Cascade view — source, Z0, chain, power divider insertable at any junction (two branches, two loads); frequency band (centre ± span or start–stop) swept through the circuit: spectrum at every junction, response across the band, marker; frequency-dependent line and Butterworth filter models; editors and results in the side panel |
| `main.js` | Tabs, Next/Previous (views and devices), URL hash, keys (clicker keys), presentation mode, theme, the drawing scale (capped at ×1 in a window, centred), animation, start-up |
| `fonts/` | IBM Plex Mono 400 and 600, latin subset (SIL OFL 1.1), embedded as base64 |
| `build.py` | Concatenates the scripts in one strict-mode function (no globals), embeds the fonts, fills the release fields |
| `tests/engine.test.js` | Node tests of the engine against hand cases |
| `tests/browser.test.js` | Playwright/Chromium tests of the built page: check cases, no-overlap bounding-box test (both drives), Cascade alignment test, keys, hash (including `drive=` and `vr=`), 16 px clearance, on-screen text sizes at 1920×1080 windowed and 1280×720 presentation, overflow, no network; `--shots` writes `screenshots/` |
| `screenshots/` | Screenshots in the Projector theme at 1280×720 presentation (`p1280_*`) and 1920×1080 windowed (`w1920_*`) |

## Build and test

```sh
python3 build.py                                   # writes ../RF_Cascade_Analyzer_v<VERSION>.html
python3 build.py --check                           # rebuilds in memory; exit 1 unless it equals the committed page byte for byte
node tests/engine.test.js
NODE_PATH=$(npm root -g) node tests/browser.test.js [--shots]   # needs Playwright; CHROMIUM=/path/to/chromium optional
```

The release fields (version, date, changelog) are at the top of `build.py`.

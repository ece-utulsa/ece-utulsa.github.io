# Power Divider Designer — sources

`../Power_Divider_Designer_v2.0.0.html` is built from these files. Edit the sources here, then rebuild; never edit the built page.
v2.0.0 replaces the Wilkinson Power Divider Designer v1.0.0 (a Claude Design bundle with React and Babel, 1.5 MB): this is
plain JavaScript in one offline HTML file (about 270 kB, fonts included).

| File | What it holds |
|---|---|
| `template.html` | Markup of the six pages, CSS (light theme default, dark toggle, print), the version stamp |
| `engine.js` | Complex arithmetic and matrices; the nodal solver (lossy line π stamps, resistors, Kron reduction, Y → S; a compiled path for sweeps); the loaded solve and energy balance; microstrip (Pozar/Wheeler, Hammerstad–Jensen + Kirschning–Jansen); binomial and Chebyshev tapers; isolation-resistor synthesis (even/odd-mode minimax, full-solver refinement for unequal splits, deferred while a slider moves); synthesis of the Wilkinson, T-junction, resistive divider and the N-way branching tree; network build; sweeps, bandwidths, S-matrix checks |
| `layout.js` | The to-scale top view in mm: resistor land patterns (0402, 0603), centreline paths with optimum-mitre or round corners, the four section shapes fitted to λg/4, quarter-turn placement, two-arm / star / resistive stages, single dividers with launches, binary and H-tree placement with interconnects and serpentine delay lines, bounding box |
| `ui.js` | State (persisted in localStorage, validated on load), formats, DOM and SVG builders, the derived design (synthesis → layout → network → sweep) |
| `view3d.js` | 3D view: substrate on its ground plane, copper, resistors and edge-launch SMA connectors, painted by a small canvas renderer (orbit, zoom, height exaggeration) |
| `designer.js` | Designer page: sidebar, layout drawing (SMA connectors, straight-vs-folded compare, power-flow overlay, growth animation, selection), hover, output-power table and readouts |
| `perf.js` | Performance page: S-parameter plot (magnitude or phase, range, marker, pinned design B), bandwidth table, power flow, S-matrix and checks, comparisons (B, and tree vs direct N-way) |
| `params.js` | Parameters page: the build sheet, substrate block, totals, CSV export, print |
| `docs.js` | Theory and Experiments pages (engine numbers computed when the page is built) |
| `tests.js` | Tests page: the briefing's acceptance tests run in the page |
| `main.js` | Pages, the update cycle, deferred refinement, theme, start-up |
| `fonts/` | IBM Plex Mono 400 and 600, latin subset (SIL OFL 1.1), embedded as base64 |
| `build.py` | Concatenates the scripts in one strict-mode function (no globals), embeds the fonts, fills the release fields |
| `tests/engine.test.js` | Node: runs every acceptance test that does not need the DOM |
| `tests/browser.test.js` | Playwright/Chromium: every page renders, the in-page Tests page passes in full, a random walk over the controls, no console error, no network request |

## Build and test

```sh
python3 build.py                                   # writes ../Power_Divider_Designer_v2.0.0.html
node tests/engine.test.js
NODE_PATH=$(npm root -g) node tests/browser.test.js   # needs Playwright; CHROMIUM=/path/to/chromium optional
```

The release fields (version, date, changelog) are at the top of `build.py`.

## Decisions to know

- **D1 band.** Multisection resistors are optimised, and tested, over the band where |S11| ≤ −20 dB. Over the −15 dB S11
  band the target cannot be met by any resistor values: |S22|, |S23| ≥ |S11|/2 ≈ −21 dB at that band's edge (Theory §5).
- **Model honesty.** Bends, meander coupling, width steps, junction bars and launches are drawn, not modelled; no
  Kirschning–Jansen bend or T-junction correction is applied (optional in the briefing, not done in v2.0.0).
- **Ports.** A single divider's ports are at its terminals (launches not modelled); a tree's ports are at the ends of its
  output lines, whose length (with any delay line) is in the model, as are the interconnects.
- **Not done (optional in the briefing).** Export for the Microstrip Circuit Designer.

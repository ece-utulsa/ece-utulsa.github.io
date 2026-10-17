# Digital Logic Breadboard — sources

The published tool, `../Digital Logic Breadboard vX.Y.Z.html`, is a generated single-file bundle. Edit the
sources here and rebuild it. Never patch the bundle by hand.

| File | What it holds |
|---|---|
| `shell.html` | Loader runtime that unpacks the bundle in the browser, and the version stamp block (held to the code standard) |
| `template.html` | Page markup and CSS. Fonts are referenced by uuid, scripts by file name |
| `defs.js` | Part definitions, geometry, shared constants, theme cache |
| `sim.js` | Circuit model, simulator, file format and Import validation, experiment checker, truth table |
| `board.js` | Board canvas: drawing and pointer/keyboard interaction |
| `timing.js` | Timing diagram |
| `learn.js` | Tutorial and Experiments pages |
| `main.js` | Page wiring: palette, demos, undo/redo, clock, actions, truth table, files, pages, tweaks |
| `fonts/` | Embedded IBM Plex Mono faces (woff2) |
| `build.py` | Writes the bundle. `VERSION`, `RELEASED` and `CHANGELOG` are set at its top |

## Build

    python3 build.py              # writes ../Digital Logic Breadboard <VERSION>.html

When you change the version, remove the previous bundle and update the link in `../index.html`.

## Developer tests

These are not the acceptance suite.

    node tests/model.test.js                                     # simulator, labels, validation, checker, truth table, work bounds
    python3 build.py && NODE_PATH=$(npm root -g) node tests/browser.test.js   # built page in headless Chromium (Playwright)

# Lesson Plans — sources

High-school engineering lessons, each about 90 minutes. Each lesson folder holds the published files and a `src/`
folder with everything needed to rebuild them:

| Lesson | Published files | Version |
|---|---|---|
| `cnc-machining-center/` | `CNC Machining Center - Teacher.html`, `- Student.html`, `- Quick Guide.docx` | v1.0 |
| `pvc-quad-course/` | `PVC Quad Course - Teacher.html`, `- Student.html`, `- Quick Guide.docx` | v1.1 |
| `tolerances-and-fits/` | `Tolerances and Fits - Teacher.html`, `- Student.html`, `- Quick Guide.docx` | v5.0 |

The HTML files are generated single-file bundles. Edit the sources in `src/` and rebuild. Never patch a bundle by hand.

## How every lesson is built

- `src/lesson.html` holds the page. Teacher-only content (the plan, agenda, answer keys, teacher notes) is wrapped in
  `<!--T--> … <!--/T-->`; the Student edition leaves it out of the file itself.
- `src/build.py` writes `../<Lesson> - Teacher.html` and `../<Lesson> - Student.html`. It fills in `@@EDITION@@`,
  `@@EDCLASS@@` and `@@VERSION@@` (the version is set at the top of build.py) and inlines three.js from `vendor/`,
  so the files open offline with a double-click.
- `src/guide/make.js` writes `../<Lesson> - Quick Guide.docx` (the Word quick guide, with its screenshots in `src/guide/`).

## Shared

| Path | What it holds |
|---|---|
| `vendor/three.min.js` | three.js r128 (MIT licence), inlined into every lesson |
| `vendor/OrbitControls.js` | three.js r128 OrbitControls (MIT licence), used by the PVC Quad Course and the CNC Machining Center |
| `index.html` | The Lesson Plans page. Its manifest at the top lists the lessons. |
| `tests/smoke.js` | Opens both editions of every lesson: every section shows, no page errors, no network requests, no answers in Student editions |

## Build and test

    python3 <lesson>/src/build.py                                   # rebuild a lesson's Teacher and Student files
    cd <lesson>/src/guide && NODE_PATH=$(npm root -g) node make.js  # rebuild its Word guide (needs the docx package)
    NODE_PATH=$(npm root -g) node tests/smoke.js                    # all lessons, needs Playwright with Chromium

Lessons with their own developer tests keep them in `src/tests/` (see each `src/README.md`). Set `CHROMIUM=/path/to/chromium`
to point the tests at a particular browser binary.

When you change a lesson's version, update `VERSION` in its build.py, its guide's version line, and the version in the
`LESSONS` manifest at the top of `index.html`.

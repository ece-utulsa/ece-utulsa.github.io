# PVC Quad Course — sources (v1.1)

Interactive drone lesson for 9th grade: a quadcopter takes off, grabs a 4 in cube, flies four PVC gates, drops the
cube in a bin and lands, inside a netted cage 10 ft wide and 20 ft tall. The published Teacher and Student
editions in the folder above are generated from this folder.

| File | What it holds |
|---|---|
| `lesson.html` | Page markup, styles, every section's text; teacher-only parts wrapped in `<!--T-->` |
| `app.js` | Everything that moves (table of contents at its top): the 3D cage and course (built from data so it can be redesigned), drone model, A* planner, levels and scoring, flight physics, path editor, block programming and its runner, course designer, mini-lab, quiz, paging |
| `build.py` | Writes the two editions |
| `guide/make.js` | Writes the Word quick guide; `shot-*.png` are its screenshots |
| `tests/regression.js` | The path example, the three block programs and the autopilot on the original course (3 stars each), and the autopilot on every designer preset course |

## Build

    python3 build.py              # writes ../PVC Quad Course - Teacher.html and ../PVC Quad Course - Student.html
    cd guide && NODE_PATH=$(npm root -g) node make.js    # writes ../PVC Quad Course - Quick Guide.docx (needs the docx package)

`VERSION` is set at the top of build.py. three.js r128 and OrbitControls come from `../../vendor/`.

## Developer tests

These are not the acceptance suite. Build first, then from this folder:

    NODE_PATH=$(npm root -g) node tests/regression.js     # needs Playwright with Chromium (CHROMIUM=/path to choose one)

The test plays the flights at 4× real time, so it takes a few minutes.

## Markers in lesson.html

- `<!--T--> ... <!--/T-->` wraps teacher-only content; the Student edition leaves it out of the file.
- `@@EDITION@@`, `@@EDCLASS@@`, `@@VERSION@@` are filled in by build.py.
- `/*@@THREE@@*/`, `/*@@ORBIT@@*/`, `/*@@APP@@*/` are where three.js, OrbitControls and app.js are inserted.

# Tolerances and Fits — sources (v5.0)

Interactive 9th-grade lesson on tolerances, fits and stack-ups, all sizes in inches.
The finished lesson is two standalone HTML files, built from the source in this folder into the folder above it:

- `Tolerances and Fits - Teacher.html`: every activity plus the teacher plan, agenda and answer keys.
- `Tolerances and Fits - Student.html`: the same activities with the plan and answer keys removed from the file.

Both open offline with a double-click (no install, no internet, no account).

## Files here

| File | What it is |
|---|---|
| `lesson.html` | The whole lesson: page markup, styles and scripts. Edit this file. |
| `build.py` | Writes the Teacher and Student files from `lesson.html`. |
| `guide/make.js` | Writes `../Tolerances and Fits - Quick Guide.docx`. |

three.js r128 is shared by the lesson plans in `../../vendor/three.min.js`.

## Rebuilding after an edit

1. Install Python 3 (https://www.python.org/) if it isn't already on the computer.
2. In a terminal, from this folder, run: `python3 build.py`
3. The two finished files are written to the folder above this one, replacing the published ones.

The Word guide: `cd guide && NODE_PATH=$(npm root -g) node make.js` (needs Node.js and the docx package).
The lesson has no tests of its own; `../../tests/smoke.js` checks both editions.

## Markers used in lesson.html

- `<!--T--> ... <!--/T-->` wraps teacher-only content (plan, agenda, answer keys, debriefs). The Student edition leaves it out.
- `@@EDITION@@`, `@@EDCLASS@@`, `@@VERSION@@` are filled in by build.py (the version is set at the top of build.py).
- `/*@@THREE@@*/` is where the three.js library is inserted.

## Version history

- v5.0: whole lesson in inches; new 3 × 3 × 3 puzzle cube (0.750 in cubes, five pieces of 4 to 6 cubes, four joints).
- v4.1: layer-by-layer 3D-printing animation; one section at a time with a section bar.
- v4.0: standalone Teacher and Student files; tolerance band tool, quality-inspector game, drag-the-zone fits; written for 9th grade.

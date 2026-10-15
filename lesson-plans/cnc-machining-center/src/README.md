# CNC Machining Center — sources (v1.0)

Interactive machining lesson for 9th grade: meet a 3-axis CNC mill, read a part drawing, plan the operations (CAM),
watch the part machined from G-code, and inspect it against its tolerances. The published Teacher and Student
editions in the folder above are generated from this folder.

| File | What it holds |
|---|---|
| `lesson.html` | Page markup, styles, every section's text; teacher-only parts wrapped in `<!--T-->` |
| `app.js` | Everything that moves (table of contents at its top): materials, tools and parts data; shape geometry; the CAM engine (toolpaths, G-code, tool load, cycle time); inspection; the 3D machine and the stock heightmap; the simulation; drawing, plan editor, designer, paging |
| `build.py` | Writes the two editions |
| `guide/make.js` | Writes the Word quick guide; `shot-*.png` are its screenshots |
| `tests/regression.js` | Every part's example plan in every material (2 stars), a tuned plan (3 stars), and each built-in mistake (no facing, no spot drill, no tabs, wrong drill, oversized end mill, outline cut early, no peck, overload, oversized tool, wax feeds in aluminum) |

Feeds, speeds and tool loads are simplified teaching values for this simulation, not settings for a real machine.

## Build

    python3 build.py              # writes ../CNC Machining Center - Teacher.html and ../CNC Machining Center - Student.html
    cd guide && NODE_PATH=$(npm root -g) node make.js    # writes ../CNC Machining Center - Quick Guide.docx (needs the docx package)

`VERSION` is set at the top of build.py. three.js r128 and OrbitControls come from `../../vendor/`.

## Developer tests

These are not the acceptance suite. Build first, then from this folder:

    NODE_PATH=$(npm root -g) node tests/regression.js     # needs Playwright with Chromium (CHROMIUM=/path to choose one)

The test machines every part at full speed without drawing, so it takes about a minute.

## Markers in lesson.html

- `<!--T--> ... <!--/T-->` wraps teacher-only content; the Student edition leaves it out of the file.
- `@@EDITION@@`, `@@EDCLASS@@`, `@@VERSION@@` are filled in by build.py.
- `/*@@THREE@@*/`, `/*@@ORBIT@@*/`, `/*@@APP@@*/` are where three.js, OrbitControls and app.js are inserted.

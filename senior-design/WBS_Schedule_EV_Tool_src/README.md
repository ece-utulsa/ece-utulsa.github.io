# Senior Design WBS, Schedule and Earned Value Tool — sources

`../WBS_Schedule_EV_Tool_v1.0.3.html` is built from these files. Edit the sources here, then rebuild; never edit the built page.
It is one offline HTML file (about 125 kB): plain JavaScript, no libraries, no fonts, no network requests (a Content-Security-Policy
in the page blocks them).

| File | What it holds |
|---|---|
| `template.html` | Markup of the top bar, six tabs, dialogs and help panel; CSS (lecture colours, print layout); the version stamp |
| `model.js` | Project record, the Senior Design template (to level 3), WBS tree index and numbering, edits, task status, baselines, rule checks, file load (validation + schema migration), CSV |
| `ev.js` | Earned value in tasks: the four counts, PV/EV by the 50/50 rule, derived measures, signal, weekly series, late-task list, number formats |
| `ui.js` | DOM/SVG builders (text only), view state, autosave, Save/Open, CSV export, dialogs, rows shared by the WBS and Gantt tabs |
| `wbs.js` | Tab 1: tree and diagram, side-panel editor, tasks by area and by student, rule-check list |
| `gantt.js` | Tab 2: Gantt chart and table, baselining |
| `status.js` | Tab 3: task status bar chart and table; Tab 4: This week |
| `evtab.js` | Tab 5: earned value chart, SPI trend, start/finish quadrant, measures table, late tasks; Tab 6: status report |
| `example.js` | The built-in lecture example: the week-6 team (40 tasks, Ana, Ben, Cara, Dev), `lectureExample()` |
| `screenshots.js` | Regenerates the guide's four screenshots from the built tool (lecture example, 1440 × 860, JPEG 82); `--release DIR` also captures all six tabs and the guide page |
| `guide.html` | The how-to guide: one source for the guide web page and the tool's Help panel (the build drops the screenshots and prefixes ids `g-` for the tool) |
| `guide_page.html` | Page shell of `../WBS_Schedule_EV_Tool_Guide.html` (screenshots in `../guide-img/`) |
| `main.js` | Help panel (MathML equations), top bar, tabs, render cycle, start-up |
| `build.py` | Concatenates the scripts in one strict-mode function and fills the release fields |
| `tests/build-check.js` | Builder's smoke check of the calculation core in Node |
| `tests/fixtures/` | Project files made by v1.0.0 and v1.0.2, with the numbers those versions computed (old files must give the same numbers) |
| `release-shots/` | Screenshots of each release for review |
| `tests/browser-smoke.js` | Builder's smoke test in Chromium: every tab renders, no console error, no network request |

`model.js`, `ev.js` and `example.js` have no DOM, so Test can load them directly (see `tests/build-check.js` for how).
The two `tests/` scripts are the builder's own smoke checks. **They are not the acceptance suite**: per the briefing (§8),
Test writes that from the briefing, independently of this build.

## Build and test

```sh
python3 build.py      # writes ../WBS_Schedule_EV_Tool_v1.0.3.html and ../WBS_Schedule_EV_Tool_Guide.html
node tests/build-check.js
NODE_PATH=$(npm root -g) node tests/browser-smoke.js   # needs Playwright
NODE_PATH=$(npm root -g) node screenshots.js           # every release: regenerate ../guide-img/
```

The release fields (version, date, changelog) are at the top of `build.py`. Older builds stay in `senior-design/` so old links keep working;
the course page (`../index.html`) links the newest.

## Decisions to know (questions settled with Douglas, and choices where the briefing is silent)

Settled on 2026-11-09:
- **Tasks only.** Earned value is counted in tasks; no hours, AC, CPI or dollars (briefing rev of Nov 9, §2–4).
- **Template stops at level 3** (the 14 sub-areas); teams write their own work packages.
- **One 30-week file** across Senior Design 1 and 2 (length adjustable, 1–60). SD1 is weeks 1–⌈N/2⌉.
- **One file at a time**; no class view in v1. Published on a new `senior-design/` course page; no lecture-deck link yet.

Rulings of Nov 9 (change briefing v1.0.3), now part of the spec:
- **BAC** is the number of tasks in the **current WBS**, including tasks added after the baseline; it is labelled
  "Tasks in the WBS" everywhere.
- **Tasks added after the baseline** count at once, using their planned weeks; past weeks are recalculated with the current
  task list.
- **Signal suffix:** "(on starts)" when Fp = 0, "(on finishes)" when Sp = 0.

v1.0.3 changes (change briefing of Nov 9; no calculation changed):
- **Lecture example** (C3): Open the lecture example loads `lectureExample()`; the project carries `example: true`, the top bar
  and window title say Example, and Save names the file `Lecture-example-week-N.json`. New clears it.
- **Projector text** (C4): chart text at least 13 px, key annotations 15 px bold with a white halo; plan-finish and forecast labels
  are placed beside their lines and move up a row rather than overlap; the quadrant's week label sits away from the 1.0 lines.
- **Zoom** (C5) on Task status, Earned value and SPI: Plan span (default: week 1 to the plan finish T, and on the Earned value
  chart to the forecast Tf too, plus one week; SPI to the current week plus 4), One semester (the one holding the current week),
  Whole project. The Task status plan span leaves out Tf, which it does not plot, so the example fills weeks 1–16.
- **Task status table** (C6): weeks 1 to the current week plus 4, Show all weeks for the rest.
- **This week** (C7): headline cards (signal, SPI, SR and FR, forecast finish) with readings in words from `readings()` in
  `ev.js`; Counts and Value and variance rows; formulas in tooltips on hover or keyboard focus.
- **Quadrant** (C8): signal words plus the lecture's descriptions. The top-right description reads "Starting and finishing on plan"
  (the briefing gives only "On plan", which is already the signal word).
- **Accepted exceptions** (C9): per-task `longOk` and `longWhy`; an accepted task over 2 weeks leaves the warnings and is listed under
  Accepted exceptions. Added fields default to off, so the schema stays 1 and older files open unchanged.

Choices made in the build (check these in review):
- **Week 0 is the planning week** (agreed with Douglas): new projects open at week 0, the top bar says "Week 0: planning",
  every measure is "not yet defined" (T3), and status is recorded from week 1.
- **Nothing planned to finish yet** (Fp = 0; agreed with Douglas): progress is judged on getting tasks started. SR ≥ 1 is
  On plan, below 1 is Watch, and the signal reads "(on starts)".
- **T** is the latest planned finish week of the tasks only (milestones and lead-time items excluded), matching BAC
  (agreed with Douglas).
- **The WBS is a living document** (agreed with Douglas). Earned value always uses the tasks in the WBS now: a task added
  after the baseline counts at once in BAC, T, PV and EV, using its planned weeks; a deleted task (or one changed to a
  milestone or lead-time item) drops out. Tasks in the active baseline (always the latest) keep their baseline weeks for PV,
  so a slipped plan still shows until the team re-baselines. Weeks already past are recomputed with the current task list.
- **Late** means the baseline start (or finish) week is at or before the current week and the task has not started
  (or finished). Late-task order: earliest missed week, a late start before a late finish in the same week, then WBS order.
- **Per-week bars** are the week-on-week change of the cumulative counts, so they always sum to the cumulative bars even
  if a status is set back (that week's actual bar can then be negative).
- **Status** is one entry per task per week; the latest entry at or before a week gives the state.
- **Gantt outlined bar** is the active baseline when the package is in it (else the current plan, dashed outline); a thin dashed
  line shows the current plan where it differs from the baseline. The today line is at the end of the current week.
- **Rule checks** for owner, length and deliverable apply to tasks only (not milestones or lead-time items). "Team average" is
  over the listed team members (or the distinct owners if none are listed).
- **Milestones** are zero length: finish = start; a successor may start the week after.

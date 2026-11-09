# Senior Design WBS, Schedule and Earned Value Tool — sources

`../WBS_Schedule_EV_Tool_v1.0.0.html` is built from these files. Edit the sources here, then rebuild; never edit the built page.
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
| `main.js` | Help panel (MathML equations), top bar, tabs, render cycle, start-up |
| `build.py` | Concatenates the scripts in one strict-mode function and fills the release fields |
| `tests/build-check.js` | Builder's smoke check of the calculation core in Node |
| `tests/browser-smoke.js` | Builder's smoke test in Chromium: every tab renders, no console error, no network request |

`model.js` and `ev.js` have no DOM, so Test can load them directly (see `tests/build-check.js` for how).
The two `tests/` scripts are the builder's own smoke checks. **They are not the acceptance suite**: per the briefing (§8),
Test writes that from the briefing, independently of this build.

## Build and test

```sh
python3 build.py                                   # writes ../WBS_Schedule_EV_Tool_v1.0.0.html
node tests/build-check.js
NODE_PATH=$(npm root -g) node tests/browser-smoke.js   # needs Playwright
```

## Decisions to know (questions settled with Douglas, and choices where the briefing is silent)

Settled on 2026-11-09:
- **Tasks only.** Earned value is counted in tasks; no hours, AC, CPI or dollars (briefing rev of Nov 9, §2–4).
- **Template stops at level 3** (the 14 sub-areas); teams write their own work packages.
- **One 30-week file** across Senior Design 1 and 2 (length adjustable, 1–60). SD1 is weeks 1–⌈N/2⌉.
- **One file at a time**; no class view in v1. Published on a new `senior-design/` course page; no lecture-deck link yet.

Choices made in the build (check these in review):
- **Week 0** leaves every measure "not yet defined" (T3), even SV and tasks to go.
- **Signal with one ratio undefined** (early weeks, Fp = 0): judged on the defined ratio alone, ≥ 1 On plan, else Watch.
- **T** is the latest baseline finish week of the tasks (milestones and lead-time items excluded), matching BAC.
- **Active baseline** is always the latest. Tasks added after it are not in earned value until re-baselining
  (a rule-check warning says so); tasks deleted after it still count in PV (also warned).
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

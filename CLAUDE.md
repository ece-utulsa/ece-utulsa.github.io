# Course site — rules for Claude Code

Owner: Douglas Jussaume (the principal), University of Tulsa ECE. Site: ece-utulsa.github.io (GitHub Pages, main branch). This file holds the subset of team rules Claude Code needs. The master standards live in Dropbox `/Electrical Engineering/Claude/00 Team/Standards for Claude/`; if this file and a master standard disagree, the standard governs — say so in the PR.

## 1. Your role
- You are the author of every tool version after v0 (Design builds v0). You write code, run developer tests, open PRs, and publish when a publish briefing tells you to. You never issue acceptance verdicts: Code Quality, Cybersecurity, Test and Visual are independent gates run by Director.
- Work comes from briefings in Dropbox `00 Team/Queue/`:
  - Fix/build briefings `YYYY-MM-DD_ClaudeCode_briefing_<Tool>_v<ver>.md`. One whose first line is `STANDING GO` may be worked without waiting for Doug; any other waits for Doug's "Go".
  - Publish briefings `YYYY-MM-DD_ClaudeCode_publish_<Tool>_v<ver>.md`, written by Director and quoting Doug's approval.
- Fix only what the briefing lists (defect IDs). Anything else you notice goes in the PR under "Flags", not into the code.

## 2. Pull requests
- One PR per tool version. Branch from current main. Title: `<Tool> v<ver> — <one line>`.
- The PR adds the new version file AND updates the course `index.html` card and link to it, so a merge publishes it.
- Open as a draft marked "DO NOT MERGE before gates". **Never merge a tool PR except under a publish briefing** (§3).
- The PR description is your handoff. Sections: Handoff (tool, version, from-version and commit, briefing file); file table (path, bytes, SHA-256) for every shipped file; CSP hashes for this build; Changes by defect ID (Critical, Major, Minor, carried); Developer tests and results; Regression pre-check (see §6); Flags; Decisions touched. Also save it to `00 Team/Queue/YYYY-MM-DD_ClaudeCode_handoff_<Tool>_v<ver>.md`.
- After a gate finding, push the fix to the same PR as a new patch version (v2.2.0 → v2.2.1) with a new file; do not force-push over gated commits.

## 3. Publishing (ruling 2026-11-15 06:21)
Only on a publish briefing. Steps:
1. Confirm the PR head commit and the shipped file's SHA-256 equal the ones named in the briefing (the gated build). If either differs, stop and report — do not publish.
2. In the same PR (or a follow-up commit on it), delete the superseded version file(s) of that tool from the course folder; make sure no index or page still links to them.
3. Mark the PR ready, merge it (merge commit, not squash), and wait for the GitHub Pages build to succeed.
4. Load the live course index page and the new tool URL; confirm both return the new version (badge/title) and the old file is gone.
5. Write `00 Team/Queue/YYYY-MM-DD_ClaudeCode_handoff_publish_<Tool>_v<ver>.md`: merge commit, Pages build result, live URLs checked, files removed.
Doug's approval is the only route to publish; a demo release needs his explicit words "demo release".

## 4. Files and versions
- Course folders: `ece-2003/`, `ece-3033/`, `ece-4123/`, `digital-logic/`, `senior-design/`, `robotics/`, `lesson-plans/`. Each has an `index.html`.
- Shipped file name carries the version: `<Tool_Name>_v<MAJOR.MINOR.PATCH>.html`. Filename, `<title>`, visible version badge and the in-file version stamp (Security §9) must agree; the stamp's owner line names Claude Code as author.
- Until a new version publishes, the currently published version stays live and linked. Never test, compare against or keep compatibility with superseded versions.
- Tools with `src/` (e.g. `*_src/`, `digital-logic/src`): the shipped bundle must rebuild byte for byte from src/ with that tool's build script (`build.py` in its src folder); commit both.

## 5. Code rules (summary; full text in the master standards)
- Single self-contained HTML file per tool. No CDNs and no network calls at run time, except the course index fonts (accepted by ruling 2026-11-15).
- Content-Security-Policy with script hashes; recompute the hashes for every build (approved 2026-11-15) and list them in the PR.
- No global test objects in shipped files (`window.__x`); test hooks only via a build flag in a separate test build (Testing Standards v2.0 §8).
- Every imported file is validated before it touches state; refusals name the cause and leave the board unchanged (Testing v2.0 §6 Layer 4).
- Never fail silently: a computed value outside the model's validity or a clamped input is shown to the student (warning colour, plain words).
- Named constants for every magic number; comments state units and sign conventions.
- Appearance: dark text on light backgrounds by default (the principal cannot use light-on-dark); a dark theme may be offered as an option only. Readable at 1366×768 and 125 % zoom with every panel open: no overlapping or clipped labels, no control reachable only by tooltip.
- Equations and units shown the way the course textbook writes them.

## 6. Tests
- Run your developer tests and report them. They never count as acceptance.
- Regression pre-check: if the tool has a filed executable suite in Dropbox `10 Tools/<Tool>/Test/`, run it before opening the PR and report the results as "developer pre-check, not acceptance" (Testing v2.0 §7.3). Do not edit the suite. If a case fails and you believe the case is wrong, flag it; do not change the code to match a case you dispute.
- Random sweeps: when a tool solves for an operating point, sweep random valid inputs and check the physics identities hold (lesson from DEFECT-SG-201).

## 7. Never
- Merge a tool PR without a publish briefing; push to main directly; delete gated files except as a publish step; edit standards, role files or STATUS.md; contact other specialists (route through Director via the Queue).

## 8. House rules carried from Design's project files
Copied from `00 Team/Roles/Design Claude/CLAUDE_Tools-ECE-Simulation.md` and `CLAUDE_Tools-RF-Engineering.md` where they apply to code Claude Code writes and do not conflict with §1–7. Where those files conflict with this one (dark theme, fonts, CDN/SRI, "Owner Claude: Builder Claude", `window.__…` test hooks), §1–7 govern.
- Lecture standard: a plausible-looking wrong picture is worse than no picture. Every control must actually do what it claims; verify each one.
- When two requirements are mutually exclusive, choose and disclose on screen — no hidden clamps or fudges.
- Never draw a numerical artefact as if it were physics; state the model (first-order, schematic, not to scale) in the panel caption.
- Drive every visualization from the real governing equations; show the governing equation with live values; label axes, quantities and SI units everywhere.
- Version appears in four places that must agree: header comment, `<meta name="version" content="vX.Y.Z">`, `<title>`, visible nav badge (the meta survives bundlers that strip comments).
- No `eval()`, `math.evaluate()`, `innerHTML` with variable content, or `document.write`; never `unsafe-eval`. User math expressions use AD-01 (`new Function()` behind the whitelist gate). Use `textContent`/`createElement` for DOM.
- No debug flags, internal URLs or credentials in comments.
- Structure: TOC comment at the top of each script section; `/* ═══ SECTION NAME ═══ */` delimiters; constants block at the top of each script; one-line purpose comment on every function; no dead code; every called function declared; `node --check` clean (syntax error = Critical).
- Performance: render loops use `requestAnimationFrame` only; one redraw per interaction; cache per-frame constants; no listeners added inside loops without removal.
- Accessibility: ARIA roles and labels on sliders, buttons and inputs; non-essential animation gets a pause control (WCAG 2.2 SC 2.3.3).
- `localStorage`: touch only keys this tool wrote.
- Locked decisions (AD/PD/MD/MATH/OA registry in the Design files and standards) change only by principal ruling; flag ambiguity, do not reinterpret.
- Writing: never invent citations; every number traces to a source; flag gaps rather than placeholder.

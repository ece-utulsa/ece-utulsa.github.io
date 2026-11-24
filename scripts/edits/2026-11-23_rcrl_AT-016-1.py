#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for RC-RL Time Constant v1.0.1, AT-016-1 only (Animation Rubric §6.4).

Purpose: reproduce PR "RC-RL Time Constant and Corner Frequency v1.0.1 — AT-016-1 final value in mA".
Briefing: Queue/2026-11-21_ClaudeCode_briefing_RC-RL-TimeConstant_v1.0.1.md (STANDING GO 2026-11-15).
Usage (from the repo root, on the pre-edit file):
  python3 -I scripts/edits/2026-11-23_rcrl_AT-016-1.py
The input is checked against its pre-edit SHA-256, round-tripped unchanged through
scripts/design_bundle.py, edited by exact string replacements (each asserted to match the
stated number of times), repacked, and written in place. Re-running on the edited file stops
at the hash check.
"""
import hashlib, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
PAGE = 'ece-2003/RC-RL Time Constant and Corner Frequency Fall2026.html'
PRE_SHA = '8f9a752271856f3f2634c84563d5cb59e6d888a7f460c23a2386beefbc20a09d'   # live main f964ed6
SCENE = '91fe4131-19ee-4f1c-8291-7272dcf954aa'                                  # rcrl3-tc-corner-scene.jsx
VERSION = 'v1.0.1'                                                               # first version stamp for this page
TITLE = 'RC-RL Time Constant and Corner Frequency'


def sha(path):
    """SHA-256 of a file, hex."""
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:70], n)
    return s.replace(old, new)


# ═══ AT-016-1: RL final value I_L(∞) = V_S/R shown in mA (tick, axis unit, screen-reader sentence) ═══
def scene(js):
    """Final-value tick, its axis unit and the SR sentence show I_L(∞) in mA (≤ 2 decimals); RC unchanged."""
    js = rep(js, "// rcrl3-tc-corner-scene.jsx — RL/RC · Time constant ↔ corner frequency (L2, reworked).\n",
             "// rcrl3-tc-corner-scene.jsx — RL/RC · Time constant ↔ corner frequency (L2, reworked).\n"
             "// Version " + VERSION + " (2026-11-23). Author of this revision: Claude Code — AT-016-1 only:\n"
             "//   the RL final value I_L(∞) = V_S/R is shown in mA to two decimals (tick, axis unit, SR sentence).\n")
    js = rep(js, "const ms = (t) => num(t * 1000, 3) + ' ms';\n",
             "const ms = (t) => num(t * 1000, 3) + ' ms';\n"
             "// AT-016-1: the RL state is a current under 1 A (max V_S/R = 10 V / 200 Ω = 50 mA), shown in mA\n"
             "const MA_PER_A = 1000;                      // display scale, A → mA\n"
             "const FINAL_DP = 2;                         // decimals on the final value (CRF 05 §5)\n"
             "const dispUnit = (sol) => (sol.rl ? 'mA' : sol.unit);                       // unit of the time-plot axis\n"
             "const dispVal = (sol, x) => num(sol.rl ? x * MA_PER_A : x, FINAL_DP);       // a state value in dispUnit\n")
    js = rep(js, "fontFamily={MONO} fontSize=\"10\" fill={GREEN}>{num(sol.xF, 2)}</text>",
             "fontFamily={MONO} fontSize=\"10\" fill={GREEN}>{dispVal(sol, sol.xF)}</text>")
    js = rep(js, "{sol.state + '(t)  [' + sol.unit + ']'}", "{sol.state + '(t)  [' + dispUnit(sol) + ']'}")
    js = rep(js, "' response, final value ' + num(sol.xF, 2) + ' ' + sol.unit + '. Step '",
             "' response, final value ' + dispVal(sol, sol.xF) + ' ' + dispUnit(sol) + '. Step '")
    return js


def template(t):
    """Inner page title and version meta."""
    return rep(t, '<meta name="viewport" content="width=device-width, initial-scale=1">\n',
               '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
               '<title>' + TITLE + ' · ' + VERSION + '</title>\n<meta name="version" content="' + VERSION + '">\n')


def outer(s):
    """Outer wrapper title and version meta (shown while the bundle unpacks)."""
    return rep(s, '<title>Bundled Page</title>',
               '<title>' + TITLE + ' · ' + VERSION + '</title>\n  <meta name="version" content="' + VERSION + '">')


def main():
    """Verify input, edit through design_bundle.py, write in place."""
    path = os.path.join(ROOT, PAGE)
    got = sha(path)
    if got != PRE_SHA:
        sys.exit('%s: SHA-256 %s is not the pre-edit %s (already edited?)' % (PAGE, got[:12], PRE_SHA[:12]))
    subprocess.run([sys.executable, '-I', TOOL, 'roundtrip', path], check=True)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run([sys.executable, '-I', TOOL, 'unpack', path, d], check=True)
        jp = os.path.join(d, 'res', SCENE + '.js')
        js = scene(open(jp, encoding='utf-8').read())   # read before the write handle truncates the file
        open(jp, 'w', encoding='utf-8').write(js)
        tp = os.path.join(d, 'template.html')
        t = template(open(tp, encoding='utf-8').read())
        open(tp, 'w', encoding='utf-8').write(t)
        out = os.path.join(d, 'out.html')
        subprocess.run([sys.executable, '-I', TOOL, 'repack', path, d, out], check=True)
        s = outer(open(out, encoding='utf-8').read())
    open(path, 'w', encoding='utf-8', newline='').write(s)
    print('wrote', PAGE, sha(path))


if __name__ == '__main__':
    main()

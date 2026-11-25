#!/usr/bin/env python3
"""Rebuild ece-3033/DC_Motor_Simulation_v1.6.7.html from v1.6.6 (briefing 2026-11-23 DC Motor v1.6.7).

The tool is a Design __bundler bundle with no src/ folder. v1.6.7 = v1.6.6 with:
  1. template.patch applied to the decoded template (application script, CSS, HTML; version stamps),
  2. the Tweaks JSX header stamp v1.6.6 -> v1.6.7 (no other change to the held Tweaks stack),
  3. the shell header comment: Version, Released, the changelog.txt paragraph, <meta name="version">, <title>.
Unchanged assets keep their bytes (scripts/design_bundle.py repack).
Usage (repo root):  python3 scripts/edits/2026-11-25_dcmotor_v1.6.7/build.py [--check]
--check rebuilds into a temporary file and compares it byte for byte with the committed v1.6.7 file.
"""
import sys, os, subprocess, tempfile, shutil, hashlib, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(REPO, 'ece-3033', 'DC_Motor_Simulation_v1.6.6.html')
OUT = os.path.join(REPO, 'ece-3033', 'DC_Motor_Simulation_v1.6.7.html')
JSX = '09418b22-c3f3-4971-b742-57388075ac49.bin'

spec = importlib.util.spec_from_file_location('design_bundle', os.path.join(REPO, 'scripts', 'design_bundle.py'))
db = importlib.util.module_from_spec(spec); spec.loader.exec_module(db)


def once(s, a, b):
    """Replace a by b, exactly once."""
    assert s.count(a) == 1, (s.count(a), a[:80])
    return s.replace(a, b)


def build(out):
    """Write the v1.6.7 bundle to out."""
    d = tempfile.mkdtemp()
    try:
        db.unpack(SRC, d)
        subprocess.run(['patch', '-s', os.path.join(d, 'template.html'), os.path.join(HERE, 'template.patch')], check=True)
        jp = os.path.join(d, 'res', JSX)
        j = open(jp, encoding='utf-8').read()
        open(jp, 'w', encoding='utf-8').write(once(j, 'DC Motor Simulation v1.6.6 ═══', 'DC Motor Simulation v1.6.7 ═══'))
        tmp = os.path.join(d, 'out.html')
        db.repack(SRC, d, tmp)
        s = open(tmp, encoding='utf-8').read()
    finally:
        shutil.rmtree(d)
    e = s.index('-->')
    h = s[:e]
    h = once(h, '  Version: v1.6.6\n', '  Version: v1.6.7\n')
    h = once(h, '  Released: 2026-11-21\n', '  Released: not released (build for gates, 2026-11-25; v1.6.5 stays live until a publish file)\n')
    h = once(h, '  Changelog: v1.6.6 —', '  Changelog: ' + open(os.path.join(HERE, 'changelog.txt'), encoding='utf-8').read().strip() + '\n  v1.6.6 —')
    s = h + s[e:]
    s = once(s, '  <meta name="version" content="v1.6.6">', '  <meta name="version" content="v1.6.7">')
    s = once(s, '  <title>DC Motor Simulation v1.6.6</title>', '  <title>DC Motor Simulation v1.6.7</title>')
    open(out, 'w', encoding='utf-8', newline='').write(s)


def sha(p):
    """SHA-256 of a file."""
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


if __name__ == '__main__':
    if '--check' in sys.argv:
        with tempfile.TemporaryDirectory() as t:
            o = os.path.join(t, 'v167.html'); build(o)
            ok = sha(o) == sha(OUT)
            print(('byte-identical ' if ok else 'DIFFERS ') + sha(o)); sys.exit(0 if ok else 1)
    build(OUT); print('wrote', OUT, sha(OUT))

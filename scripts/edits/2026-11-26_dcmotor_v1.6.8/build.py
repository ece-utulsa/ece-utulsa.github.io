#!/usr/bin/env python3
"""Rebuild ece-3033/DC_Motor_Simulation_v1.6.8.html from v1.6.7 (briefing 2026-11-26 DC Motor v1.6.8).

The tool is a Design __bundler bundle with no src/ folder. v1.6.8 = v1.6.7 with:
  1. template.patch applied to the decoded template (application script, CSS, HTML; version stamps),
  2. the Tweaks JSX header stamp v1.6.7 -> v1.6.8 (no other change to the held Tweaks stack),
  3. the shell header comment: Version, Released, the changelog.txt paragraph (v1.6.8), the v1.6.7 paragraph
     itemised from changelog_v1.6.7.txt (CQ-DCM-030), <meta name="version">, <title>.
Unchanged assets keep their bytes (scripts/design_bundle.py repack).
Usage (repo root):  python3 scripts/edits/2026-11-26_dcmotor_v1.6.8/build.py [--check] [--out PATH]
--check rebuilds into a temporary file and compares it byte for byte with the committed v1.6.8 file.
"""
import sys, os, subprocess, tempfile, shutil, hashlib, importlib.util

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SRC = os.path.join(REPO, 'ece-3033', 'DC_Motor_Simulation_v1.6.7.html')
OUT = os.path.join(REPO, 'ece-3033', 'DC_Motor_Simulation_v1.6.8.html')
JSX = '09418b22-c3f3-4971-b742-57388075ac49.bin'

spec = importlib.util.spec_from_file_location('design_bundle', os.path.join(REPO, 'scripts', 'design_bundle.py'))
db = importlib.util.module_from_spec(spec); spec.loader.exec_module(db)


def once(s, a, b):
    """Replace a by b, exactly once."""
    assert s.count(a) == 1, (s.count(a), a[:80])
    return s.replace(a, b)


def text(name):
    """Stripped text of a file in this folder."""
    return open(os.path.join(HERE, name), encoding='utf-8').read().strip()


def build(out):
    """Write the v1.6.8 bundle to out."""
    d = tempfile.mkdtemp()
    try:
        db.unpack(SRC, d)
        subprocess.run(['patch', '-s', os.path.join(d, 'template.html'), os.path.join(HERE, 'template.patch')], check=True)
        jp = os.path.join(d, 'res', JSX)
        j = open(jp, encoding='utf-8').read()
        open(jp, 'w', encoding='utf-8').write(once(j, 'DC Motor Simulation v1.6.7 ═══', 'DC Motor Simulation v1.6.8 ═══'))
        tmp = os.path.join(d, 'out.html')
        db.repack(SRC, d, tmp)
        s = open(tmp, encoding='utf-8').read()
    finally:
        shutil.rmtree(d)
    e = s.index('-->')
    h = s[:e]
    h = once(h, '  Version: v1.6.7\n', '  Version: v1.6.8\n')
    h = once(h, '  Released: not released (build for gates, 2026-11-25; v1.6.5 stays live until a publish file)\n',
             '  Released: not released (build for gates, 2026-11-26; v1.6.5 stays live until a publish file)\n')
    old167 = '  Changelog: v1.6.7 — fix pass on the v1.6.6 gate findings (Claude Code, briefing 2026-11-23). WORK IN PROGRESS\n'
    h = once(h, old167, '  Changelog: ' + text('changelog.txt') + '\n  ' + text('changelog_v1.6.7.txt') + '\n')
    s = h + s[e:]
    s = once(s, '  <meta name="version" content="v1.6.7">', '  <meta name="version" content="v1.6.8">')
    s = once(s, '  <title>DC Motor Simulation v1.6.7</title>', '  <title>DC Motor Simulation v1.6.8</title>')
    open(out, 'w', encoding='utf-8', newline='').write(s)


def sha(p):
    """SHA-256 of a file."""
    return hashlib.sha256(open(p, 'rb').read()).hexdigest()


if __name__ == '__main__':
    if '--check' in sys.argv:
        with tempfile.TemporaryDirectory() as t:
            o = os.path.join(t, 'v168.html'); build(o)
            ok = sha(o) == sha(OUT)
            print(('byte-identical ' if ok else 'DIFFERS ') + sha(o)); sys.exit(0 if ok else 1)
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else OUT
    build(out); print('wrote', out, sha(out))

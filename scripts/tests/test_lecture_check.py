#!/usr/bin/env python3
"""Developer tests for scripts/lecture_check.py.

Builds seed lectures in a temporary ece-3033/ folder (CSP hashes computed at build time, so seeds never go
stale), runs the checker on each and asserts that the intended check fires and that a clean file passes.
Run: python3 scripts/tests/test_lecture_check.py        (browser cases need Playwright + Chromium)
"""

# ════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
#   1. Constants and seed template ... SCRIPT, STYLE, PAGE
#   2. Seed builder .................. build(), run_check()
#   3. Test cases .................... LectureCheckTests
# ════════════════════════════════════════════════════════════════════════

import base64
import hashlib
import os
import re
import subprocess
import sys
import tempfile
import unittest

# ── 1. CONSTANTS AND SEED TEMPLATE ────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
CHECKER = os.path.join(os.path.dirname(HERE), 'lecture_check.py')
RUN_TIMEOUT_S = 240

STYLE = """
  body{margin:0;font:16px Arial;color:#111;background:#fff}
  .slide{display:none;padding:20px}.slide.on{display:block}
  #pager{padding:10px}
"""
SCRIPT = """
/* Switch to slide n (1-based). */
function goSlide(n){ S = Math.max(1, Math.min(N, n));
  document.querySelectorAll('.slide').forEach(e => e.classList.toggle('on', +e.dataset.n === S));
  document.getElementById('slPos').textContent = S + '/' + N; __HOOK__ }
let S = 1; const N = 2;
document.getElementById('slNext').addEventListener('click', () => goSlide(S + 1));
goSlide(1);
"""
PAGE = """<!DOCTYPE html>
<!--
  Seed Lecture
  Version: v__V__
-->
<html lang="en"><head><meta charset="utf-8">
<meta name="version" content="v__V__">
<meta http-equiv="Content-Security-Policy" content="__CSP__">
<title>Seed Lecture v__V__</title>
<style>__STYLE__</style></head>
<body>
<div class="slide" data-n="1"><p>Slide one: power flows from the prime mover.</p>__S1__</div>
<div class="slide" data-n="2"><p>Slide two.</p>__S2__</div>
<div id="pager"><span id="slPos">1/2</span><button id="slNext">Next</button></div>
<footer>Seed Lecture · v__FOOT__</footer>
<script>__SCRIPT__</script>
</body></html>
"""
# ── END 1. CONSTANTS AND SEED TEMPLATE ────────────────────────────────────


# ── 2. SEED BUILDER ───────────────────────────────────────────────────────
def _h(text):
    """CSP sha256 source for an inline block."""
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode() + "'"


def build(folder, name, version='1.0.0', foot=None, s1='', s2='', style_extra='', script_extra='',
          hook='', bad_hash=False):
    """Write one seed lecture and return its path. Every argument injects one defect (or none)."""
    style = STYLE + style_extra
    script = SCRIPT.replace('__HOOK__', hook) + script_extra
    script_hash = _h(script) if not bad_hash else _h(script + ' ')
    csp = (f"default-src 'none'; script-src {script_hash}; style-src {_h(style)}; "
           "base-uri 'none'; form-action 'none'")
    html = (PAGE.replace('__STYLE__', style).replace('__SCRIPT__', script).replace('__CSP__', csp)
            .replace('__S1__', s1).replace('__S2__', s2).replace('__FOOT__', foot or version)
            .replace('__V__', version))
    path = os.path.join(folder, f'{name}_v{version}.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    return path


def run_check(path, *extra):
    """Run the checker; return (exit code, {check: set of statuses}, full output)."""
    r = subprocess.run([sys.executable, CHECKER, path, *extra], capture_output=True, text=True, timeout=RUN_TIMEOUT_S)
    status = {}
    for line in r.stdout.splitlines():
        m = re.match(r'^(PASS|WARN|FAIL)\s+(\S+)', line)
        if m:
            status.setdefault(m.group(2), set()).add(m.group(1))
    return r.returncode, status, r.stdout
# ── END 2. SEED BUILDER ───────────────────────────────────────────────────


# ── 3. TEST CASES ─────────────────────────────────────────────────────────
class LectureCheckTests(unittest.TestCase):
    """One seed per defect class; the clean seed must pass with exit code 0."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.dir = os.path.join(cls.tmp.name, 'ece-3033')
        os.makedirs(cls.dir)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def assertFires(self, status, check, level):
        """The named check reported the given level."""
        self.assertIn(level, status.get(check, set()), f'{check} did not report {level}: {status}')

    def test_clean_passes_all(self):
        code, st, out = run_check(build(self.dir, 'Clean'))
        self.assertEqual(code, 0, out)
        bad = {k: v for k, v in st.items() if v - {'PASS'}}
        self.assertEqual(bad, {}, out)

    def test_bad_hash_fails(self):
        code, st, out = run_check(build(self.dir, 'BadHash', bad_hash=True), '--static-only')
        self.assertEqual(code, 1, out)
        self.assertFires(st, 'csp', 'FAIL')

    def test_external_url_fails(self):
        code, st, out = run_check(build(self.dir, 'Ext', s1='<img alt="x" src="https://example.com/x.png">'), '--static-only')
        self.assertEqual(code, 1, out)
        self.assertFires(st, 'network', 'FAIL')

    def test_fetch_call_fails(self):
        code, st, out = run_check(build(self.dir, 'Fetch', script_extra='\nconst q = () => fetch("data.json");\n'), '--static-only')
        self.assertEqual(code, 1, out)
        self.assertFires(st, 'network', 'FAIL')

    def test_code_after_comment_warns(self):
        code, st, out = run_check(build(self.dir, 'Cmt', script_extra='\nlet a = 1; // a = 2;\n// goSlide(2)\n'), '--static-only')
        self.assertFires(st, 'comment-code', 'WARN')
        self.assertEqual(code, 0, out)                    # WARN only, per briefing requirement 2

    def test_prose_comment_not_flagged(self):
        code, st, out = run_check(build(self.dir, 'Prose', script_extra='\n// range (m) and the speed of the shaft\n'), '--static-only')
        self.assertEqual(st.get('comment-code'), {'PASS'}, out)

    def test_css_double_slash_warns(self):
        code, st, out = run_check(build(self.dir, 'CssCmt', style_extra='\n// .bus{stroke:#000}\n'), '--static-only')
        self.assertFires(st, 'comment-code', 'WARN')

    def test_speech_fails(self):
        code, st, out = run_check(build(self.dir, 'Speech', script_extra='\nconst say = () => speechSynthesis.cancel();\n'), '--static-only')
        self.assertFires(st, 'speech', 'FAIL')

    def test_banned_strings_fail(self):
        for word in ('see the textbook', 'Homework 6', 'HW 3', 'Chapman', 'problem 5-12'):
            with self.subTest(word=word):
                code, st, out = run_check(build(self.dir, 'Ban', s2=f'<p>{word}</p>'), '--static-only')
                self.assertFires(st, 'banned', 'FAIL')

    def test_governor_allowed_for_ece3033(self):
        code, st, out = run_check(build(self.dir, 'Gov', s2='<p>the governor on the prime mover</p>'), '--static-only')
        self.assertEqual(st.get('banned'), {'PASS'}, out)

    def test_version_mismatch_fails(self):
        code, st, out = run_check(build(self.dir, 'Ver', foot='1.0.1'), '--static-only')
        self.assertFires(st, 'version', 'FAIL')

    def test_syntax_error_fails(self):
        code, st, out = run_check(build(self.dir, 'Syn', script_extra='\nfunction ( {\n'), '--static-only')
        self.assertFires(st, 'js-syntax', 'FAIL')

    def test_cue_filter_warns(self):
        code, st, out = run_check(build(self.dir, 'Cue', style_extra='\nsvg .cue{filter:drop-shadow(0 0 3px #0f6e6c)}\n',
                                        s1='<svg width="10" height="10"><circle class="cue" r="3" cx="5" cy="5"/></svg>'), '--static-only')
        self.assertFires(st, 'cue-filter', 'WARN')

    def test_unused_css_warns(self):
        code, st, out = run_check(build(self.dir, 'Css', style_extra='\n.neverUsed{color:red}\n'), '--static-only')
        self.assertFires(st, 'unused-css', 'WARN')

    def test_spec_value_missing_warns(self):
        spec = os.path.join(self.dir, 'spec.md')
        with open(spec, 'w', encoding='utf-8') as f:
            f.write('# Spec\n## Key values\n| Quantity | Value |\n|---|---|\n| P | 1,250 kW |\n| f | 60.11 Hz |\n')
        code, st, out = run_check(build(self.dir, 'Spec', s1='<p>P = 1,250 kW</p>'), '--static-only', '--spec', spec)
        self.assertFires(st, 'spec-values', 'WARN')
        self.assertIn('60.11', out)
        code, st, out = run_check(build(self.dir, 'Spec2', s1='<p>P = 1,250 kW, f = 60.11 Hz</p>'), '--static-only', '--spec', spec)
        self.assertEqual(st.get('spec-values'), {'PASS'}, out)

    def test_scrolling_slide_fails(self):
        code, st, out = run_check(build(self.dir, 'Scroll', s2='<div class="tall">long</div>', style_extra='\n.tall{height:2000px}\n'))
        self.assertEqual(code, 1, out)
        self.assertFires(st, 'scroll', 'FAIL')
        self.assertIn('slide 2', out)

    def test_console_error_on_a_slide_fails(self):
        code, st, out = run_check(build(self.dir, 'Err', hook="if(S === 2) console.error('boom');"))
        self.assertEqual(code, 1, out)
        self.assertFires(st, 'console', 'FAIL')

    def test_low_contrast_warns(self):
        code, st, out = run_check(build(self.dir, 'Low', s1='<p class="pale">faint text</p>',
                                        style_extra='\n.pale{color:#bbbbbb}\n'))
        self.assertFires(st, 'contrast', 'WARN')
        self.assertEqual(code, 0, out)
# ── END 3. TEST CASES ─────────────────────────────────────────────────────


if __name__ == '__main__':
    unittest.main(verbosity=2)

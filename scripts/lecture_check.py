#!/usr/bin/env python3
"""Automated pre-publish check for interactive lectures (Interactive Lecture Standard v1 DRAFT §11).

Usage:
  lecture_check.py FILE.html [FILE.html ...] [--spec SPEC.md] [--static-only] [--config CONFIG.json]

Prints one PASS / WARN / FAIL line per check, then a one-line summary per file.
Exit code: 0 when no check FAILs, 1 when any check FAILs, 2 on a usage error.

Static checks (stdlib + node):
  js-syntax      every inline <script> passes `node --check`                       FAIL
  csp            CSP meta present; sha256 hashes match every inline script/style,  FAIL
                 none missing, none extra (inline style="" attributes: WARN)
  network        no http(s) resource (src/href/url()/@import) and no fetch,        FAIL
                 XMLHttpRequest, WebSocket, sendBeacon or dynamic import()
  speech         no speechSynthesis                                                FAIL
  banned         banned strings: global list + the course folder's list            FAIL
                 (scripts/lecture_check_config.json)
  version        filename, <title>, meta version, header stamp and visible stamp   FAIL
                 carry the same vX.Y.Z
  comment-code   a JS `//` comment whose text looks like code (`…;` or `name(`)     WARN
                 and any `//` inside a <style> block (CSS ignores the next rule)
  unused-css     class / id selectors that nothing else in the file names          WARN
  cue-filter     CSS filter / drop-shadow on cue-highlight rules                    WARN
Browser checks (Playwright + Chromium; skipped with --static-only), on every slide:
  console        zero console errors and page errors                               FAIL
  scroll         no vertical or horizontal scrollbar at 1366×768 and 1093×614      FAIL
                 (1093×614 = a 1366×768 laptop at 125 % zoom)
  contrast       rendered text below 4.5:1 (3:1 for large text)                    WARN (until standard v1 is approved)
Spec check (--spec):
  spec-values    every number in the spec's "values" table appears in the file     WARN on a miss

Slides are walked with the shared pager (#slNext, position text "n/N" in #slPos); a page without a pager
is checked as one slide.
"""

# ════════════════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
#   1. Constants
#   2. Result collection ........ Report
#   3. Text helpers ............. strip_data_uris(), line_of(), visible_text()
#   4. HTML extraction .......... inline_blocks(), csp_meta()
#   5. Static checks ............ check_js_syntax(), check_csp(), check_network(), check_speech(),
#                                 check_banned(), check_version(), js_comments(), check_comment_code(),
#                                 check_unused_css(), check_cue_filter()
#   6. Spec check ............... spec_numbers(), check_spec()
#   7. Browser checks ........... CONTRAST_JS, browser_checks()
#   8. Driver ................... load_config(), check_file(), main()
# ════════════════════════════════════════════════════════════════════════

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

# ── 1. CONSTANTS ──────────────────────────────────────────────────────────
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CONFIG = os.path.join(HERE, 'lecture_check_config.json')
VIEWPORTS = [(1366, 768), (1093, 614)]          # CSS px: laptop at 100 % and at 125 % zoom
CONTRAST_NORMAL = 4.5                           # WCAG 2.2 SC 1.4.3, normal text
CONTRAST_LARGE = 3.0                            # large text: ≥ 24 px, or ≥ 18.66 px bold
LARGE_PX, LARGE_BOLD_PX, BOLD_WEIGHT = 24.0, 18.66, 700
MAX_SLIDES = 60                                 # guard against a pager that never reaches N/N
NODE_TIMEOUT_S = 30
PAGE_SETTLE_MS = 400                            # wait after load / slide change before measuring
SCROLL_TOL_PX = 1                               # rounding slack for scroll vs client size
MAX_LISTED = 8                                  # examples printed per WARN/FAIL line
VERSION_RE = re.compile(r'v(\d+\.\d+\.\d+)')
DATA_URI_RE = re.compile(r'data:[\w/+.-]+;base64,[A-Za-z0-9+/=\s]+')
NAMESPACE_URLS = ('http://www.w3.org/',)        # XML namespace identifiers, not resources
# ── END 1. CONSTANTS ──────────────────────────────────────────────────────


# ── 2. RESULT COLLECTION ──────────────────────────────────────────────────
class Report:
    """Collects PASS / WARN / FAIL lines for one file and prints them as they arrive."""

    def __init__(self, name):
        self.name, self.rows = name, []

    def add(self, status, check, detail=''):
        """Record and print one result line."""
        self.rows.append((status, check, detail))
        print(f'{status:<4}  {check:<13} {detail}'.rstrip())

    def ok(self, check, detail=''):
        self.add('PASS', check, detail)

    def warn(self, check, detail):
        self.add('WARN', check, detail)

    def fail(self, check, detail):
        self.add('FAIL', check, detail)

    def count(self, status):
        """Number of lines with the given status."""
        return sum(1 for r in self.rows if r[0] == status)
# ── END 2. RESULT COLLECTION ──────────────────────────────────────────────


# ── 3. TEXT HELPERS ───────────────────────────────────────────────────────
def strip_data_uris(text):
    """Replace base64 data URIs with a same-length run of spaces (keeps offsets and line numbers)."""
    return DATA_URI_RE.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text)


def line_of(text, pos):
    """1-based line number of a character offset."""
    return text.count('\n', 0, pos) + 1


def listed(items):
    """Join up to MAX_LISTED items for a result line, noting how many more there are."""
    items = list(items)
    more = f' … (+{len(items) - MAX_LISTED} more)' if len(items) > MAX_LISTED else ''
    return '; '.join(str(i) for i in items[:MAX_LISTED]) + more
# ── END 3. TEXT HELPERS ───────────────────────────────────────────────────


# ── 4. HTML EXTRACTION ────────────────────────────────────────────────────
SCRIPT_RE = re.compile(r'<script\b([^>]*)>(.*?)</script\s*>', re.S | re.I)
STYLE_RE = re.compile(r'<style\b([^>]*)>(.*?)</style\s*>', re.S | re.I)


def inline_blocks(html, kind):
    """List of (attrs, content, start offset) for inline <script> (kind='script') or <style> blocks.

    Scripts with a src attribute are not inline and are skipped (they are reported by the network check).
    """
    rx = SCRIPT_RE if kind == 'script' else STYLE_RE
    out = []
    for m in rx.finditer(html):
        attrs = m.group(1)
        if kind == 'script' and re.search(r'\bsrc\s*=', attrs, re.I):
            continue
        out.append((attrs, m.group(2), m.start(2)))
    return out


def csp_meta(html):
    """Content of the CSP meta tag, or None."""
    m = re.search(r'<meta[^>]+http-equiv\s*=\s*["\']Content-Security-Policy["\'][^>]*>', html, re.I)
    if not m:
        return None
    c = re.search(r'content\s*=\s*"([^"]*)"|content\s*=\s*\'([^\']*)\'', m.group(0), re.I)
    return (c.group(1) or c.group(2)) if c else ''


def sha256_b64(text):
    """CSP source hash of an inline block (UTF-8 bytes, base64)."""
    return base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode()
# ── END 4. HTML EXTRACTION ────────────────────────────────────────────────


# ── 5. STATIC CHECKS ──────────────────────────────────────────────────────
def check_js_syntax(html, rep):
    """node --check on every inline script (type=module scripts as .mjs; JSON/template types skipped)."""
    bad, n = [], 0
    for attrs, body, start in inline_blocks(html, 'script'):
        t = re.search(r'\btype\s*=\s*["\']?([^"\'\s>]+)', attrs, re.I)
        typ = t.group(1).lower() if t else 'text/javascript'
        if typ not in ('text/javascript', 'module', 'application/javascript'):
            continue
        n += 1
        ext = '.mjs' if typ == 'module' else '.js'
        with tempfile.NamedTemporaryFile('w', suffix=ext, delete=False, encoding='utf-8') as f:
            f.write(body)
            path = f.name
        try:
            r = subprocess.run(['node', '--check', path], capture_output=True, text=True, timeout=NODE_TIMEOUT_S)
            if r.returncode != 0:
                msg = (r.stderr.strip().splitlines() or ['syntax error'])
                bad.append(f'script at line {line_of(html, start)}: ' + ' | '.join(msg[-3:]))
        except FileNotFoundError:
            rep.fail('js-syntax', 'node not found on PATH')
            return
        finally:
            os.unlink(path)
    if bad:
        rep.fail('js-syntax', listed(bad))
    else:
        rep.ok('js-syntax', f'{n} inline script(s) clean')


def check_csp(html, rep):
    """CSP meta present, and its sha256 sources equal the hashes of the inline scripts and styles."""
    csp = csp_meta(html)
    if csp is None:
        rep.fail('csp', 'no Content-Security-Policy meta tag')
        return
    directives = {}
    for part in csp.split(';'):
        toks = part.split()
        if toks:
            directives[toks[0].lower()] = toks[1:]
    problems = []
    for kind, directive in (('script', 'script-src'), ('style', 'style-src')):
        srcs = directives.get(directive, directives.get('default-src', []))
        listed_h = {t.strip("'")[len('sha256-'):] for t in srcs if t.strip("'").startswith('sha256-')}
        actual = {sha256_b64(body): line_of(html, start) for _, body, start in inline_blocks(html, kind)}
        if "'unsafe-inline'" in srcs and not listed_h:
            if actual:
                problems.append(f"{directive} uses 'unsafe-inline' instead of hashes")
            continue
        for h, ln in actual.items():
            if h not in listed_h:
                problems.append(f'{kind} at line {ln} hash sha256-{h} missing from {directive}')
        for h in listed_h - set(actual):
            problems.append(f'{directive} lists sha256-{h}, which matches no inline {kind}')
    if "'unsafe-eval'" in csp:
        problems.append("'unsafe-eval' present")
    if problems:
        rep.fail('csp', listed(problems))
    else:
        rep.ok('csp', 'hashes match every inline script and style')
    body = html.split('<body', 1)[-1]
    attrs = re.findall(r'\sstyle\s*=\s*["\']', body, re.I)
    style_srcs = directives.get('style-src', [])
    if attrs and "'unsafe-inline'" not in style_srcs and "'unsafe-hashes'" not in style_srcs:
        rep.warn('csp', f'{len(attrs)} inline style="" attribute(s) are blocked by style-src without '
                        "'unsafe-inline' or 'unsafe-hashes'")
    handlers = re.findall(r'<[^>]+\son[a-z]+\s*=\s*["\']', body, re.I)
    if handlers:
        rep.warn('csp', f'{len(handlers)} inline on*= handler attribute(s): blocked by a hash-only script-src')


def check_network(html, rep):
    """No http(s) resources and no network APIs."""
    text = strip_data_uris(html)
    fails, warns = [], []
    for m in re.finditer(r'''(?:\b(?:src|href|action|poster|data)\s*=\s*["']?|url\(\s*["']?|@import\s+["'])(https?://[^"')\s>]+)''', text, re.I):
        fails.append(f'line {line_of(text, m.start(1))}: {m.group(1)}')
    for m in re.finditer(r'\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|import\s*\()', text):
        fails.append(f'line {line_of(text, m.start())}: {m.group(1).strip()}')
    resource_lines = {f.split(':')[0] for f in fails}
    for m in re.finditer(r'https?://[^\s"\'<>)]+', text):
        if m.group(0).startswith(NAMESPACE_URLS):
            continue
        tag = f'line {line_of(text, m.start())}'
        if tag not in resource_lines:
            warns.append(f'{tag}: {m.group(0)}')
    if fails:
        rep.fail('network', listed(fails))
    else:
        rep.ok('network', 'no http(s) resource and no network API')
    if warns:
        rep.warn('network', 'URL text (not a resource): ' + listed(warns))


def check_speech(html, rep):
    """No device speech."""
    hits = [line_of(html, m.start()) for m in re.finditer(r'speechSynthesis|SpeechSynthesisUtterance', html)]
    if hits:
        rep.fail('speech', 'speechSynthesis at line(s) ' + listed(hits))
    else:
        rep.ok('speech', 'no speechSynthesis')


def check_banned(html, path, cfg, rep):
    """Banned strings from the config: the global list plus the list for the file's course folder."""
    course = os.path.basename(os.path.dirname(os.path.abspath(path)))
    rules = list(cfg.get('global', [])) + list(cfg.get('courses', {}).get(course, []))
    allowed = cfg.get('allowed', {}).get(course, [])
    text = strip_data_uris(html)
    hits = []
    for rule in rules:
        rx = re.compile(rule['regex'], 0 if rule.get('case') else re.I)
        for m in rx.finditer(text):
            if any(a.lower() in text[max(0, m.start() - 60):m.end() + 60].lower() for a in allowed):
                continue
            hits.append(f'line {line_of(text, m.start())}: "{m.group(0)}" ({rule["name"]})')
    if hits:
        rep.fail('banned', listed(hits))
    else:
        rep.ok('banned', f'{len(rules)} pattern(s) for course "{course}": none found')


def check_version(html, path, rep):
    """Filename, <title>, meta version, header comment and a visible stamp all carry the same vX.Y.Z."""
    found = {}
    m = VERSION_RE.search(os.path.basename(path))
    found['filename'] = m.group(1) if m else None
    t = re.search(r'<title>(.*?)</title>', html, re.S | re.I)
    m = VERSION_RE.search(t.group(1)) if t else None
    found['title'] = m.group(1) if m else None
    m = re.search(r'<meta[^>]+name\s*=\s*["\']version["\'][^>]*content\s*=\s*["\']v?([\d.]+)', html, re.I)
    found['meta'] = m.group(1) if m else None
    m = re.search(r'<!--.*?Version:\s*v?(\d+\.\d+\.\d+)', html, re.S)
    found['header'] = m.group(1) if m else None
    body = re.sub(r'<(script|style)\b.*?</\1\s*>', ' ', html.split('<body', 1)[-1], flags=re.S | re.I)
    body = re.sub(r'<!--.*?-->', ' ', body, flags=re.S)
    vis = sorted(set(VERSION_RE.findall(re.sub(r'<[^>]+>', ' ', body))))
    found['visible'] = ','.join(vis) if vis else None
    missing = [k for k, v in found.items() if v is None]
    values = {v for v in found.values() if v}
    if missing or len(values) != 1:
        rep.fail('version', ' · '.join(f'{k}={v or "—"}' for k, v in found.items()))
    else:
        rep.ok('version', f'v{values.pop()} in filename, title, meta, header and visible stamp')


def js_comments(src):
    """Yield (offset, text) for each // line comment in JavaScript, skipping strings, templates and regexes."""
    i, n = 0, len(src)
    prev = ''                                   # last significant character (decides regex vs divide)
    while i < n:
        c = src[i]
        if c in '"\'':
            j = i + 1
            while j < n and src[j] != c and src[j] != '\n':
                j += 2 if src[j] == '\\' else 1
            i, prev = j + 1, 'a'
        elif c == '`':
            j, depth = i + 1, 0
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src.startswith('${', j):
                    depth += 1
                    j += 2
                    continue
                if src[j] == '}' and depth:
                    depth -= 1
                elif src[j] == '`' and not depth:
                    break
                j += 1
            i, prev = j + 1, 'a'
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
        elif src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            yield i, src[i + 2:j]
            i = j
        elif c == '/' and (prev == '' or prev in '(,=:[!&|?{};+-*%<>~^'):
            j, in_class = i + 1, False           # regex literal
            while j < n and src[j] != '\n':
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == '[':
                    in_class = True
                elif src[j] == ']':
                    in_class = False
                elif src[j] == '/' and not in_class:
                    break
                j += 1
            i, prev = j + 1, 'a'
        else:
            if not c.isspace():
                prev = c if not (c.isalnum() or c in '_$') else 'a'
            i += 1


CODE_LIKE = re.compile(r'(?:[\w\])\'"`]\s*;\s*$)|(?:(?<![\w$.])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\()')


def check_comment_code(html, rep):
    """WARN where a // comment reads like code, and where // appears in CSS (CSS ignores the next rule)."""
    hits = []
    for _, body, start in inline_blocks(html, 'script'):
        for off, text in js_comments(body):
            if CODE_LIKE.search(text.strip()):
                hits.append(f'line {line_of(html, start + off)}: //{text.strip()[:70]}')
    for _, body, start in inline_blocks(html, 'style'):
        clean = re.sub(r'/\*.*?\*/', lambda m: ' ' * len(m.group(0)), body, flags=re.S)
        clean = re.sub(r'url\([^)]*\)|"[^"]*"|\'[^\']*\'', lambda m: ' ' * len(m.group(0)), clean)
        for m in re.finditer(r'//', clean):
            hits.append(f'line {line_of(html, start + m.start())}: "//" in CSS (the rule after it is ignored)')
    if hits:
        rep.warn('comment-code', 'review: ' + listed(hits))
    else:
        rep.ok('comment-code', 'no code-like // comments; no // in CSS')


def css_rules(css):
    """List of (selector text, declarations) for the plain rules of a stylesheet (nested @-blocks flattened)."""
    css = re.sub(r'/\*.*?\*/', ' ', css, flags=re.S)
    out = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sel = m.group(1).strip()
        if sel.startswith('@') or re.match(r'^(from|to|\d+%)', sel):
            continue
        out.append((sel, m.group(2)))
    return out


def check_unused_css(html, rep):
    """WARN for class and id selectors whose name appears nowhere in the file outside the style blocks."""
    styles = inline_blocks(html, 'style')
    rest = html
    for _, body, _ in styles:
        rest = rest.replace(body, ' ')
    rest = strip_data_uris(rest)
    words = set(re.findall(r'[A-Za-z_][\w-]*', rest))
    unused = set()
    for _, body, _ in styles:
        for sel, _ in css_rules(body):
            for name in re.findall(r'[.#](-?[A-Za-z_][\w-]*)', re.sub(r'\[[^\]]*\]|"[^"]*"|\'[^\']*\'', '', sel)):
                if name not in words:
                    unused.add(name)
    if unused:
        rep.warn('unused-css', f'{len(unused)} selector name(s) not used elsewhere: ' + listed(sorted(unused)))
    else:
        rep.ok('unused-css', 'every class/id selector is named elsewhere in the file')


def check_cue_filter(html, rep):
    """WARN for CSS filter / drop-shadow on cue-highlight rules (blurs thin SVG lines)."""
    hits = []
    for _, body, start in inline_blocks(html, 'style'):
        for sel, decl in css_rules(body):
            if re.search(r'cue', sel, re.I) and re.search(r'(^|;|\s)filter\s*:\s*(?!none\s*(;|$|!))|drop-shadow', decl, re.I):
                ln = line_of(html, start + body.find(decl))
                hits.append(f'line {ln}: {sel[:50]} {{{decl.strip()[:60]}}}')
    if hits:
        rep.warn('cue-filter', listed(hits))
    else:
        rep.ok('cue-filter', 'no filter/drop-shadow on cue rules')
# ── END 5. STATIC CHECKS ──────────────────────────────────────────────────


# ── 6. SPEC CHECK ─────────────────────────────────────────────────────────
NUM_RE = re.compile(r'(?<![\w.])[−-]?\d[\d,]*(?:\.\d+)?(?![\w.])')


def spec_numbers(md):
    """Numbers in the cells of the spec's "values" table(s): a table under a heading, or with a header row,
    that contains the word "value"."""
    nums, lines, heading, i = [], md.splitlines(), '', 0
    while i < len(lines):
        ln = lines[i]
        if ln.lstrip().startswith('#'):
            heading = ln
        if ln.strip().startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|[\s:|-]+\|\s*$', lines[i + 1]):
            header, rows = ln, []
            i += 2
            while i < len(lines) and lines[i].strip().startswith('|'):
                rows.append(lines[i])
                i += 1
            if re.search(r'value', heading + header, re.I):
                for r in rows:
                    nums += [n.replace('−', '-').replace(',', '') for n in NUM_RE.findall(r)]
            continue
        i += 1
    return nums


def number_variants(n):
    """Text forms in which a spec number may appear in the file (plain, thousands commas, Unicode minus)."""
    forms = {n}
    neg = n.startswith('-')
    body = n[1:] if neg else n
    ip, _, fp = body.partition('.')
    if len(ip) > 3:
        comma = f'{int(ip):,}' + (('.' + fp) if fp else '')
        forms.add(('-' if neg else '') + comma)
    forms |= {f.replace('-', '−', 1) for f in list(forms) if f.startswith('-')}
    return forms


def check_spec(html, spec_path, rep):
    """WARN for every spec "values" number that does not appear in the file."""
    try:
        md = open(spec_path, encoding='utf-8').read()
    except OSError as e:
        rep.fail('spec-values', f'cannot read spec: {e}')
        return
    nums = spec_numbers(md)
    if not nums:
        rep.warn('spec-values', 'no "values" table with numbers found in the spec')
        return
    text = strip_data_uris(html)
    missing = sorted({n for n in nums if not any(
        re.search(r'(?<![\d.])' + re.escape(v) + r'(?![\d])', text) for v in number_variants(n))}, key=lambda s: float(s))
    if missing:
        rep.warn('spec-values', f'{len(missing)} of {len(set(nums))} value(s) not in the file: ' + listed(missing))
    else:
        rep.ok('spec-values', f'all {len(set(nums))} value(s) appear in the file')
# ── END 6. SPEC CHECK ─────────────────────────────────────────────────────


# ── 7. BROWSER CHECKS ─────────────────────────────────────────────────────
# Returns the rendered text elements whose contrast is below the WCAG threshold on the current slide.
CONTRAST_JS = r'''
([NORMAL, LARGE, LARGE_PX, LARGE_BOLD_PX, BOLD]) => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if(!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const lin = c => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
  const lum = c => 0.2126*lin(c[0]) + 0.7152*lin(c[1]) + 0.0722*lin(c[2]);
  const over = (top, bot) => { const a = top[3]; return [0,1,2].map(i => top[i]*a + bot[i]*(1-a)).concat([1]); };
  const bgOf = el => { const layers = [];
    for(let e = el; e; e = e.parentElement){ const cs = getComputedStyle(e);
      if(cs.backgroundImage && cs.backgroundImage !== 'none') return null;          // gradient / image: unknown
      const c = parse(cs.backgroundColor); if(c && c[3] > 0){ layers.push(c); if(c[3] >= 1) break; } }
    let bg = [255,255,255,1]; for(let i = layers.length-1; i >= 0; i--) bg = over(layers[i], bg); return bg; };
  const out = []; let n = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for(let t = walker.nextNode(); t; t = walker.nextNode()){
    if(!t.textContent.trim()) continue; const el = t.parentElement; if(!el || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if(r.width < 1 || r.height < 1) continue;
    const cs = getComputedStyle(el); if(cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if(el.closest('[hidden],[aria-hidden="true"]') && !el.closest('svg')) continue;
    let fg = parse(el.closest('svg') && el.tagName !== 'foreignObject' ? (cs.fill || cs.color) : cs.color); if(!fg) continue;
    let op = 1; for(let e = el; e; e = e.parentElement){ op *= +getComputedStyle(e).opacity; }
    if(op < 0.01) continue;                      // fully transparent (an ancestor at opacity 0): not rendered
    fg = [fg[0], fg[1], fg[2], fg[3]*op];
    let bg = bgOf(el);
    if(el.closest('svg')){                       // SVG text: the background is the first shape drawn under it
      const c = [r.left + r.width/2, r.top + r.height/2];
      const under = document.elementsFromPoint(c[0], c[1]).find(u => u !== el && !el.contains(u) && !u.contains(el)
                      && !['text','tspan','textPath'].includes(u.tagName));
      if(under && under.closest('svg') && under.tagName !== 'svg'){
        const us = getComputedStyle(under), uf = parse(us.fill);
        if(uf){ const a = uf[3] * (+us.fillOpacity) * (+us.opacity); bg = over([uf[0], uf[1], uf[2], a], bgOf(under) || [255,255,255,1]); }
      }
    }
    if(!bg) continue;
    const f = over(fg, bg); const L1 = lum(f), L2 = lum(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= BOLD || cs.fontWeight === 'bold';
    const need = (px >= LARGE_PX || (bold && px >= LARGE_BOLD_PX)) ? LARGE : NORMAL; n++;
    if(ratio < need) out.push({text: t.textContent.trim().slice(0, 30), ratio: Math.round(ratio*100)/100, need});
  }
  return {n, low: out};
}
'''


def browser_checks(path, rep):
    """Per slide: console/page errors, scrollbars at both viewports, rendered text contrast."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        rep.fail('console', 'Playwright for Python is not installed (use --static-only to skip browser checks)')
        return
    url = 'file://' + os.path.abspath(path)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for vi, (w, h) in enumerate(VIEWPORTS):
                page = browser.new_page(viewport={'width': w, 'height': h})
                errs = []
                page.on('console', lambda m, errs=errs: errs.append('console: ' + m.text) if m.type == 'error' else None)
                page.on('pageerror', lambda e, errs=errs: errs.append('pageerror: ' + str(e)))
                page.goto(url)
                page.wait_for_timeout(PAGE_SETTLE_MS)
                scroll_bad, low_all, n_text, slide = [], [], 0, 1
                total = None
                for _ in range(MAX_SLIDES):
                    pos = page.evaluate("() => { const e = document.getElementById('slPos'); return e ? e.textContent : '' }")
                    m = re.match(r'\s*(\d+)\s*/\s*(\d+)', pos or '')
                    slide, total = (int(m.group(1)), int(m.group(2))) if m else (1, 1)
                    dims = page.evaluate('''() => { const d = document.documentElement;
                        return [d.scrollWidth, d.clientWidth, d.scrollHeight, d.clientHeight] }''')
                    if dims[0] > dims[1] + SCROLL_TOL_PX or dims[2] > dims[3] + SCROLL_TOL_PX:
                        scroll_bad.append(f'slide {slide}: content {dims[0]}×{dims[2]} in {dims[1]}×{dims[3]}')
                    if vi == 0:
                        res = page.evaluate(CONTRAST_JS, [CONTRAST_NORMAL, CONTRAST_LARGE, LARGE_PX, LARGE_BOLD_PX, BOLD_WEIGHT])
                        n_text += res['n']
                        low_all += [f'slide {slide}: "{r["text"]}" {r["ratio"]}:1' for r in res['low']]
                    if slide >= total or not page.locator('#slNext').count():
                        break
                    page.click('#slNext')
                    page.wait_for_timeout(PAGE_SETTLE_MS)
                if scroll_bad:
                    rep.fail('scroll', f'{w}×{h}: ' + listed(scroll_bad))
                else:
                    rep.ok('scroll', f'{w}×{h}: no scrollbar on {total} slide(s)')
                if errs:
                    rep.fail('console', f'{w}×{h}: ' + listed(errs))
                else:
                    rep.ok('console', f'{w}×{h}: 0 errors on {total} slide(s)')
                if vi == 0:
                    if low_all:
                        rep.warn('contrast', f'{len(low_all)} of {n_text} text element(s) below threshold: ' + listed(low_all))
                    else:
                        rep.ok('contrast', f'{n_text} text element(s) ≥ threshold')
                page.close()
        finally:
            browser.close()
# ── END 7. BROWSER CHECKS ─────────────────────────────────────────────────


# ── 8. DRIVER ─────────────────────────────────────────────────────────────
def load_config(path):
    """Read the banned-string configuration."""
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def check_file(path, cfg, spec=None, static_only=False):
    """Run every check on one file; returns its Report."""
    print(f'== {path}')
    rep = Report(path)
    try:
        html = open(path, encoding='utf-8').read()
    except OSError as e:
        rep.fail('read', str(e))
        return rep
    check_js_syntax(html, rep)
    check_csp(html, rep)
    check_network(html, rep)
    check_speech(html, rep)
    check_banned(html, path, cfg, rep)
    check_version(html, path, rep)
    check_comment_code(html, rep)
    check_unused_css(html, rep)
    check_cue_filter(html, rep)
    if spec:
        check_spec(html, spec, rep)
    if not static_only:
        browser_checks(path, rep)
    verdict = 'FAIL' if rep.count('FAIL') else ('WARN' if rep.count('WARN') else 'PASS')
    print(f'SUMMARY {verdict}  {os.path.basename(path)}: {rep.count("PASS")} pass, '
          f'{rep.count("WARN")} warn, {rep.count("FAIL")} fail')
    return rep


def main(argv=None):
    """Command-line entry point."""
    ap = argparse.ArgumentParser(description='Interactive-lecture pre-publish check (standard §11).')
    ap.add_argument('files', nargs='+', help='lecture HTML file(s)')
    ap.add_argument('--spec', help="slide spec (markdown) whose 'values' table numbers must appear in the file")
    ap.add_argument('--static-only', action='store_true', help='skip the browser checks')
    ap.add_argument('--config', default=DEFAULT_CONFIG, help='banned-string config (JSON)')
    args = ap.parse_args(argv)
    try:
        cfg = load_config(args.config)
    except (OSError, ValueError) as e:
        print(f'cannot read config {args.config}: {e}', file=sys.stderr)
        return 2
    reports = [check_file(f, cfg, args.spec, args.static_only) for f in args.files]
    return 1 if any(r.count('FAIL') for r in reports) else 0


if __name__ == '__main__':
    sys.exit(main())
# ── END 8. DRIVER ─────────────────────────────────────────────────────────

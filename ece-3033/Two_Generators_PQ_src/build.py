#!/usr/bin/env python3
"""Build ece-3033/Two_Generators_PQ_v<version>.html from this folder.

Usage: python3 build.py            (writes ../Two_Generators_PQ_v2.0.0.html)
Inputs: page.html (shell), page.css, page.js, narration.json (40 lines), clips/<name>.mp3 (one per line; render_clips.py makes them).
Clip names: s<slide>_<line>, lab_<n>, exp_<n>. The build is deterministic: the same inputs give the same bytes.
The CSP hashes are recomputed from the final style and script text on every build and printed.
"""
import base64
import hashlib
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = 'v2.0.0'
OUT = os.path.join(HERE, '..', 'Two_Generators_PQ_%s.html' % VERSION)


def read(name):
    """Text of a file in this folder."""
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def clip(name):
    """One mp3 clip as a data URI."""
    with open(os.path.join(HERE, 'clips', name + '.mp3'), 'rb') as f:
        return 'data:audio/mpeg;base64,' + base64.b64encode(f.read()).decode('ascii')


def sha256_b64(text):
    """CSP hash source value (base64 of the SHA-256 of the UTF-8 text)."""
    return base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode('ascii')


def main():
    """Assemble the page, compute the CSP hashes and write the output file."""
    say = json.loads(read('narration.json'))
    clips = {'slides': [[clip('s%d_%d' % (s + 1, i + 1)) for i in range(len(lines))] for s, lines in enumerate(say['slides'])],
             'lab': [clip('lab_%d' % (i + 1)) for i in range(len(say['lab']))],
             'exp': [clip('exp_%d' % (i + 1)) for i in range(len(say['exp']))]}
    dumps = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    js = read('page.js').replace('__SAY__', dumps(say)).replace('__CLIPS__', dumps(clips))
    css = read('page.css')
    html = read('page.html')
    assert VERSION in html and '</script' not in js.lower() and '</style' not in css.lower()
    html = (html.replace('__SCRIPT_HASH__', sha256_b64(js)).replace('__STYLE_HASH__', sha256_b64(css))
            .replace('__CSS__', css).replace('__JS__', js))
    data = html.encode('utf-8')
    with open(OUT, 'wb') as f:
        f.write(data)
    n = sum(len(x) for x in say['slides']) + len(say['lab']) + len(say['exp'])
    print('wrote %s: %d bytes, sha256 %s' % (os.path.basename(OUT), len(data), hashlib.sha256(data).hexdigest()))
    print('clips: %d' % n)
    print("script-src 'sha256-%s'" % sha256_b64(js))
    print("style-src 'sha256-%s'" % sha256_b64(css))


if __name__ == '__main__':
    main()

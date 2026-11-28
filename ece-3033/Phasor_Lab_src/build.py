#!/usr/bin/env python3
"""Build ece-3033/Phasor_Lab_v<version>.html from this folder.

Usage: python3 build.py            (writes ../Phasor_Lab_v1.0.0.html)
       python3 build.py --check    (builds in memory and exits 1 unless the file on disk is byte-identical)
Inputs: page.html (shell), page.css, page.js. The build is deterministic: the same inputs give the same bytes.
The CSP hashes are recomputed from the final style and script text on every build and printed.
"""
import base64
import hashlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
VERSION = 'v1.0.0'
OUT = os.path.join(HERE, '..', 'Phasor_Lab_%s.html' % VERSION)


def read(name):
    """Text of a file in this folder."""
    with open(os.path.join(HERE, name), encoding='utf-8') as f:
        return f.read()


def sha256_b64(text):
    """CSP hash source value (base64 of the SHA-256 of the UTF-8 text)."""
    return base64.b64encode(hashlib.sha256(text.encode('utf-8')).digest()).decode('ascii')


def build():
    """Assemble the page and return (bytes, script hash, style hash)."""
    js, css, html = read('page.js'), read('page.css'), read('page.html')
    assert VERSION in html and '</script' not in js.lower() and '</style' not in css.lower()
    hs, hc = sha256_b64(js), sha256_b64(css)
    html = html.replace('__SCRIPT_HASH__', hs).replace('__STYLE_HASH__', hc).replace('__CSS__', css).replace('__JS__', js)
    return html.encode('utf-8'), hs, hc


def main():
    """Write the output file (or check it) and print its size, SHA-256 and CSP hashes."""
    data, hs, hc = build()
    if '--check' in sys.argv:
        with open(OUT, 'rb') as f:
            same = f.read() == data
        print('check: %s is %s' % (os.path.basename(OUT), 'byte-identical' if same else 'DIFFERENT'))
        sys.exit(0 if same else 1)
    with open(OUT, 'wb') as f:
        f.write(data)
    print('wrote %s: %d bytes, sha256 %s' % (os.path.basename(OUT), len(data), hashlib.sha256(data).hexdigest()))
    print("script-src 'sha256-%s'" % hs)
    print("style-src 'sha256-%s'" % hc)


if __name__ == '__main__':
    main()

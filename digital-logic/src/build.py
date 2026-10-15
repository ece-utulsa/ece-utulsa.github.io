#!/usr/bin/env python3
"""Build the single-file Digital Logic Breadboard from the sources in this folder.

The delivered page is a self-contained bundle: shell.html (loader runtime) followed by
four data islands the runtime unpacks in the browser --
  __bundler/manifest      every asset by uuid: scripts gzip+base64, fonts raw base64
  __bundler/ext_resources []  (nothing external)
  __bundler/page_order    []  (no nested pages)
  __bundler/template      the page itself, JSON-encoded, assets referenced by uuid

Sources:
  shell.html     loader runtime and version stamp (edit here, never in the bundle)
  template.html  page markup and CSS; <script src="x.js"> names a source script below,
                 /*@inline main.js*/ marks where main.js is inlined
  defs.js sim.js board.js timing.js learn.js main.js   application scripts
  fonts/<uuid>.woff2   embedded IBM Plex Mono faces (referenced by uuid in template.html)

Release fields (VERSION, RELEASED, CHANGELOG) live below and replace @@VERSION@@,
@@RELEASED@@ and @@CHANGELOG@@ in shell.html and template.html.

Usage:  python3 build.py            writes ../Digital Logic Breadboard v<VERSION>.html
        python3 build.py OUT.html   writes OUT.html
"""
import base64
import gzip
import json
import os
import sys

# ── RELEASE ───────────────────────────────────────────────────────────
VERSION = 'v1.2.0'
RELEASED = '2026-10-15'
CHANGELOG = ('Customer revisions: MUX select bits on top; selected wire can be dragged (tee handle beside it); '
             '7-SEG exposes all segments (BCD display kept as BCD 7-SEG); subsystems; one-pin LED')
TOOL = 'Digital Logic Breadboard'
# ── END RELEASE ───────────────────────────────────────────────────────

# Script sources and their fixed asset uuids (kept from v1.0.0 so bundle diffs stay readable).
SCRIPTS = [
    ('defs.js', '4777ab4e-e6c5-4e2e-8666-37142a569a5d'),
    ('timing.js', '4479f874-df98-42d6-9799-655f42e2fe3f'),
    ('learn.js', '902a536b-4340-4847-8f25-483d1841fc19'),
    ('board.js', '28d4e084-71b7-4c6a-8252-40cd3e3147a6'),
    ('sim.js', 'd8b67351-557c-49fb-9843-f58f7e57a8de'),
]
# Font order as in the v1.0.0 manifest.
FONTS = [
    '0473769e-05be-4402-9ab3-295d46b5bf3c', 'd4c6ef05-d8d0-4332-bd4b-06746700fc98',
    '2f9409f3-7944-4418-8670-e34593040c4c', '597e6751-652b-4728-8bd1-c035c0def442',
    '5631adb2-57be-488f-b15d-274154cc1adc', '77493ab4-e754-459f-adcb-cff9dbdb10a8',
    'caf87ad6-3c90-424a-b119-8287b521da8e', 'ce287251-4c34-4727-96e7-2c7129bd7b4d',
    '4a325770-d9f6-4fc3-bbfc-4122601487bc', 'cd89e96f-aac0-4191-8dd4-e5abb5403997',
    '5b7bbcd9-9f9d-4f01-aa2c-0f28ce4a1572', 'dc040768-15b7-476b-825b-46aa4d22c27f',
    '78fd4155-8e0d-459a-8164-451027caeb3e', '65d8820e-bd05-4937-9b1e-bbce4b042cda',
    'c2136cb3-4393-4a99-9854-327b23f0368d', 'b78936bc-470f-498b-ad59-9bbe20686591',
    'cec98460-0ed4-4eac-bb7c-b2cd1ae239ec', 'f9dcfb0c-719e-4511-b3ff-fe3d146f4544',
    '04dde52a-5ede-49d5-8a3e-d4ddb8933a43', '5a8835f1-4d23-4756-bcc2-2df92cf1cb99',
]
INLINE_MAIN = '/*@inline main.js*/'
HERE = os.path.dirname(os.path.abspath(__file__))


def read(name, mode='r'):
    """Read a source file relative to this folder."""
    with open(os.path.join(HERE, name), mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def stamp(text):
    """Fill the release placeholders."""
    return (text.replace('@@VERSION@@', VERSION).replace('@@RELEASED@@', RELEASED)
            .replace('@@CHANGELOG@@', CHANGELOG).replace('@@TOOL@@', TOOL))


def island(kind, body):
    """One data island in the shell's layout."""
    return '\n  <script type="__bundler/%s">\n%s\n  </script>\n' % (kind, body)


def build():
    """Return the bundled page as a string."""
    manifest = {}
    template = stamp(read('template.html'))
    main = read('main.js')
    if INLINE_MAIN not in template:
        sys.exit('template.html has no %s marker' % INLINE_MAIN)
    template = template.replace(INLINE_MAIN, main)
    for name, uuid in SCRIPTS:
        ref = 'src="%s"' % name
        if ref not in template:
            sys.exit('template.html does not load %s' % name)
        template = template.replace(ref, 'src="%s"' % uuid)
        data = gzip.compress(read(name, 'rb'), compresslevel=9, mtime=0)
        manifest[uuid] = {'mime': 'application/javascript', 'compressed': True,
                          'data': base64.b64encode(data).decode('ascii')}
    for uuid in FONTS:
        if uuid not in template:
            sys.exit('template.html does not reference font %s' % uuid)
        manifest[uuid] = {'mime': 'font/woff2', 'compressed': False,
                          'data': base64.b64encode(read('fonts/%s.woff2' % uuid, 'rb')).decode('ascii')}
    if '@@' in template:
        sys.exit('unfilled placeholder in template.html')
    tpl_json = json.dumps(template, ensure_ascii=False).replace('</', '<\\u002F')
    shell = stamp(read('shell.html'))
    return (shell
            + island('manifest', json.dumps(manifest, separators=(',', ':')))
            + island('ext_resources', '[]')
            + island('page_order', '[]')
            + island('template', tpl_json)
            + '</body>\n</html>')


def main():
    """Write the bundle to the path given, or next to this folder under the versioned name."""
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '%s %s.html' % (TOOL, VERSION))
    with open(out, 'w', encoding='utf-8') as f:
        f.write(build())
    print('wrote', os.path.normpath(out))


if __name__ == '__main__':
    main()

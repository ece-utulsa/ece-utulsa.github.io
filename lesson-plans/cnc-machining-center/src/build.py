#!/usr/bin/env python3
"""Build the two standalone CNC Machining Center lesson files from lesson.html.

  Teacher edition: everything, including <!--T--> ... <!--/T--> blocks (plan, agenda, answer keys).
  Student edition: those blocks are removed from the file itself, so no answer key ships to students.
Both inline three.js 0.128.0 (three.min.js) and its OrbitControls (OrbitControls.js), MIT licence, so the
files open offline from a double click.

Usage: python3 build.py      -> ../<name> - Teacher.html, ../<name> - Student.html
three.js and OrbitControls are read from ../../vendor/.
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')                 # the published files sit next to src/
VENDOR = os.path.join(HERE, '..', '..', 'vendor')  # three.js, shared by the lesson plans
VERSION = 'v1.0'
LIBS = {'/*@@THREE@@*/': 'three.min.js', '/*@@ORBIT@@*/': 'OrbitControls.js'}
APP = ('/*@@APP@@*/', 'app.js')   # the lesson's own script


def read(n):
    with open(os.path.join(HERE, n), encoding='utf-8') as f:
        return f.read()


def build(edition):
    s = read('lesson.html')
    for marker, name in LIBS.items():
        with open(os.path.join(VENDOR, name), encoding='utf-8') as f:
            lib = f.read()
        if '</script' in lib.lower():
            sys.exit('%s contains </script' % name)
        if marker not in s:
            sys.exit('lesson.html has no %s marker' % marker)
        s = s.replace(marker, '/* %s: three.js r128, MIT licence, https://threejs.org */\n%s' % (name, lib))
    app = read(APP[1])
    if '</script' in app.lower():
        sys.exit('app.js contains </script')
    s = s.replace(APP[0], app)
    if edition == 'Student':
        s = re.sub(r'<!--T-->.*?<!--/T-->', '', s, flags=re.S)
    else:
        s = s.replace('<!--T-->', '').replace('<!--/T-->', '')
    s = (s.replace('@@EDITION@@', edition).replace('@@EDCLASS@@', 'teacher-ed' if edition == 'Teacher' else '')
          .replace('@@VERSION@@', VERSION))
    for left in ('@@', '<!--T', '<!--/T'):
        if left in s:
            sys.exit('unfilled marker %r in %s edition' % (left, edition))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'CNC Machining Center - %s.html' % edition)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(s)
    print('wrote', os.path.normpath(path), '%d KB' % (len(s.encode()) // 1024))


for e in ('Teacher', 'Student'):
    build(e)

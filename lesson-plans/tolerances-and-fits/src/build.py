#!/usr/bin/env python3
"""Build the two standalone lesson files from lesson.html.

  Teacher edition: everything, including <!--T--> ... <!--/T--> blocks (plan, agenda, answer keys).
  Student edition: those blocks are removed from the file itself, so no answer key ships to students.
Both inline three.js (three.min.js, MIT licence header kept), so the files open offline from a double click.

Usage: python3 build.py      -> ../Tolerances and Fits - Teacher.html, ../Tolerances and Fits - Student.html
three.js is read from ../../vendor/three.min.js.
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..')                 # the published files sit next to src/
VENDOR = os.path.join(HERE, '..', '..', 'vendor')  # three.js, shared by the lesson plans
VERSION = 'v5.0'

def read(n):
    with open(os.path.join(HERE, n), encoding='utf-8') as f: return f.read()

def build(edition):
    s = read('lesson.html')
    with open(os.path.join(VENDOR, 'three.min.js'), encoding='utf-8') as f: three = f.read()
    if '</script' in three.lower(): sys.exit('three.min.js contains </script')
    s = s.replace('/*@@THREE@@*/', three)
    if edition == 'Student':
        s = re.sub(r'<!--T-->.*?<!--/T-->', '', s, flags=re.S)
    else:
        s = s.replace('<!--T-->', '').replace('<!--/T-->', '')
    s = (s.replace('@@EDITION@@', edition).replace('@@EDCLASS@@', 'teacher-ed' if edition == 'Teacher' else '')
          .replace('@@VERSION@@', VERSION))
    for left in ('@@', '<!--T', '<!--/T'):
        if left in s: sys.exit('unfilled marker %r in %s edition' % (left, edition))
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, 'Tolerances and Fits - %s.html' % edition)
    with open(path, 'w', encoding='utf-8') as f: f.write(s)
    print('wrote', os.path.normpath(path), '%d KB' % (len(s.encode()) // 1024))

for e in ('Teacher', 'Student'): build(e)

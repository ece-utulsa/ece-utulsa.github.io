#!/usr/bin/env python3
"""Independent recomputation for Phasor Lab v1.0.0 (developer test, not acceptance).

Reads tests/out/dev_result.json (written by dev_test.js from the rendered page) and
1. checks every spec §8 value against the text the page shows;
2. recomputes the 50 random cases with its own model (Q_1 at a held |E_A1| from the quadratic in Q, not the page's closed form)
   and requires each shown value to agree to the stated precision (within half a unit of the last shown digit).
Usage: python3 tests/check_values.py
"""
import cmath
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(HERE, 'out', 'dev_result.json'), encoding='utf-8'))
MINUS = '−'
results = []


def ok(name, cond, info=''):
    results.append((bool(cond), name, info))


def val(s):
    """First number in a shown string (true minus and thousands commas allowed)."""
    m = re.search(r'[−-]?[\d,]+(?:\.\d+)?', s)
    return float(m.group(0).replace(',', '').replace(MINUS, '-'))


def polar(s):
    """(magnitude, angle) of a shown phasor 'm∠a°'."""
    a, b = s.split('∠')
    return val(a), val(b)


def model(c):
    """Both machines for case c (dict as recorded by dev_test.js). Returns a dict of complex/real results."""
    V = c['VLL'] * 1e3 / math.sqrt(3)
    m = [c['m'][0], c['m'][0] if c['ident'] else c['m'][1]]
    Z = [complex(x['R'], x['X']) for x in m]
    QL = (1 if c['lagL'] else -1) * c['PL'] * math.tan(math.acos(c['pfL'])) if c['pfL'] < 0.9995 else 0.0
    P1 = c['P1']
    if c['by'] == 'pf':
        Q1 = 0.0 if c['pf1'] >= 0.9995 else (1 if c['lag1'] else -1) * P1 * math.tan(math.acos(c['pf1']))
    elif c['by'] == 'q':
        Q1 = c['Q1']
    else:   # |V + (P − jQ)Z/3V| = E: quadratic in Q; the larger root is the stable branch
        a = Z[0] / (3 * V)
        cc = V + a * P1 * 1e6
        d = -1j * a * 1e6
        A, B, C = abs(d) ** 2, 2 * (cc * d.conjugate()).real, abs(cc) ** 2 - c['E1'] ** 2
        Q1 = (-B + math.sqrt(B * B - 4 * A * C)) / (2 * A)
    P = [P1, c['PL'] - P1]
    Q = [Q1, QL - Q1]
    IL = complex(c['PL'], -QL) * 1e6 / (3 * V)
    I1 = complex(P[0], -Q[0]) * 1e6 / (3 * V)
    I = [I1, IL - I1]
    E = [V + I[k] * Z[k] for k in range(2)]
    return {'V': V, 'QL': QL, 'P': P, 'Q': Q, 'S': [abs(complex(P[k], Q[k])) for k in range(2)], 'IL': IL, 'I': I, 'E': E}


def near(shown, exact, dec):
    """Shown value agrees with the exact one to the stated precision (half a unit of the last digit, plus float noise)."""
    return abs(shown - exact) <= 0.5 * 10 ** -dec + 1e-6 * max(1, abs(exact))


def pf_of(P, Q):
    S = abs(complex(P, Q))
    return abs(P) / S if S > 1e-12 else 1.0


# ── 1. Random cases ──
bad = 0
for n, c in enumerate(R['cases']):
    t = c['page']['rows']
    x = model(c)
    errs = []
    for k in range(2):
        pairs = [('P (MW)', x['P'][k], 2), ('Q (Mvar)', x['Q'][k], 2), ('S (MVA)', x['S'][k], 2)]
        for name, exact, dec in pairs:
            if not near(val(t[name][k]), exact, dec):
                errs.append('%s G%d shown %s exact %.5f' % (name, k + 1, t[name][k], exact))
        im, ia = polar(t['IA (A)'][k])
        if not near(im, abs(x['I'][k]), 1) or not near(ia, math.degrees(cmath.phase(x['I'][k])), 1):
            errs.append('I G%d shown %s exact %.3f∠%.3f' % (k + 1, t['IA (A)'][k], abs(x['I'][k]), math.degrees(cmath.phase(x['I'][k]))))
        em, ea = polar(t['EA∠δ (V)'][k])
        if not near(em, abs(x['E'][k]), 0) or not near(ea, math.degrees(cmath.phase(x['E'][k])), 1):
            errs.append('E G%d shown %s exact %.2f∠%.3f' % (k + 1, t['EA∠δ (V)'][k], abs(x['E'][k]), math.degrees(cmath.phase(x['E'][k]))))
        pfs = t['pf'][k]
        if abs(x['Q'][k]) >= 0.005:
            kind = 'lag' if x['Q'][k] > 0 else 'lead'
            if not (pfs.endswith(kind) and near(val(pfs), pf_of(x['P'][k], x['Q'][k]), 2)):
                errs.append('pf G%d shown %s exact %.4f %s' % (k + 1, pfs, pf_of(x['P'][k], x['Q'][k]), kind))
        elif 'unity' not in pfs:
            errs.append('pf G%d shown %s, expected unity' % (k + 1, pfs))
        ec = x['E'][k].real
        if not near(val(t['EA cos δ (V)'][k]), ec, 0):
            errs.append('E cos d G%d shown %s exact %.2f' % (k + 1, t['EA cos δ (V)'][k], ec))
    note = c['page']['note']
    il = re.search(r'I_?L ?([\d,.]+∠[−\-\d.]+)', note.replace('IL', 'I_L'))
    if il:
        im, ia = polar(il.group(1))
        if not near(im, abs(x['IL']), 1) or not near(ia, math.degrees(cmath.phase(x['IL'])), 1):
            errs.append('I_L shown %s' % il.group(1))
    else:
        errs.append('I_L not found in the note')
    if errs:
        bad += 1
        print('case %d (%s, by %s): %s' % (n + 1, c['hold'], c['by'], '; '.join(errs)))
ok('random recomputation: %d cases agree to the stated precision' % len(R['cases']), bad == 0 and len(R['cases']) == 50, '%d disagree' % bad)

# ── 2. Spec §8 acceptance values as shown ──
A = R['acceptance']


def rows(t):
    return t['rows']


def shows(label, t, row, k, expect):
    got = rows(t)[row][k]
    ok('§8 %s: %s G%d shows %s' % (label, row, k + 1, expect), got.startswith(expect), 'page: ' + got)


d = A['default']
ok('§8 Default: V_φ 7,967 V', '7,967' in d['note'], d['note'])
ok('§8 Default: Q_L 7.44 Mvar', '7.44 Mvar' in d['note'], d['note'])
ok('§8 Default: I_L 590.6∠−31.8° A', '590.6∠−31.8°' in d['note'], d['note'])
for row, k, e in [('Q (Mvar)', 0, '2.56'), ('P (MW)', 1, '6.00'), ('Q (Mvar)', 1, '4.88'), ('pf', 1, '0.78 lag'), ('S (MVA)', 1, '7.73'),
                  ('IA (A)', 0, '272.8∠−23.1°'), ('IA (A)', 1, '323.6∠−39.1°'),
                  ('EA∠δ (V)', 0, '10,403∠20.8°'), ('EA∠δ (V)', 1, '11,760∠18.0°')]:
    shows('Default', d, row, k, e)
e1 = A['e1']
for row, k, ex in [('Q (Mvar)', 0, '0.00'), ('Q (Mvar)', 1, '7.44'), ('pf', 1, '0.63 lag'), ('S (MVA)', 1, '9.56'), ('IA (A)', 0, '251.0∠0.0°'),
                   ('IA (A)', 1, '399.8∠−51.1°'), ('EA∠δ (V)', 0, '8,949∠24.9°'), ('EA∠δ (V)', 1, '13,277∠15.6°')]:
    shows('E1', e1, row, k, ex)
e2 = A['e2']
for P, q1, q2, dl, ea2 in [(3, '3.51', '3.92', '9.9', '12,015∠27.5°'), (9, '0.89', '6.55', '32.7', '12,274∠8.0°')]:
    t = e2['p%d' % P]
    shows('E2 P1=%d' % P, t, 'Q (Mvar)', 0, q1)
    shows('E2 P1=%d' % P, t, 'Q (Mvar)', 1, q2)
    ok('§8 E2 P1=%d: δ1 %s°' % (P, dl), rows(t)['EA∠δ (V)'][0].endswith('∠' + dl + '°'), rows(t)['EA∠δ (V)'][0])
    shows('E2 P1=%d' % P, t, 'EA∠δ (V)', 1, ea2)
t6 = e2['p6']
ok('§8 E2 P1=6: as default', all(rows(t6)[r] == rows(d)[r] for r in rows(d)), str(rows(t6)))
ok('§8 E2: P_max at this field 16.06 MW (δ1 87.7°), above P_L', 'Pmax' in e2['p3']['steps'] and '16.06 MW (δ1 = 87.7°), above PL' in e2['p3']['steps'], re.search(r'At this field.*?PL\.', e2['p3']['steps']).group(0) if 'At this field' in e2['p3']['steps'] else '')
e3 = A['e3']
t = e3['e8949']
shows('E3 8,949 V', t, 'pf', 0, '1.00')
shows('E3 8,949 V', t, 'IA (A)', 0, '251.0')
shows('E3 8,949 V', t, 'Q (Mvar)', 1, '7.44')
t = e3['e11078']
shows('E3 11,078 V', t, 'pf', 0, '0.85 lag')
shows('E3 11,078 V', t, 'pf', 1, '0.85 lag')
shows('E3 11,078 V', t, 'Q (Mvar)', 0, '3.72')
shows('E3 11,078 V', t, 'Q (Mvar)', 1, '3.72')
shows('E3 11,078 V', t, 'IA (A)', 0, '295.3∠−31.8°')
shows('E3 11,078 V', t, 'IA (A)', 1, '295.3∠−31.8°')
t = e3['e12000']
shows('E3 12,000 V', t, 'Q (Mvar)', 0, '5.29')
shows('E3 12,000 V', t, 'Q (Mvar)', 1, '2.15')
shows('E3 12,000 V', t, 'IA (A)', 1, '266.6∠−19.7°')
ea2 = rows(t)['EA∠δ (V)'][1]
ok('§8 E3 12,000 V: E_A2 ∠21.4° (spec 10,167 V; model 10,167.76 V shows 10,168 — Flag 1)', ea2 == '10,168∠21.4°', ea2)
e3min = min(val(rows(e3[k])['IA (A)'][0]) for k in ['e8949', 'e11078', 'e12000'])
ok('§8 E3: |I_A1| smallest at unity pf (8,949 V)', e3min == val(rows(e3['e8949'])['IA (A)'][0]))
e4 = A['e4']
ok('§8 E4: Q_L −7.44', '−7.44 Mvar' in e4['note'], e4['note'])
for row, k, ex in [('Q (Mvar)', 0, '−2.56'), ('Q (Mvar)', 1, '−4.88'), ('pf', 1, '0.78 lead'), ('IA (A)', 1, '323.6∠39.1°'),
                   ('EA∠δ (V)', 0, '7,556∠30.5°'), ('EA∠δ (V)', 1, '6,377∠37.6°')]:
    shows('E4', e4, row, k, ex)
e5 = A['e5']
ok('§8 E5: currents as default', rows(e5)['IA (A)'] == rows(d)['IA (A)'], str(rows(e5)['IA (A)']))
shows('E5', e5, 'EA∠δ (V)', 1, '16,055∠27.5°')
ok('Steps: "Gen 2 carries more Q, so it needs the larger |E_A|" at the default', 'Gen 2 carries more Q, so it needs the larger |EA| (more field current).' in d['steps'])

fails = [r for r in results if not r[0]]
for r in results:
    print(('PASS ' if r[0] else 'FAIL ') + r[1] + ('' if r[0] else '  — ' + r[2]))
print('check_values.py: %d PASS, %d FAIL' % (len(results) - len(fails), len(fails)))
sys.exit(1 if fails else 0)

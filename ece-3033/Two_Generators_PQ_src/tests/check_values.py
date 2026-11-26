#!/usr/bin/env python3
"""Independent recomputation of the spec §5 acceptance values (complex arithmetic; no code shared with page.js).
Usage: python3 check_values.py   — prints each value as the page must show it. dev_test.js reads the same strings from the page."""
import cmath
import json
import math

V = 4160 / math.sqrt(3)
Z = complex(0.2, 4.5)
SP = 4 / (61 - 61 / 1.03)


def r1(x, d=1):
    """Round half away from zero to d decimals, as text with a true minus."""
    k = 10 ** d
    v = math.floor(abs(x) * k + 0.5 + 1e-9) / k
    return ('−' if x < 0 and v > 0 else '') + ('%.*f' % (d, v))


def pol(c, unit):
    """Polar text of a phasor: amperes to 0.1, volts whole with a comma, angle to 0.1°."""
    m = r1(abs(c)) if unit == 'A' else '{:,}'.format(int(math.floor(abs(c) + 0.5)))
    return '%s∠%s° %s' % (m, r1(math.degrees(cmath.phase(c))), unit)


def cur(P, Q):
    return complex(P, -Q) * 1e6 / (3 * V)


def q(P, pf):
    return 0.0 if pf >= 0.9995 else P * math.tan(math.acos(pf))


def share(L, f1, f2):
    f = (SP * (f1 + f2) - L) / (2 * SP)
    return f, SP * (f1 - f), SP * (f2 - f)


def pair(PL, QL, P1, Q1):
    IL, I1 = cur(PL, QL), cur(P1, Q1)
    I2 = IL - I1
    return dict(IL=IL, I1=I1, I2=I2, E1=V + I1 * Z, E2=V + I2 * Z, P2=PL - P1, Q2=QL - Q1, S2=math.hypot(PL - P1, QL - Q1))


def pf(P, Q):
    return 'unity' if abs(Q) < 0.005 else r1(P / math.hypot(P, Q), 2) + (' lag' if Q > 0 else ' lead')


out = {}
for L in (5, 7, 3):
    f, p1, _ = share(L, 61, 61)
    out['s1_%d' % L] = [r1(f, 2) + ' Hz', r1(p1) + ' MW']
f, p1, p2 = share(5, 61.244, 61)
out['s2_g1'] = [r1(f, 2) + ' Hz', r1(p1) + ' MW', r1(p2) + ' MW']
f, p1, p2 = share(5, 61.244, 60.977)
out['s2_both'] = [r1(f, 2) + ' Hz', r1(p1) + ' MW', r1(p2) + ' MW', r1(120 + 5 / SP, 2)]
d = pair(5, 3.75, 2.8, q(2.8, 0.9))
out['s3'] = [pol(d['IL'], 'A'), pol(d['I1'], 'A'), pol(d['I2'], 'A'), pol(d['E1'], 'V'), pol(d['E2'], 'V')]
d = pair(5, 3.75, 2.8, 0)
out['s3_unity'] = [pol(d['I1'], 'A'), pol(d['I2'], 'A'), r1(d['S2']) + ' MVA', pol(d['E1'], 'V'), pol(d['E2'], 'V')]
d = pair(5, 3.75, 2.8, q(2.8, 0.9))
out['s4_start'] = ['Q1 ' + r1(q(2.8, 0.9)), 'Q2 ' + r1(d['Q2'])]
d = pair(5, 3.75, 2.8, 2.5)
out['s4_moved'] = ['Q2 ' + r1(d['Q2']), pol(d['E1'], 'V'), pol(d['E2'], 'V'), pf(2.8, 2.5), pf(2.2, d['Q2'])]
QL, Q1 = q(4.4, 0.85), q(2.4, 0.92)
d = pair(4.4, QL, 2.4, Q1)
out['s5'] = [r1(QL) + ' Mvar', pol(d['IL'], 'A'), r1(Q1) + ' Mvar', pol(d['I1'], 'A'), r1(d['P2']) + ' MW', r1(d['Q2']) + ' Mvar', pf(d['P2'], d['Q2']), pol(d['I2'], 'A'), pol(d['E2'], 'V')]
f, p1, _ = share(6, 61, 61)
out['e1'] = [r1(f, 2) + ' Hz', r1(p1) + ' MW']
out['e2'] = [r1((120 + 6 / SP) / 2, 2) + ' Hz', r1(120 + 6 / SP, 2)]
d = pair(5, 3.75, 2.8, 2.1)
out['e3'] = [pf(2.8, 2.1), pf(2.2, d['Q2']), '{:,}'.format(round(abs(d['E1']))) + ' V']
out['e4'] = [r1(3.75 - math.sqrt(16 - 2.2 ** 2)), r1(math.sqrt(16 - 2.8 ** 2))]
QL, Q1 = q(5.6, 0.85), q(3.2, 0.95)
d = pair(5.6, QL, 3.2, Q1)
out['e5'] = [r1(d['P2']) + ' MW', r1(d['Q2']) + ' Mvar', r1(d['Q2'], 3), pf(d['P2'], d['Q2']), pol(d['I2'], 'A'), pol(d['E2'], 'V'), pol(d['IL'], 'A'), pol(d['I1'], 'A')]
out['e5_raw'] = [d['P2'], d['Q2'], d['P2'] / d['S2'], abs(d['I2']), abs(d['E2']), math.degrees(cmath.phase(d['E2']))]
print(json.dumps(out, ensure_ascii=False, indent=1))

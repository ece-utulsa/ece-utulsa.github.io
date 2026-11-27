#!/usr/bin/env python3
"""Independent recomputation of the spec §5 acceptance values (no code shared with page.js).
Usage: python3 check_values.py   — prints each value as the page must show it (JSON). dev_test.js reads the same strings from the page."""
import json
import math

FN = [61.0, 61.5, 60.8]
SD = [3.0, 4.0, 2.5]


def r(x, d=1):
    """Round half away from zero to d decimals, as text with a true minus."""
    k = 10 ** d
    v = math.floor(abs(x) * k + 0.5 + 1e-9) / k
    return ('−' if x < 0 and v > 0 else '') + ('%.*f' % (d, v))


def sgn(x):
    t = r(x)
    return t if t.startswith('−') else '+' + t


def rpm(f):
    return '{:,}'.format(int(math.floor(f * 30 + 0.5))) + ' r/min'


def sp(sd, fn0):
    ffl = fn0 / (1 + sd / 100)
    return 100 / (fn0 - ffl)


SP = [sp(d, f) for d, f in zip(SD, FN)]


def share(L, fn, s=SP):
    f = (sum(a * b for a, b in zip(s, fn)) - L) / sum(s)
    return f, [a * (b - f) for a, b in zip(s, fn)]


out = {}
ffl = 61 / 1.03
f50 = 61 - 50 / SP[0]
out['s1'] = ['61.00 Hz (' + rpm(61) + ')', r(ffl, 2) + ' Hz (' + rpm(ffl) + ')', '3.0 %', r(SP[0]) + ' MW/Hz', r(f50, 2) + ' Hz', rpm(f50)]
out['s2'] = []
for fn in (61.0, 61.421, 59.8):
    P = SP[0] * (fn - 60)
    out['s2'].append([r(fn, 2) + ' Hz', 'PG1 = ' + r(P) + ' MW', r(150 - P) + ' MW'])
f150, p150 = share(150, FN)
f210, p210 = share(210, FN)
out['s3'] = [r(f150, 2) + ' Hz', [r(x) for x in p150], r(f210, 2) + ' Hz', [r(x) for x in p210], [sgn(b - a) for a, b in zip(p150, p210)]]
f4, p4 = share(210, [61.0, 61.5, 61.34])
out['s4'] = [r(f4, 2) + ' Hz', [r(x) for x in p4]]
f5, p5 = share(180, FN)
P2, P3 = SP[1] * 1.5, SP[2] * 0.8
P1 = 180 - P2 - P3
out['s5'] = [r(sum(SP)), r(f5, 2) + ' Hz', [r(x) for x in p5], r(P2), r(P3), r(P1), r(60 + P1 / SP[0], 2) + ' Hz']
s3e = [SP[0], SP[1], sp(5.0, 60.8)]
a, pa = share(150, FN, s3e)
b, pb = share(210, FN, s3e)
out['e1'] = [sgn(y - x) for x, y in zip(pa, pb)] + [sgn(p210[2] - p150[2])]
at60 = [s * (f - 60) for s, f in zip(SP, FN)]
out['e2'] = [r(240 - sum(at60) + at60[k]) for k in range(3)]
out['e3'] = ['60.00 Hz']
loads = []
for k in range(3):
    f = FN[k] - 100 / SP[k]
    loads.append((sum(s * (fn - f) for s, fn in zip(SP, FN)), k, f))
loads.sort()
out['e4'] = ['G%d' % (loads[0][1] + 1), r(loads[0][0]) + ' MW', r(loads[0][2], 2) + ' Hz']
f, p = share(240, FN)
out['e5'] = [r(f, 2) + ' Hz', [r(x) for x in p]]
out['e5_raw'] = [f] + p
print(json.dumps(out, ensure_ascii=False, indent=1))

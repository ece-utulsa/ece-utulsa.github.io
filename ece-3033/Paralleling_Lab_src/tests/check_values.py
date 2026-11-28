#!/usr/bin/env python3
"""Independent recomputation of the Paralleling Lab v2.0.0 spec §4 values (developer test, not acceptance).

Reads tests/out/dev_result.json (written by dev_test.js from the rendered page), recomputes each §4 value from the model in spec §2
with its own code, and checks that the page shows it (at the page's precision). Usage: python3 tests/check_values.py
"""
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
V = json.load(open(os.path.join(HERE, 'out', 'dev_result.json'), encoding='utf-8'))['values']
VLL, S_RATED, POLES, F = 13.8, 25.0, 4, 60.0
VPH = VLL / math.sqrt(3)
XS = VLL ** 2 / S_RATED
IR = S_RATED * 1e3 / (math.sqrt(3) * VLL)
SP = S_RATED / (0.04 * F)
results = []


def ok(name, cond, info=''):
    results.append((bool(cond), name, info))


def dv(vg_ll, th_deg):
    """Voltage across a breaker pole (kV per phase) for G3 at vg_ll (kV line) and angle th (deg), sequence ABC."""
    vg = vg_ll / math.sqrt(3)
    t = math.radians(th_deg)
    return math.hypot(VPH - vg * math.cos(t), vg * math.sin(t))


def has(s, sub, name):
    ok(name + ': shows "' + sub + '"', sub in s, s[:200])


# Slide 1
has(V['s1']['day'], 'bus 13.80 kV, 60.00 Hz (constant)', 'Slide 1')
has(V['s1']['day'], '14 of 14', 'Slide 1 switching events (as v1.4.0)')
# Slide 2
has(V['s2a']['n'], '%d r/min' % round(120 * F / POLES), 'Slide 2 speed for 60 Hz')
has(V['s2a']['fg'], '60.00 Hz', 'Slide 2 f_g')
has(V['s2b']['vg'], '13.80 kV', 'Slide 2 V_g')
# Slide 3
vg3 = 0.85 * VLL
has(V['s3a']['vg'], '%.2f kV' % vg3, 'Slide 3 V_g line')
has(V['s3a']['rl'], '%.2f − %.2f = %.2f kV' % (VPH, vg3 / math.sqrt(3), VPH - vg3 / math.sqrt(3)), 'Slide 3 darkest lamp')
I3 = dv(vg3, 0) * 1e3 / XS
has(V['s3b']['result'], '= %d A = %.2f × rated' % (round(I3), I3 / IR), 'Slide 3 close')
Q3 = 3 * VPH * (vg3 / math.sqrt(3) - VPH) / XS
ok('Slide 3 Q: exact %.4f MVAR; page "%s" (spec −3.7; Flag)' % (Q3, re.search(r'Q ≈[^=]*= ([^ ]+) MVAR', V['s3b']['result']).group(1)), abs(abs(Q3) - 3.75) < 1e-9)
# Slide 4
has(' '.join(V['s4a']['rl'].split()), 'ACB', 'Slide 4 sequence')
ok('Slide 4: poles B, C %.2f kV when lamp A dark' % (math.sqrt(3) * VPH), V['s4b']['lamps'] == ['0.00 kV', '%.2f kV' % (math.sqrt(3) * VPH), '%.2f kV' % (math.sqrt(3) * VPH)], str(V['s4b']['lamps']))
has(V['s4c']['tag'], 'TRIPPED', 'Slide 4 close in ACB')
# Slide 5
for k, th in (('s5a', 90), ('s5b', 180)):
    d = dv(VLL, th)
    has(V[k]['result'], '%.2f kV / %.2f Ω = %d A = %.2f × rated' % (d, XS, round(d * 1e3 / XS), d * 1e3 / XS / IR), 'Slide 5 %d°' % th)
    has(V[k]['tag'], 'TRIPPED', 'Slide 5 %d° trip' % th)
# Slide 6
has(V['s6a']['rl'], '0.20 blinks/s', 'Slide 6 60.20 Hz')
has(V['s6f']['result'], '%+.1f MW (generating)' % (SP * 0.10), 'Slide 6 fast')
has(V['s6s']['result'], '−%.1f MW (motoring' % abs(SP * -0.05), 'Slide 6 slow')
has(V['s6x']['tag'], 'TRIPPED', 'Slide 6 +1 Hz')
# Slide 7
wk = ' '.join(V['s7']['wk'])
d7 = dv(13.62, 6)
for sub in ['−%.1f %%' % abs((13.62 - VLL) / VLL * 100), 'Δθ = 6.0°', '+0.12 Hz', '= %.2f kV per phase' % d7, '= %d A = %.2f × rated: smooth' % (round(d7 * 1e3 / XS), d7 * 1e3 / XS / IR), '10.4 × 0.12 = 1.2 MW']:
    has(wk, sub, 'Slide 7')
ok('Slide 7 P: exact s_P × 0.12 = %.4f MW (a rounding tie; page and spec 1.2 — Flag)' % (SP * 0.12), True)
has(V['s7']['ready'], 'Ready', 'Slide 7 ready')
# E3–E5 as v1.4.0
for k, th, a in (('e3a', 90, 1479), ('e3b', 180, 2092), ('e3c', 5, 91)):
    has(V[k]['surge'], '%d A' % a, 'E3 %d°' % th)
    ok('E3 %d°: recomputed %d A' % (th, round(dv(VLL, th) * 1e3 / XS)), round(dv(VLL, th) * 1e3 / XS) == a)
vg4 = VLL * 3 / 5 * 60.05 / 60
ok('E4: lamp at Δθ ≈ 0 shows %.2f kV' % (VPH - vg4 / math.sqrt(3)), '%.2f kV' % (VPH - vg4 / math.sqrt(3)) in V['e4open']['lamps'], str(V['e4open']['lamps']))
has(V['e4']['surge'], '418 A', 'E4 surge')
has(V['e5']['result'], '−1.0 MW (motoring', 'E5')
has(V['e6']['tag'], 'IN STEP', 'E6 clean close')
ok('E6: checklist all ✓', all(V['e6steps']) and all(V['e6card']))

fails = [r for r in results if not r[0]]
for r in results:
    print(('PASS ' if r[0] else 'FAIL ') + r[1] + ('' if r[0] else '  — ' + r[2]))
print('check_values.py: %d PASS, %d FAIL' % (len(results) - len(fails), len(fails)))
sys.exit(1 if fails else 0)

#!/usr/bin/env python3
"""C1 for Laplace Lecture 2 v1.0.0: every pair, property example and the Your-turn key, by two routes
(sympy laplace_transform, and numeric quadrature of the defining integral at test points)."""
import sympy as sp, mpmath as mp, json
t, s = sp.symbols('t s', positive=True)
a, w, th = sp.symbols('a omega theta', positive=True)
n = 3  # test order for the t^n rows
L = lambda f: sp.laplace_transform(f, t, s, noconds=True)
PAIRS = [  # name, f(t), F(s) as printed on the page
 ('u', sp.Integer(1), 1/s), ('exp', sp.exp(-a*t), 1/(s+a)), ('t', t, 1/s**2),
 ('t^n', t**n, sp.factorial(n)/s**(n+1)), ('t exp', t*sp.exp(-a*t), 1/(s+a)**2),
 ('t^n exp', t**n*sp.exp(-a*t), sp.factorial(n)/(s+a)**(n+1)),
 ('sin', sp.sin(w*t), w/(s**2+w**2)), ('cos', sp.cos(w*t), s/(s**2+w**2)),
 ('sin+th', sp.sin(w*t+th), (s*sp.sin(th)+w*sp.cos(th))/(s**2+w**2)),
 ('cos+th', sp.cos(w*t+th), (s*sp.cos(th)-w*sp.sin(th))/(s**2+w**2)),
 ('exp sin', sp.exp(-a*t)*sp.sin(w*t), w/((s+a)**2+w**2)),
 ('exp cos', sp.exp(-a*t)*sp.cos(w*t), (s+a)/((s+a)**2+w**2)),
 ('linearity (2t+4)u', 2*t+4, (4*s+2)/s**2), ('2t', 2*t, 2/s**2), ('4u', sp.Integer(4), 4/s),
 ('sin 4t', sp.sin(4*t), 4/(s**2+16)), ('e^-2t sin 4t', sp.exp(-2*t)*sp.sin(4*t), 4/((s+2)**2+16)),
 ('your turn', 10*sp.exp(-3*t)*sp.cos(4*t), 10*(s+3)/((s+3)**2+16)),
 ('your turn expanded', 10*sp.exp(-3*t)*sp.cos(4*t), 10*(s+3)/(s**2+6*s+25)),
]
out = {}
num = {a: 1.3, w: 2.1, th: 0.7}
for name, f, F in PAIRS:
    r1 = sp.simplify(L(f) - F) == 0                       # route 1: symbolic
    fn = sp.lambdify(t, f.subs(num), 'mpmath'); worst = 0  # route 2: quadrature of the definition
    for sv in (0.5, 1.7, 4.0):
        q = mp.quad(lambda x: fn(x)*mp.exp(-sv*x), mp.linspace(0, 200, 401))
        worst = max(worst, abs(q - complex(F.subs(num).subs(s, sv))))
    out[name] = [bool(r1), float(worst)]
    assert r1 and worst < 1e-8, (name, r1, worst)
# delta: sifting, exp(-s*0) = 1
assert sp.integrate(sp.DiracDelta(t-sp.Rational(1,10**6))*sp.exp(-s*t), (t, 0, sp.oo)).subs(s, 2) - 1 < 1e-5
# time shift: f = 3u(t) - 5u(t-1) + 2u(t-2); levels 3, -2, 0; F = 3/s - 5e^-s/s + 2e^-2s/s
tt = sp.symbols('t', real=True); H = sp.Heaviside
f = 3*H(tt) - 5*H(tt-1) + 2*H(tt-2)
assert [f.subs(tt, x) for x in (sp.Rational(1,2), sp.Rational(3,2), 3)] == [3, -2, 0]
F = 3/s - 5*sp.exp(-s)/s + 2*sp.exp(-2*s)/s
r1 = sp.simplify(sp.laplace_transform(f, tt, s, noconds=True) - F) == 0
direct = sp.integrate(3*sp.exp(-s*tt), (tt, 0, 1)) + sp.integrate(-2*sp.exp(-s*tt), (tt, 1, 2))  # route 2: piecewise integral
r2 = sp.simplify(direct - F) == 0
assert r1 and r2; out['time shift'] = [bool(r1), bool(r2)]
# properties printed in the reference column, checked on f = e^{-at} sin(wt), F = w/((s+a)^2+w^2)
f0 = sp.exp(-a*t)*sp.sin(w*t); F0 = w/((s+a)**2+w**2); k = sp.Rational(3, 2)
chk = {
 'scaling': sp.simplify(L(f0.subs(t, k*t)) - F0.subs(s, s/k)/k) == 0,
 'time differentiation': sp.simplify(L(sp.diff(f0, t)) - (s*F0 - f0.subs(t, 0))) == 0,
 'time integration': abs(mp.quad(lambda x: mp.quad(lambda y: mp.exp(-1.3*y)*mp.sin(2.1*y), [0, x])*mp.exp(-1.7*x), mp.linspace(0, 200, 401)) - complex(F0.subs(num).subs(s, 1.7))/1.7) < 1e-8,
 'frequency differentiation': sp.simplify(L(t*f0) + sp.diff(F0, s)) == 0,
 'initial value': sp.limit(s*F0, s, sp.oo) == f0.subs(t, 0),
 'final value': sp.limit(s*F0, s, 0) == sp.limit(f0, t, sp.oo),
 'convolution': sp.simplify(L(sp.integrate(sp.exp(-a*sp.Symbol('x'))*sp.exp(-2*a*(t-sp.Symbol('x'))), (sp.Symbol('x'), 0, t))) - 1/((s+a)*(s+2*a))) == 0,
}
# frequency integration on f = sin(wt): L{sin(wt)/t} = atan(w/s) = integral_s^oo w/(x^2+w^2) dx ; numeric
fi = mp.quad(lambda x: mp.sin(2.1*x)/x*mp.exp(-1.7*x), mp.linspace(0, 80, 400)); chk['frequency integration'] = abs(fi - mp.atan(2.1/1.7)) < 1e-8
# periodicity on a unit square pulse train, T = 2, first period F1 = (1 - e^-s)/s ; numeric over 40 periods
pv = sum(mp.quad(lambda x: mp.exp(-1.7*x), [2*k_, 2*k_+1]) for k_ in range(40)); F1 = (1-mp.exp(-1.7))/1.7
chk['time periodicity'] = abs(pv - F1/(1-mp.exp(-1.7*2))) < 1e-10
assert all(chk.values()), chk
out['properties'] = {k_: bool(v) for k_, v in chk.items()}
json.dump(out, open('c1_laplace_l2.json', 'w'), indent=1); print(json.dumps(out)); print('C1 PASS')

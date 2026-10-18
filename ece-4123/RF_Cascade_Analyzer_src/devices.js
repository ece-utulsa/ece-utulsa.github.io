/* RF Cascade Analyzer — View 2, Devices: one device at a time as a clean two-port, driven one port at a time (Forward:
   a1 = 1∠0°, a2 = 0; Reverse: a2 = 1∠0°, a1 = 0, slide 12). The ports carry the normalized waves a = V⁺/√Z0 and
   b = V⁻/√Z0 (no units; power is |wave|²) in the signal-flow arrangement: a1 in and b1 out at port 1 (top, bottom),
   b2 out and a2 in at port 2 (top, bottom). Inside the box there are only paths and their S labels: S21 a straight lane
   along the top and S12 along the bottom, each tapering with power from W0 (input power 1) to W0·|S|² (capped at 3 W0
   with a break mark; a blocked lane closes to a point with a red ✕), and S11, S22 as reflection U-turns at their ports.
   The paths the drive does not use fade. Below: the matrix equation with a numeric line for the drive, and the four
   property badges. Next/Previous step through the device list. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — device list, path widths, layout
   2. State            — per-device parameters, current device
   3. Two-port drawing — box, power-tapered lanes, reflection U-turns, S labels, normalized waves at the ports
   4. Matrix and badges — symbolic equation, numeric line for the drive, property badges
   5. Panel            — the power out, the device's controls, one line of explanation
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DEVICES = ['through', 'atten', 'amp', 'iso', 'custom'];
const DEV_NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator', custom: 'Custom' };
const S_ZERO = 0.005;            // |S| or a wave below this is labelled 0
const S_BLOCK = 0.05;            // |S| below this: a lane is drawn blocked (wedge and ✕), a U-turn as a dotted outline
const ISO_MAX = 60;              // isolator reverse-isolation slider: 0..60 dB, then ∞
const MAG_MAX = 2;               // Custom |S| slider range
const W0 = 36;                   // lane width for power 1 (the input); a path's width is W0·|S|²
const W_CAP = 3;                 // widths above 3 W0 are capped and drawn with a break mark
const U_MIN = 3;                 // a U-turn's stroke is never thinner than this
/* Layout (design units = px at 1280×720). The matrix, numeric line and badges are stacked from the bottom up (gaps as in
   v1.2.0: badges 12 above the bottom, numeric line 12 above the badges); the box takes the height left above them.
   Inside the box the S21 lane runs laneT below its top and the S12 lane laneB above its bottom, leaving room for their
   labels even at the 3 W0 cap. edge: labels keep 16 from the drawing's sides; wires start at the edge. */
const LY_D = { xl: 240, xr: 660, top: 8, laneT: 118, laneB: 92, edge: 16, uDepth: 105, uIn: 28, labGap: 12, badgeH: 42, gapEdge: 12,
               numH: 30, gapNum: 12, matHalf: 54, gapMat: 8, gapBox: 20, wireUp: 32, wireDown: 34 };
// Vertical positions for a drawing H units tall: badge, numeric line and matrix centres, box bottom.
function geoD(H){
  const L = LY_D, badge = H - L.gapEdge - L.badgeH / 2, num = badge - L.badgeH / 2 - L.gapNum - L.numH / 2;
  const mat = num - L.numH / 2 - L.gapMat - L.matHalf, bb = mat - L.matHalf - L.gapBox;
  return { badge, num, mat, bb };
}
const FS_OUT = 22;               // the driven output's wave label (b2 Forward, b1 Reverse): larger and bold
const FADE = 0.22;               // opacity of the paths the current drive does not use
const DOT_OP = 0.45;             // opacity of a blocked U-turn's dotted outline
const FS_NUM = 22;               // numeric line under the matrix equation
const DRIVE_PATHS = { fwd: ['s11', 's21'], rev: ['s12', 's22'] };   // paths excited by a1 (Forward) or a2 (Reverse)
const FRACTIONS = [[1 / 8, 'λ/8'], [1 / 4, 'λ/4'], [3 / 8, '3λ/8'], [1 / 2, 'λ/2'], [5 / 8, '5λ/8'], [3 / 4, '3λ/4'], [7 / 8, '7λ/8'], [1, 'λ'], [0, '0']];
const BADGES = [['reciprocal', 'Reciprocal'], ['symmetric', 'Symmetric'], ['lossless', 'Lossless'], ['passive', 'Passive']];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
// A Custom entry set { s11: [mag, deg], ... } (the Teaching example: reciprocal, lossy, not symmetric).
const customDefault = () => ({ s11: [0.3, 40], s21: [0.6, -70], s12: [0.6, -70], s22: [0.4, -20] });
const D = { dev: 'through', drive: 'fwd', through: { l: 0.25 }, atten: { A: 3 }, amp: { G: 10 }, iso: { IL: 0.5, I: Infinity },
            custom: { e: customDefault(), recip: true } };
// S of a Custom entry set.
const customS = e => devPolar(e.s11, e.s21, e.s12, e.s22);
// S of device kind with parameters p.
function deviceS(kind, p){
  switch(kind){
    case 'through': return galleryS('through', { bl: FULL_TURN * p.l });
    case 'atten': return galleryS('atten', { A: p.A });
    case 'amp': return galleryS('amp', { G: p.G, I: Infinity });
    case 'iso': return galleryS('isolator', { IL: p.IL, I: p.I });
  }
  return customS(p.e);
}
// Line length ℓ/λ as text: a named fraction when exact, else 2 decimals.
function lenText(l){ const f = FRACTIONS.find(([v]) => Math.abs(v - l) < 1e-9); return f ? f[1] : fx(l, 2) + 'λ'; }
// |S| to 2 decimals with the angle only where it isn't 0 (and the entry isn't 0).
function sText(c){
  const m = cabs(c); if(m < S_ZERO) return '0';
  const a = Math.round(wrapDeg(carg(c) * DEG)); return fx(m, 2) + (a === 0 ? '' : ANGLE_SIGN + fx(a === -HALF_TURN ? HALF_TURN : a, 0) + '°');
}
// Signed dB text with one decimal ("+10 dB", "−6 dB"; whole numbers lose the ".0").
function dbText(db){ if(db === Infinity) return '∞ dB'; const r = Math.round(db * 10) / 10, t = Number.isInteger(r) ? fx(r, 0) : fx(r, 1); return (r > 0 ? '+' : '') + t + ' dB'; }
// A normalized-wave value: "0" for zero, else |w| with the angle always shown: 2 decimals below 1 ("0.71∠0°"), 3
// significant figures from 1 up ("1.41∠0°", "10.0∠0°"); the unit drive wave is written "1∠0°".
const magText = m => (m >= 1 ? (+m.toPrecision(3)).toPrecision(3) : fx(m, 2));
function waveText(c){
  const m = cabs(c); if(m < S_ZERO) return '0';
  const a = Math.round(wrapDeg(carg(c) * DEG)), ang = ANGLE_SIGN + fx(a === -HALF_TURN ? HALF_TURN : a, 0) + '°';
  return (Math.abs(m - 1) < 1e-12 && Math.abs(a) < 1e-9 ? '1' : magText(m)) + ang;
}
// The waves at the ports for the current drive (port 2 or 1 terminated in Z0, so the other incident wave is 0).
const deviceWaves = S => drive(S, D.drive, ZERO);
// ── END STATE ─────────────────────────────────────────────────

// ── TWO-PORT DRAWING ──────────────────────────────────────────
// A thin line arrow from x0 to x1 along y (a normalized wave at a port); a ghost (dotted, faint) when the wave is 0.
function lineArrow(x0, x1, y, col, ghost, q, v){
  const dir = Math.sign(x1 - x0);
  return el('g', { class: 'wave', opacity: ghost ? 0.4 : null, 'data-q': q, 'data-v': q ? +v.toPrecision(12) : null, 'data-ghost': ghost ? 1 : null },
    el('path', { d: 'M' + n2(x0) + ' ' + n2(y) + 'H' + n2(x1 - dir * 12), stroke: col, 'stroke-width': 3, fill: 'none', 'stroke-dasharray': ghost ? DOTS : null })
    + el('path', { d: 'M' + n2(x1) + ' ' + n2(y) + 'l' + n2(-dir * 14) + ' -8v16Z', fill: ghost ? 'none' : col, stroke: col, 'stroke-width': ghost ? 1.5 : 0 }));
}
// Width of a path for power p = |S|²: W0·p, capped at W_CAP·W0.
const pathW = p => W0 * Math.min(p, W_CAP);
/* A lane from x0 (width W0) to x1 (width w1 for power p) along y, arrowhead at x1. A blocked lane (|S| < S_BLOCK) is a
   wedge closing to a point at x1, with a red ✕ just outside the box there. Above the cap a break mark crosses the lane
   90 units past its centre. k: the S key; the lane carries data-q / data-v (|S|) and its end width for the tests.
   Returns { svg, mark }: mark (the ✕) is drawn outside the lane's group, so it stays strong when the lane fades. */
function laneSvg(k, x0, x1, y, m){
  const d = Math.sign(x1 - x0), p = m * m, col = 'var(--' + k + ')', len = Math.abs(x1 - x0), at = { class: 'lane ' + k, 'data-q': S_NAME[k], 'data-v': +m.toPrecision(12) };
  if(m < S_BLOCK){ const xx = x1 + d * 14;
    return { svg: el('path', Object.assign(at, { d: 'M' + x0 + ' ' + n2(y - W0 / 2) + 'L' + x1 + ' ' + n2(y) + 'L' + x0 + ' ' + n2(y + W0 / 2) + 'Z', fill: col, 'data-w1': 0, 'data-blocked': 1 })),
      mark: el('g', { class: 'xmark', 'data-s': k }, crossMark(xx, y, 11, 'var(--bad)')) }; }
  const w1 = pathW(p), head = 22, xb = x1 - d * head, wb = W0 + (w1 - W0) * (len - head) / len, hw = Math.max(w1, 4) / 2 + 9;
  let s = el('path', Object.assign(at, { d: 'M' + x0 + ' ' + n2(y - W0 / 2) + 'L' + xb + ' ' + n2(y - wb / 2) + 'L' + xb + ' ' + n2(y - hw) + 'L' + x1 + ' ' + n2(y)
    + 'L' + xb + ' ' + n2(y + hw) + 'L' + xb + ' ' + n2(y + wb / 2) + 'L' + x0 + ' ' + n2(y + W0 / 2) + 'Z', fill: col, 'data-w1': n2(w1), 'data-capped': p > W_CAP ? 1 : null }));
  if(p > W_CAP){ const xm = (x0 + x1) / 2 + d * 90, wm = W0 + (w1 - W0) * Math.abs(xm - x0) / len;
    s += el('path', { d: 'M' + n2(xm - 8) + ' ' + n2(y + wm / 2 + 4) + 'L' + n2(xm + 2) + ' ' + n2(y - wm / 2 - 4) + 'M' + n2(xm + 6) + ' ' + n2(y + wm / 2 + 4) + 'L' + n2(xm + 16) + ' ' + n2(y - wm / 2 - 4),
      stroke: 'var(--bg)', 'stroke-width': 5, class: 'brk' }); }
  return { svg: s, mark: '' };
}
/* A reflection U-turn inside the box at a port: from just below/above the port's in-wire, uDepth into the box, back out
   beside the out-wire with an arrowhead pointing out of the port. Stroke W0·|S|² (at least U_MIN); a dotted outline when
   |S| < S_BLOCK. Returns { svg, reach } where reach is the U's furthest x from the port edge including half its stroke. */
function uTurnSvg(k, xe, yIn, yOut, m){
  const d = xe < DESIGN_W / 2 ? 1 : -1, xc = xe + d * LY_D.uDepth, col = 'var(--' + k + ')', path = 'M' + xe + ' ' + n2(yIn) + 'C' + xc + ' ' + n2(yIn) + ' ' + xc + ' ' + n2(yOut) + ' ' + xe + ' ' + n2(yOut);
  const at = { class: 'uturn ' + k, 'data-q': S_NAME[k], 'data-v': +m.toPrecision(12), fill: 'none' };
  if(m < S_BLOCK) return { svg: el('path', Object.assign(at, { d: path, stroke: col, 'stroke-width': 2, 'stroke-dasharray': '4 6', opacity: DOT_OP, 'data-w1': 0, 'data-blocked': 1 })), reach: LY_D.uDepth * 0.75 + 1 };
  const w = Math.max(U_MIN, pathW(m * m)), xt = xe - d * 16;
  return { svg: el('path', Object.assign(at, { d: path, stroke: col, 'stroke-width': n2(w), 'data-w1': n2(w) }))
    + el('path', { d: 'M' + n2(xt) + ' ' + n2(yOut) + 'L' + n2(xe + d * 6) + ' ' + n2(yOut - w / 2 - 8) + 'L' + n2(xe + d * 6) + ' ' + n2(yOut + w / 2 + 8) + 'Z', fill: col, class: 'uhead' }),
    reach: LY_D.uDepth * 0.75 + w / 2 };
}
/* The two-port for device kind/params p in a drawing H units tall: a plain box holding the S21 and S12 lanes and the S11,
   S22 U-turns with their S labels; outside it the four wires with their normalized-wave labels and "Port 1", "Port 2". */
function drawTwoPort(H, kind, p){
  const S = deviceS(kind, p), w = deviceWaves(S), on = DRIVE_PATHS[D.drive], fwd = D.drive === 'fwd', L = LY_D, G = geoD(H);
  const xl = L.xl, xr = L.xr, by = L.top, bb = G.bb, yT = by + L.laneT, yB = bb - L.laneB, mid = (yT + yB) / 2, cx = (xl + xr) / 2;
  const M = k => cabs(S[k]), op = k => (on.includes(k) ? null : FADE), wEnd = k => (M(k) < S_BLOCK ? 0 : pathW(M(k) ** 2));
  let s = el('rect', { x: xl, y: by, width: xr - xl, height: bb - by, rx: 14, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 3, class: 'box' });
  // paths: the faded ones first so the driven ones sit on top
  const u11 = uTurnSvg('s11', xl + 2, yT + L.uIn, yB - L.uIn, M('s11')), u22 = uTurnSvg('s22', xr - 2, yB - L.uIn, yT + L.uIn, M('s22'));
  const l21 = laneSvg('s21', xl, xr, yT, M('s21')), l12 = laneSvg('s12', xr, xl, yB, M('s12')), parts = { s21: l21.svg, s12: l12.svg, s11: u11.svg, s22: u22.svg };
  S_KEYS.slice().sort((a, b) => on.includes(a) - on.includes(b)).forEach(k => { s += el('g', { class: 'pathg ' + k, 'data-s': k, 'data-live': on.includes(k) ? 1 : 0, opacity: op(k) }, parts[k]); });
  s += l21.mark + l12.mark;
  // S labels: S21 above the top lane and S12 below the bottom lane, clear of their widest points; S11 right of its U-turn
  // just below the top lane, S22 left of its U-turn just above the bottom lane (staggered, so they never meet)
  const half = 14, lab = (k, x, y, anchor, size) => txt(x, y, 'S_' + k.slice(1) + ' ' + sText(S[k]), { anchor, size, fill: 'var(--' + k + ')', cls: 'slabel', id: 'v' + k });
  const wAt = (k, frac) => W0 + (wEnd(k) - W0) * frac;   // a lane's width a fraction of the way along it
  const x11 = xl + u11.reach + 12, x22 = xr - u22.reach - 12;
  const top11 = yT + Math.max(wAt('s21', (x11 - xl) / (xr - xl)), wAt('s21', 0.62)) / 2 + L.labGap, bot22 = yB - Math.max(wAt('s12', (xr - x22) / (xr - xl)), wAt('s12', 0.62)) / 2 - L.labGap;
  s += lab('s21', cx, yT - Math.max(W0, wEnd('s21')) / 2 - L.labGap - 16, 'middle', 22) + lab('s12', cx, yB + Math.max(W0, wEnd('s12')) / 2 + L.labGap + 16, 'middle', 22);
  s += lab('s11', x11, Math.min(top11 + half, mid - 4), 'start', 20) + lab('s22', x22, Math.max(bot22 - half, mid + 26), 'end', 20);
  // wires and normalized-wave labels: a1 (top) and b1 (bottom) at port 1; b2 (top) and a2 (bottom) at port 2
  const colB1 = fwd ? 'var(--s11)' : 'var(--s12)', colB2 = fwd ? 'var(--s21)' : 'var(--s22)', xL = L.edge, xR = DESIGN_W - L.edge;
  const wire = (x0, x1, y, name, c, col, faded) => lineArrow(x0, x1, y, col, faded, name, cabs(c));
  const wlab = (name, c, col, x, y, anchor, big) => txt(x, y, name.replace(/(\d)$/, '_$1') + ' = ' + waveText(c), { anchor, fill: col, size: big ? FS_OUT : FS.label, weight: big ? 700 : 600, cls: 'wlabel' + (big ? ' out' : ''), id: 'w' + name });
  const plab = (name, c, col, x, y, anchor) => txt(x, y, '|' + name.replace(/(\d)$/, '_$1') + '|² = ' + (cabs(c) < S_ZERO ? '0' : sig2(cabs(c) ** 2)), { anchor, fill: col, size: FS.label, weight: 400, cls: 'plabel', id: 'p' + name });
  s += wire(xL, xl - 4, yT, 'a1', w.a1, 'var(--neutral)', !fwd) + wlab('a1', w.a1, 'var(--neutral)', xL + 2, yT - L.wireUp, 'start', false);
  s += wire(xr + 4, xR, yT, 'b2', w.b2, colB2, cabs(w.b2) < S_ZERO) + wlab('b2', w.b2, colB2, xR - 2, yT - L.wireUp, 'end', fwd);
  s += wire(xl - 4, xL, yB, 'b1', w.b1, colB1, cabs(w.b1) < S_ZERO) + wlab('b1', w.b1, colB1, xL + 2, yB + L.wireDown, 'start', !fwd);
  s += wire(xR, xr + 4, yB, 'a2', w.a2, 'var(--neutral)', fwd) + wlab('a2', w.a2, 'var(--neutral)', xR - 2, yB + L.wireDown, 'end', false);
  // the driven output's power, on the side away from the other labels (between the wires)
  s += fwd ? plab('b2', w.b2, colB2, xR - 2, yT + L.wireDown, 'end') : plab('b1', w.b1, colB1, xL + 2, yB - L.wireUp, 'start');
  s += txt((xL + xl) / 2, mid, 'Port 1', { anchor: 'middle', fill: 'var(--mut)', cls: 'port' }) + txt((xr + xR) / 2, mid, 'Port 2', { anchor: 'middle', fill: 'var(--mut)', cls: 'port' });
  return { svg: s, S, w, G };
}
// ── END TWO-PORT DRAWING ──────────────────────────────────────

// ── MATRIX AND BADGES ─────────────────────────────────────────
// Coloured matrix equation [b1; b2] = [S11 S12; S21 S22][a1; a2] centred at (cx, cy), entries FS.mat units.
function matrixEq(cx, cy){
  const fs = FS.mat, cw = fs * 2.6, rh = fs * 1.8, x0 = cx - cw * 3;
  const brk = (x, w) => el('path', { d: 'M' + n2(x + 8) + ' ' + n2(cy - rh) + 'h-8v' + n2(2 * rh) + 'h8M' + n2(x + w - 8) + ' ' + n2(cy - rh) + 'h8v' + n2(2 * rh) + 'h-8', fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2 });
  const col = (x, a, b) => brk(x, cw) + txt(x + cw / 2, cy - rh / 2, a, { anchor: 'middle', size: fs }) + txt(x + cw / 2, cy + rh / 2, b, { anchor: 'middle', size: fs });
  const mx = x0 + cw * 1.7, ent = (k, c, r) => txt(mx + cw * (c ? 1.6 : 0.6), cy + (r ? rh / 2 : -rh / 2), 'S_' + k.slice(1), { anchor: 'middle', size: fs, fill: 'var(--' + k + ')', cls: 'ment' });
  return el('g', { class: 'matrix' }, col(x0, 'b_1', 'b_2') + txt(x0 + cw * 1.3, cy, '=', { anchor: 'middle', size: fs }) + brk(mx, cw * 2.2)
    + ent('s11', 0, 0) + ent('s12', 1, 0) + ent('s21', 0, 1) + ent('s22', 1, 1) + col(mx + cw * 2.6, 'a_1', 'a_2'));
}
// The numeric line under the matrix: the computed b vector = [S] · the drive vector, in the same colours.
function numericLine(w, cx, y){
  const fwd = D.drive === 'fwd', cb1 = fwd ? 'var(--s11)' : 'var(--s12)', cb2 = fwd ? 'var(--s21)' : 'var(--s22)';
  return richTxt(cx, y, [['[', null], [waveText(w.b1), cb1], [' ; ', null], [waveText(w.b2), cb2], ['] = [S] · [', null], [waveText(w.a1), null], [' ; ', null], [waveText(w.a2), null], [']', null]],
    { anchor: 'middle', size: FS_NUM, cls: 'numline', id: 'numLine' });
}
// The four property badges in one row centred on y (Passive uses σmax ≤ 1).
function badgeRow(S, y){
  const P = properties(S), bw = 212, bh = 42, gap = 10, x0 = (DESIGN_W - 4 * bw - 3 * gap) / 2;
  return BADGES.map(([k, name], i) => { const on = P[k], x = x0 + i * (bw + gap);
    return el('g', { class: 'badge', 'data-badge': k, 'data-on': on ? 1 : 0 },
      el('rect', { x, y: y - bh / 2, width: bw, height: bh, rx: 8, fill: 'none', stroke: on ? 'var(--txt)' : 'var(--mut)', 'stroke-width': 2, 'stroke-dasharray': on ? null : '6 4' })
      + txt(x + bw / 2, y, name + ' ' + (on ? '✓' : '✗'), { anchor: 'middle', size: 20, fill: on ? 'var(--txt)' : 'var(--mut)' })); }).join('');
}
// The whole Devices drawing.
function drawDevices(H){
  const p = D[D.dev], tp = drawTwoPort(H, D.dev, p);
  return svgRoot(H, DEV_NAME[D.dev] + ', ' + (D.drive === 'fwd' ? 'forward' : 'reverse') + ' drive: two-port with its normalized waves and four S-parameter paths',
    tp.svg + matrixEq(DESIGN_W / 2, tp.G.mat) + numericLine(tp.w, DESIGN_W / 2, tp.G.num) + badgeRow(tp.S, tp.G.badge));
}
// ── END MATRIX AND BADGES ─────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
/* The panel's one headline: the power of the transmitted normalized wave (|b2|² Forward, |b1|² Reverse) as a percentage
   of the input, or as a ratio ("10 × input") when the device has gain. The wave itself is on its arrow and in the
   numeric matrix line, so it is not repeated here. */
function devicePower(){
  const w = deviceWaves(deviceS(D.dev, D[D.dev])), out = D.drive === 'fwd' ? 'b2' : 'b1', pw = cabs(w[out]) ** 2;
  return ['power out = |' + out + '|²', pw > 1 + 1e-9 ? sig2(pw) + ' × input' : pct2(pw)];
}
const WAVE_CAPTION = 'a, b = normalized waves (a = V⁺/√Z0). Power = |wave|².';
const DEV_NOTE = { through: 'A matched line only delays the wave: S21 = 1∠−βℓ, and βℓ grows with the length.',
  atten: 'A matched attenuator: nothing reflects, and the same loss applies in both directions.',
  amp: 'Power out of port 2 is the gain times the power in; nothing gets back through (S12 = 0).',
  iso: 'Waves from port 1 pass; waves from port 2 are absorbed, so S12 ≈ 0.',
  custom: 'Set each entry by its |S| and angle. Tick the link to keep S12 = S21.' };
/* The Custom editor for entry set st = { e, recip } with input ids prefixed by pre: one row per S entry (name, |S| slider,
   |S| box, angle box in degrees) and the "reciprocal (S12 = S21)" link. changed(full) redraws; full also rebuilds the
   panel (needed when the link changes which row is locked). */
function sEditor(st, pre, changed){
  // Set entry k, part i (0 |S|, 1 angle) to v; the link copies S21 into S12. The twin inputs follow without a rebuild.
  const set = (k, i, v, src) => {
    st.e[k][i] = v; if(st.recip && k === 's21') st.e.s12 = st.e.s21.slice();
    const put = (id, val) => { const e = document.getElementById(id); if(e && e !== src) e.value = +(+val).toPrecision(6); };
    for(const kk of S_KEYS){ put(pre + kk, st.e[kk][0]); put(pre + kk + 'm', st.e[kk][0]); put(pre + kk + 'a', st.e[kk][1]); }
    changed(false);
  };
  const row = k => {
    const e = st.e[k], lock = st.recip && k === 's12';
    const box = (part, lbl, min, max) => { const b = h('input', { type: 'number', id: pre + k + (part ? 'a' : 'm'), value: e[part], min, max, step: 'any', disabled: lock, attrs: { 'aria-label': lbl } });
      b.addEventListener('input', () => { const x = +b.value, okv = b.value !== '' && isFinite(x) && x >= min && x <= max; b.classList.toggle('invalid', !okv); b.setAttribute('aria-invalid', String(!okv));
        if(okv) set(k, part, x, b); }); return b; };
    const r = h('input', { type: 'range', id: pre + k, min: 0, max: MAG_MAX, step: 0.01, value: e[0], disabled: lock, attrs: { 'aria-label': '|' + S_NAME[k] + '|' } });
    r.addEventListener('input', () => set(k, 0, +r.value, r));
    return h('div', { cls: 'srow' }, h('span', { cls: 'sname ' + k, text: S_NAME[k] }), r, box(0, '|' + S_NAME[k] + '|', 0, MAG_MAX * 50),
      box(1, S_NAME[k] + ' angle (degrees)', -FULL_TURN, FULL_TURN), h('span', { text: '°' }));
  };
  const link = h('input', { type: 'checkbox', id: pre + 'recip', checked: st.recip });
  link.addEventListener('change', () => { st.recip = link.checked; if(link.checked) st.e.s12 = st.e.s21.slice(); changed(true); });
  return [h('div', { cls: 'srows' }, S_KEYS.map(row)), h('label', { cls: 'chk' }, link, ' reciprocal (S12 = S21)')];
}
// The controls of the current device.
function deviceControls(){
  const set = (k, v) => { D[D.dev][k] = v; redraw(false); };
  switch(D.dev){
    case 'through': return [slider({ id: 'len', label: 'Line length ℓ/λ', min: 0, max: 1, step: 0.01, value: D.through.l, unit: 'λ', onset: v => set('l', v) })];
    case 'atten': return [slider({ id: 'att', label: 'Attenuation', min: 0, max: 40, step: 0.5, value: D.atten.A, unit: 'dB', onset: v => set('A', v) })];
    case 'amp': return [slider({ id: 'gain', label: 'Gain', min: 0, max: 30, step: 0.5, value: D.amp.G, unit: 'dB', onset: v => set('G', v) })];
    case 'iso': return [slider({ id: 'isoIL', label: 'Forward loss', min: 0, max: 3, step: 0.1, value: D.iso.IL, unit: 'dB', onset: v => set('IL', v) }),
      slider({ id: 'isoI', label: 'Reverse isolation (top = ∞)', min: 0, max: ISO_MAX, smax: ISO_MAX + 1, step: 1, value: D.iso.I, unit: 'dB',
        toSlider: v => (v === Infinity ? ISO_MAX + 1 : v), fromSlider: q => (q > ISO_MAX ? Infinity : q), fmt: v => (v === Infinity ? 'infinite isolation' : v + ' dB'),
        numText: v => (v === Infinity ? '' : v), placeholder: '∞',
        onset: v => set('I', v) })];
  }
  return sEditor(D.custom, 'c', redraw);
}
// Side panel of the Devices view: the power out; the controls; one line of explanation; the wave caption.
function panelDevices(){ const [k, v] = devicePower(); return [headline(k, v, 'roPower'), ...deviceControls(), note(DEV_NOTE[D.dev]), note(WAVE_CAPTION)]; }
// Refresh the readouts after a control moved (the panel is not rebuilt, so focus stays on the control).
function syncDevices(){ const [k, v] = devicePower(), e = document.getElementById('roPower'); if(e){ e.textContent = v; e.previousSibling.textContent = k; } }
// ── END PANEL ─────────────────────────────────────────────────

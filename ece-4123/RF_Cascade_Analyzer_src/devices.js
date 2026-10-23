/* RF Cascade Analyzer — View 2, Devices: one device at a time, driven one port at a time (Forward: V1⁺ = 1∠0°, V2⁺ = 0;
   Reverse: V2⁺ = 1∠0°, V1⁺ = 0, slide 12), drawn as the incident / reflected / transmitted flow diagram (Introduction
   deck, slide 14). The port-1 incident wave V1⁺ (grey) enters top-left and splits at a junction into S21, transmitted
   straight on to the right, and S11, reflected down and back to the left; the port-2 incident wave V2⁺ enters bottom-right
   and splits into S12, transmitted on to the left, and S22, reflected up and back to the right. Braces gather the
   outgoing waves, V1⁻ = S11·V1⁺ + S12·V2⁺ on the left and V2⁻ = S21·V1⁺ + S22·V2⁺ on the right, with their values; the
   device sits in the centre as a DUT box with its two port stubs. Each path is drawn in its S colour, as wide as its
   power |S|² (W0 for power 1; capped at 3 W0 with a break mark and a "×10" label), and labelled with its S value,
   Transmitted / Reflected, and its share of the power when the drive excites it. Paths the drive does not excite are
   faded but clearly visible. A path with |S| < S_BLOCK keeps the same solid style, at the minimum width, valued "0". Below: the matrix equation, symbolic
   then with the numbers for the drive (normalized waves a = V⁺/√Z0, b = V⁻/√Z0), and the four property badges. Every
   device's S entries are editable; a preset keeps its name and diagram, marked "(edited)", until reset. Next/Previous
   step through the device list. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — device list, path widths, fading, layout
   2. State            — per-device parameters and edits, current device
   3. Flow diagram     — incident waves, the four S paths, braces, DUT box, labels
   4. Matrix and badges — symbolic equation, numeric row for the drive, property badges
   5. Panel            — the power out, the device's name, knobs and S entries, reset, one line of explanation
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DEVICES = ['through', 'atten', 'amp', 'iso', 'custom'];
const DEV_NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator', custom: 'Custom' };
const S_ZERO = 0.005;            // |S| or a wave below this is labelled 0
const S_BLOCK = 0.05;            // |S| below this: a path is valued "0" (drawn solid at the minimum width, like any other)
const ISO_MAX = 60;              // isolator reverse-isolation slider: 0..60 dB, then ∞
const MAG_MAX = 2;               // Custom |S| slider range
const W0 = 16;                   // path width for power 1 (an incident wave); a path's width is W0·|S|²
const W_CAP = 3;                 // widths above 3 W0 are capped and drawn with a break mark and a "×10" label
const W_MIN = 3;                 // a path is never drawn thinner than this
const FADE = 0.4, FADE_LABEL = 0.7;   // opacity of what the drive does not excite (paths, their labels): faded, still clearly visible and legible in both themes
/* Layout (design units = px at 1280×720). The matrix rows and badges are stacked from the bottom up (gaps as in v1.2.0:
   badges 12 above the bottom, the numeric row 12 above the badges); the flow diagram takes the height left above them (at
   most boxMax; in a taller drawing the whole stack is centred). Flow diagram: the top line (V1⁺ → S21) yPad below its top,
   the bottom line (V2⁺ → S12) yPad above its bottom; V1⁺ from xIn1 to its junction xJ1, S21 on to xOutR; V2⁺ from xIn2
   to its junction xJ2, S12 on to xOutL; S11 drops a fraction drop of the way down and returns to xOutL, S22 rises as much
   and returns to xOutR; the braces at xBrL / xBrR (their labels outside them); the DUT box dutW × dutH in the centre with
   stubW-wide port stubs; label rows labUp above / below a line (beyond half its width), labGap apart. */
const LY_D = { top: 8, edge: 16, boxMax: 400, yPad: 58, xIn1: 70, xJ1: 300, xOutR: 752, xIn2: 796, xJ2: 600, xOutL: 150, xBrL: 136, xBrR: 766,
               drop: 0.36, dutW: 200, dutH: 60, stubW: 22, labUp: 18, labGap: 22, labSide: 10,
               badgeH: 32, gapEdge: 12, numHalf: 30, gapNum: 12, matHalf: 36, gapMat: 10, gapBox: 16 };
// Vertical positions for a drawing H units tall: box top, badge, numeric row and matrix centres, box bottom.
function geoD(H){
  const L = LY_D, stack = L.gapEdge + L.badgeH + L.gapNum + 2 * L.numHalf + L.gapMat + 2 * L.matHalf + L.gapBox;
  const lift = Math.max(0, H - L.top - stack - L.boxMax) / 2, badge = H - lift - L.gapEdge - L.badgeH / 2, num = badge - L.badgeH / 2 - L.gapNum - L.numHalf;
  const mat = num - L.numHalf - L.gapMat - L.matHalf, bb = mat - L.matHalf - L.gapBox;
  return { by: L.top + lift, badge, num, mat, bb };
}
const FS_NUM = [16, 14];         // numeric matrix row: 16, or 14 if it would not fit at 16 (never wrapped)
const DRIVE_PATHS = { fwd: ['s11', 's21'], rev: ['s12', 's22'] };   // paths excited by V1⁺ (Forward) or V2⁺ (Reverse)
const FRACTIONS = [[1 / 8, 'λ/8'], [1 / 4, 'λ/4'], [3 / 8, '3λ/8'], [1 / 2, 'λ/2'], [5 / 8, '5λ/8'], [3 / 4, '3λ/4'], [7 / 8, '7λ/8'], [1, 'λ'], [0, '0']];
const BADGES = [['reciprocal', 'Reciprocal'], ['symmetric', 'Symmetric'], ['lossless', 'Lossless'], ['passive', 'Passive']];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
// A Custom entry set { s11: [mag, deg], ... } (the Teaching example: reciprocal, lossy, not symmetric).
const customDefault = () => ({ s11: [0.3, 40], s21: [0.6, -70], s12: [0.6, -70], s22: [0.4, -20] });
const D = { dev: 'through', drive: 'fwd', through: { l: 0.25 }, atten: { A: 3 }, amp: { G: 10 }, iso: { IL: 0.5, I: Infinity },
            custom: { e: customDefault(), recip: true }, edits: {}, est: null };
// edits: a preset's edited S entry set, by device (the device keeps its name, marked "(edited)", until reset);
// est: the unedited preset entry set shown in the panel (it follows the knob)
// S of a Custom entry set.
const customS = e => devPolar(e.s11, e.s21, e.s12, e.s22);
// A two-port's S as a Custom entry set { e: { s11: [mag, deg], … }, recip } (6 significant figures).
function sEntries(S){
  const e = {};
  for(const k of S_KEYS){ const m = cabs(S[k]); e[k] = [+m.toPrecision(6), m < S_ZERO ? 0 : +wrapDeg(carg(S[k]) * DEG).toPrecision(6)]; }
  return { e, recip: cabs(csub(S.s12, S.s21)) <= EPS_BADGE };
}
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
// Whether the current preset has been edited, and the S the Devices view shows: Custom's entries, a preset's edits, or
// the preset itself.
const edited = () => D.dev !== 'custom' && !!D.edits[D.dev];
const curS = () => (D.dev === 'custom' ? customS(D.custom.e) : edited() ? customS(D.edits[D.dev].e) : deviceS(D.dev, D[D.dev]));
// The device's shown name: "Attenuator", "Attenuator (edited)".
const devLabel = () => DEV_NAME[D.dev] + (edited() ? ' (edited)' : '');
// ── END STATE ─────────────────────────────────────────────────

// ── FLOW DIAGRAM ──────────────────────────────────────────────
// Width of a path for power p = |S|²: W0·p, capped at W_CAP·W0, never thinner than W_MIN.
const pathW = p => Math.max(W_MIN, W0 * Math.min(p, W_CAP));
/* A path through the points pts (a polyline; the last segment carries an arrowhead unless head is false), stroke col, width
   w. The head is at least 14 long and 8 either side of the line, so a thin path still shows its
   direction; the line stops where the head starts. */
function flowLine(pts, col, w, head){
  const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
  const hl = head === false ? 0 : Math.max(14, w * 0.9 + 8), hh = Math.max(8, w / 2 + 6), body = pts.slice(0, -1).concat([[x1 - ux * hl, y1 - uy * hl]]);
  let s = el('path', { d: body.map(([x, y], i) => (i ? 'L' : 'M') + n2(x) + ' ' + n2(y)).join(''), fill: 'none', stroke: col, 'stroke-width': n2(w),
    'stroke-linejoin': 'miter', class: 'fline' });
  if(hl) s += el('path', { d: 'M' + n2(x1) + ' ' + n2(y1) + 'L' + n2(x1 - ux * hl - uy * hh) + ' ' + n2(y1 - uy * hl + ux * hh) + 'L' + n2(x1 - ux * hl + uy * hh) + ' ' + n2(y1 - uy * hl - ux * hh) + 'Z',
    fill: col, class: 'fhead' });
  return s;
}
// A brace at x from y0 to y1, its point dir (−1 left, +1 right) outward; returns the path.
function brace(x, y0, y1, dir){
  const m = (y0 + y1) / 2, c = 8 * dir;
  return el('path', { d: 'M' + n2(x - c) + ' ' + n2(y0) + 'q' + n2(c) + ' 0 ' + n2(c) + ' 8V' + n2(m - 8) + 'q0 8 ' + n2(c) + ' 8q' + n2(-c) + ' 0 ' + n2(-c) + ' 8V' + n2(y1 - 8) + 'q0 8 ' + n2(-c) + ' 8',
    fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2, class: 'brace' });
}
/* The flow diagram for the device's S in a drawing H units tall (see the file header). Returns { svg, S, w, G } for the
   matrix and badges below it. */
function drawFlowDiagram(H){
  const S = curS(), w = deviceWaves(S), on = DRIVE_PATHS[D.drive], fwd = D.drive === 'fwd', L = LY_D, G = geoD(H);
  const yTop = G.by + L.yPad, yBot = G.bb - L.yPad, span = yBot - yTop, y11 = yTop + L.drop * span, y22 = yBot - L.drop * span, mid = (yTop + yBot) / 2;
  const M = k => cabs(S[k]), blocked = k => M(k) < S_BLOCK, wid = k => pathW(M(k) ** 2), live = k => on.includes(k);
  const ROUTE = { s21: [[L.xJ1, yTop], [L.xOutR, yTop]], s11: [[L.xJ1, yTop], [L.xJ1, y11], [L.xOutL, y11]],
                  s12: [[L.xJ2, yBot], [L.xOutL, yBot]], s22: [[L.xJ2, yBot], [L.xJ2, y22], [L.xOutR, y22]] };
  const TYPE = { s21: 'Transmitted', s12: 'Transmitted', s11: 'Reflected', s22: 'Reflected' };
  let s = '';
  // the DUT box with its port stubs, the device's name inside, "Port 1/2" under the stubs
  const dx = DESIGN_W / 2 - L.dutW / 2, dy = mid - L.dutH / 2, sh = L.dutH / 2;
  s += el('rect', { x: dx - L.stubW, y: mid - sh / 2, width: L.stubW, height: sh, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2, class: 'stub' })
    + el('rect', { x: dx + L.dutW, y: mid - sh / 2, width: L.stubW, height: sh, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2, class: 'stub' })
    + el('rect', { x: dx, y: dy, width: L.dutW, height: L.dutH, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2.5, class: 'box' });
  s += edited() ? txt(DESIGN_W / 2, mid - 10, DEV_NAME[D.dev], { anchor: 'middle', id: 'dutName' }) + txt(DESIGN_W / 2, mid + 12, '(edited)', { anchor: 'middle', size: FS.small, fill: 'var(--mut)', weight: 400, id: 'dutEdited' })
    : txt(DESIGN_W / 2, mid, DEV_NAME[D.dev], { anchor: 'middle', id: 'dutName' });
  s += txt(dx - L.stubW / 2, dy + L.dutH + L.labUp, 'Port 1', { anchor: 'middle', weight: 600, cls: 'port' }) + txt(dx + L.dutW + L.stubW / 2, dy + L.dutH + L.labUp, 'Port 2', { anchor: 'middle', weight: 600, cls: 'port' });
  // the incident waves (grey, width W0; the undriven one faded) and the four S paths, unexcited ones first
  const inc = (n, pts) => { const lit = (n === 1) === fwd;
    return el('g', { class: 'flow inc', id: 'inc' + n, 'data-q': 'V' + n + '+', 'data-faded': lit ? 0 : 1, 'data-w': W0, opacity: lit ? null : FADE }, flowLine(pts, 'var(--grey)', W0, false)); };
  s += inc(fwd ? 2 : 1, fwd ? [[L.xIn2, yBot], [L.xJ2, yBot]] : [[L.xIn1, yTop], [L.xJ1, yTop]]);
  const order = S_KEYS.slice().sort((a, b) => live(a) - live(b));
  for(const k of order){ const faded = !live(k), wk = wid(k);
    let g = flowLine(ROUTE[k], 'var(--' + k + ')', wk);
    if(M(k) ** 2 > W_CAP){ const [[ax, ay], [bx]] = ROUTE[k].slice(-2), xm = (ax + bx) / 2;   // break mark across a capped path
      g += el('path', { d: 'M' + n2(xm - 8) + ' ' + n2(ay + wk / 2 + 4) + 'L' + n2(xm + 2) + ' ' + n2(ay - wk / 2 - 4) + 'M' + n2(xm + 6) + ' ' + n2(ay + wk / 2 + 4) + 'L' + n2(xm + 16) + ' ' + n2(ay - wk / 2 - 4),
        stroke: 'var(--bg)', 'stroke-width': 5, class: 'brk' }); }
    s += el('g', { class: 'flow path ' + k, 'data-s': k, 'data-q': S_NAME[k], 'data-v': +M(k).toPrecision(12), 'data-w': n2(wk), 'data-faded': faded ? 1 : 0, 'data-live': live(k) ? 1 : 0, opacity: faded ? FADE : null }, g); }
  s += inc(fwd ? 1 : 2, fwd ? [[L.xIn1, yTop], [L.xJ1, yTop]] : [[L.xIn2, yBot], [L.xJ2, yBot]]);
  // labels: each path's S value (mag∠deg; "0" when blocked) and Transmitted / Reflected with its share of the power when
  // excited ("×10" above 1); the incident waves' "Incident"; faded with their path
  const val = k => (blocked(k) ? '0' : sText(S[k])), pow = k => { const p = M(k) ** 2; return blocked(k) ? '0 %' : p > 1 + 1e-9 ? '×' + sig2(p) : pct2(p); };
  const lab = (k, x, y, t, anchor, size, id, fill) => txt(x, y, t, { anchor, size, fill: fill || 'var(--' + k + ')', id });
  const grp = (faded, inner) => el('g', { class: 'flabel', opacity: faded ? FADE_LABEL : null }, inner);
  const typeText = k => TYPE[k] + (live(k) ? ' · ' + pow(k) : '');
  const half = k => wid(k) / 2, wT = Math.max(W0, wid('s21')) / 2, wB = Math.max(W0, wid('s12')) / 2;
  const yA = yTop - wT - L.labUp, yU = yBot + wB + L.labUp;
  s += grp(!fwd, lab(null, (L.xIn1 + L.xJ1) / 2, yA, 'Incident', 'middle', FS.label, 'li1', 'var(--grey)'));
  s += grp(!live('s21'), lab('s21', DESIGN_W / 2, yA, 'S_21 = ' + val('s21'), 'middle', FS.label, 'lv_s21') + lab('s21', L.xOutR, yA, typeText('s21'), 'end', FS.label, 'lt_s21'));
  s += grp(!live('s11'), lab('s11', L.xJ1 - half('s11') - L.labSide, yTop + wT + L.labGap, 'S_11 = ' + val('s11'), 'end', FS.label, 'lv_s11')
    + lab('s11', L.xJ1 - half('s11') - L.labSide, yTop + wT + 2 * L.labGap, typeText('s11'), 'end', FS.label, 'lt_s11'));
  s += grp(!live('s22'), lab('s22', L.xJ2 + half('s22') + L.labSide, y22 + half('s22') + L.labGap, 'S_22 = ' + val('s22'), 'start', FS.label, 'lv_s22')
    + lab('s22', L.xJ2 + half('s22') + L.labSide, y22 + half('s22') + 2 * L.labGap, typeText('s22'), 'start', FS.label, 'lt_s22'));
  s += grp(!live('s12'), lab('s12', L.xOutL, yU, typeText('s12'), 'start', FS.label, 'lt_s12') + lab('s12', 470, yU, 'S_12 = ' + val('s12'), 'middle', FS.label, 'lv_s12'));
  s += grp(fwd, lab(null, (L.xJ2 + L.xIn2) / 2, yU, 'Incident', 'middle', FS.label, 'li2', 'var(--grey)'));
  // the incident waves' names, and the braces gathering the outgoing waves with their values
  s += txt(L.edge, yTop, 'V_1⁺', { size: FS.big, weight: 700, id: 'nV1p' }) + txt(L.xIn2 + L.labSide, yBot, 'V_2⁺', { size: FS.big, weight: 700, id: 'nV2p' });
  s += brace(L.xBrR, yTop - wT, y22 + half('s22'), 1) + brace(L.xBrL, y11 - half('s11'), yBot + wB, -1);
  const yR = (yTop - wT + y22 + half('s22')) / 2, yL = (y11 - half('s11') + yBot + wB) / 2;
  s += txt(L.xBrR + 22, yR - 11, 'V_2⁻ =', { size: FS.big, weight: 700, id: 'nV2m' }) + txt(L.xBrR + 22, yR + 13, waveText(w.b2), { id: 'vV2m' });
  s += txt(L.xBrL - 20, yL - 11, 'V_1⁻ =', { anchor: 'end', size: FS.big, weight: 700, id: 'nV1m' }) + txt(L.xBrL - 20, yL + 13, waveText(w.b1), { anchor: 'end', id: 'vV1m' });
  return { svg: s, S, w, G };
}
// ── END FLOW DIAGRAM ──────────────────────────────────────────

// ── MATRIX AND BADGES ─────────────────────────────────────────
// Bracket pair around a column block from x to x + w, rows at cy ± rh/2.
const brackets = (x, w, cy, rh) => el('path', { d: 'M' + n2(x + 8) + ' ' + n2(cy - rh) + 'h-8v' + n2(2 * rh) + 'h8M' + n2(x + w - 8) + ' ' + n2(cy - rh) + 'h8v' + n2(2 * rh) + 'h-8',
  fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2 });
// Row 1 reaches MAT_L left of its "=" and MAT_R right of it (column width 2.6 FS.mat; see matrixEq).
const MAT_L = FS.mat * 2.6 * 1.3, MAT_R = FS.mat * 2.6 * 4;
/* Row 1, the symbolic equation [b1; b2] = [S11 S12; S21 S22][a1; a2], with its "=" at xEq and centred on cy, entries
   FS.mat units: b in the text colour, S in the path colours, a neutral grey. */
function matrixEq(xEq, cy){
  const fs = FS.mat, cw = fs * 2.6, rh = fs * 1.8, x0 = xEq - cw * 1.3;
  const col = (x, a, b, fill) => brackets(x, cw, cy, rh) + txt(x + cw / 2, cy - rh / 2, a, { anchor: 'middle', size: fs, fill }) + txt(x + cw / 2, cy + rh / 2, b, { anchor: 'middle', size: fs, fill });
  const mx = x0 + cw * 1.7, ent = (k, c, r) => txt(mx + cw * (c ? 1.6 : 0.6), cy + (r ? rh / 2 : -rh / 2), 'S_' + k.slice(1), { anchor: 'middle', size: fs, fill: 'var(--' + k + ')', cls: 'ment' });
  return el('g', { class: 'matrix' }, col(x0, 'b_1', 'b_2', 'var(--txt)') + txt(xEq, cy, '=', { anchor: 'middle', size: fs }) + brackets(mx, cw * 2.2, cy, rh)
    + ent('s11', 0, 0) + ent('s12', 1, 0) + ent('s21', 0, 1) + ent('s22', 1, 1) + col(mx + cw * 2.6, 'a_1', 'a_2', 'var(--grey)'));
}
/* Row 2's pieces at size fs, laid out from its first "=" at x = 0: "=", [S as numbers], [a], "=", [b]. Each matrix is
   bracketed with two rows and its entries centred in their columns; returns the pieces (with x offsets) and the width
   right of the first "=". Entries: [text, fill, id]. */
function numRowLayout(S, w, fs){
  const pad = fs, gap = fs * 0.9, eqW = fs * 0.6;
  const S2 = [[[sText(S.s11), 'var(--s11)', 'n_s11'], [sText(S.s12), 'var(--s12)', 'n_s12']], [[sText(S.s21), 'var(--s21)', 'n_s21'], [sText(S.s22), 'var(--s22)', 'n_s22']]];
  const A2 = [[[waveText(w.a1), 'var(--grey)', 'n_a1']], [[waveText(w.a2), 'var(--grey)', 'n_a2']]];
  const B2 = [[[waveText(w.b1), 'var(--txt)', 'n_b1']], [[waveText(w.b2), 'var(--txt)', 'n_b2']]];
  const mat = (rows, x) => { const cws = rows[0].map((_, c) => Math.max(...rows.map(r => textW(r[c][0], fs))) + pad);
    return { rows, x, cws, w: cws.reduce((a, b) => a + b, 0) }; };
  const mS = mat(S2, eqW / 2 + gap), mA = mat(A2, mS.x + mS.w + gap), xEq2 = mA.x + mA.w + gap + eqW / 2, mB = mat(B2, xEq2 + eqW / 2 + gap);
  const text = '= [' + S2.map(r => r.map(e => e[0]).join('  ')).join('; ') + '] [' + A2.map(r => r[0][0]).join('; ') + '] = [' + B2.map(r => r[0][0]).join('; ') + ']';
  return { mats: [mS, mA, mB], xEq2, right: mB.x + mB.w, text };
}
// Row 2 drawn with its first "=" at xEq, centred on cy, at size fs.
function numericRow(lay, xEq, cy, fs){
  const rh = fs * 1.8;
  let s = txt(xEq, cy, '=', { anchor: 'middle', size: fs }) + txt(xEq + lay.xEq2, cy, '=', { anchor: 'middle', size: fs });
  for(const m of lay.mats){ let x = xEq + m.x;
    s += brackets(x, m.w, cy, rh);
    m.cws.forEach((cw, c) => { m.rows.forEach((r, ri) => { const [t, fill, id] = r[c]; s += txt(x + cw / 2, cy + (ri ? rh / 2 : -rh / 2), t, { anchor: 'middle', size: fs, fill, cls: 'nent', id }); }); x += cw; }); }
  return el('g', { class: 'numrow', id: 'numRow', 'data-text': lay.text, 'data-fs': fs }, s);
}
/* Both rows, with row 2's "=" under row 1's: at 24 units if the pair fits between the 16-unit side margins, else 20.
   The pair is centred in the drawing (moved in if needed to keep the margins). */
function matrixRows(S, w, G){
  const span = DESIGN_W - 2 * LY_D.edge;
  let fs = FS_NUM[0], lay = numRowLayout(S, w, fs);
  if(MAT_L + Math.max(MAT_R, lay.right) > span){ fs = FS_NUM[1]; lay = numRowLayout(S, w, fs); }
  const R_ = Math.max(MAT_R, lay.right), xEq = Math.min(Math.max(DESIGN_W / 2 - (R_ - MAT_L) / 2, LY_D.edge + MAT_L), DESIGN_W - LY_D.edge - R_);
  return matrixEq(xEq, G.mat) + numericRow(lay, xEq, G.num, fs);
}
// The four property badges in one row centred on y (Passive uses σmax ≤ 1).
function badgeRow(S, y){
  const P = properties(S), bw = 212, bh = LY_D.badgeH, gap = 10, x0 = (DESIGN_W - 4 * bw - 3 * gap) / 2;
  return BADGES.map(([k, name], i) => { const on = P[k], x = x0 + i * (bw + gap);
    return el('g', { class: 'badge', 'data-badge': k, 'data-on': on ? 1 : 0 },
      el('rect', { x, y: y - bh / 2, width: bw, height: bh, rx: 8, fill: 'none', stroke: on ? 'var(--txt)' : 'var(--mut)', 'stroke-width': 2, 'stroke-dasharray': on ? null : '6 4' })
      + txt(x + bw / 2, y, name + ' ' + (on ? '✓' : '✗'), { anchor: 'middle', size: FS.label, fill: on ? 'var(--txt)' : 'var(--mut)' })); }).join('');
}
// The whole Devices drawing.
function drawDevices(H){
  const tp = drawFlowDiagram(H);
  return svgRoot(H, devLabel() + ', ' + (D.drive === 'fwd' ? 'forward' : 'reverse') + ' drive: incident, reflected and transmitted waves through the four S-parameter paths',
    tp.svg + matrixRows(tp.S, tp.w, tp.G) + badgeRow(tp.S, tp.G.badge));
}
// ── END MATRIX AND BADGES ─────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
/* The panel's one headline: the power of the transmitted normalized wave (|b2|² Forward, |b1|² Reverse) as a percentage
   of the input, or as a ratio ("10 × input") when the device has gain. The wave itself is on its arrow and in the
   numeric matrix row, so it is not repeated here. */
function devicePower(){
  const w = deviceWaves(curS()), out = D.drive === 'fwd' ? 'b2' : 'b1', pw = cabs(w[out]) ** 2;
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
// The S entries each preset knob sets (Douglas, 2026-10-23: on an edited device the knob still sets these, keeping the
// other edits).
const KNOB_KEYS = { l: ['s21', 's12'], A: ['s21', 's12'], G: ['s21'], IL: ['s21'], I: ['s12'] };
const KNOB_TEXT = { through: 'S21 and S12', atten: 'S21 and S12', amp: 'S21', iso: 'S21 (loss) and S12 (isolation)' };
/* A preset knob moved: param k of the current device to v. On an edited device the entries that knob sets take the
   preset's new values and the other edits stay; the reciprocal link is dropped if S12 no longer equals S21, and the
   "(edited)" mark goes when every entry matches the preset again. */
function setKnob(k, v){
  D[D.dev][k] = v;
  const ed = D.edits[D.dev];
  if(ed){ const pre = sEntries(deviceS(D.dev, D[D.dev]));
    KNOB_KEYS[k].forEach(kk => { ed.e[kk] = pre.e[kk].slice(); });
    const unlink = ed.recip && (ed.e.s12[0] !== ed.e.s21[0] || ed.e.s12[1] !== ed.e.s21[1]);   // the S12 row unlocks: rebuild the panel
    if(unlink) ed.recip = false;
    if(JSON.stringify(ed) === JSON.stringify(pre)){ delete D.edits[D.dev]; redraw(true); return; }
    if(unlink){ redraw(true); return; } }
  redraw(false);
}
/* The controls of the current device. A preset: its name ("<Device> (edited)" once an S entry is edited), its knob(s), all
   four S entries with the reciprocal link and, when edited, "Reset to <Device>". The entries follow the knob live
   (syncDevices): unedited they show the preset's S; edited, the knob sets the entries it controls (KNOB_KEYS) and the
   other edits stay. Editing an entry keeps the device and its diagram, marked "(edited)". Custom: the S entries alone. */
function deviceControls(){
  const set = setKnob;
  if(D.dev === 'custom'){ D.est = null; return sEditor(D.custom, 'c', redraw); }
  const knobs = { through: () => [slider({ id: 'len', label: 'Line length ℓ/λ', min: 0, max: 1, step: 0.01, value: D.through.l, unit: 'λ', onset: v => set('l', v) })],
    atten: () => [slider({ id: 'att', label: 'Attenuation', min: 0, max: 40, step: 0.5, value: D.atten.A, unit: 'dB', onset: v => set('A', v) })],
    amp: () => [slider({ id: 'gain', label: 'Gain', min: 0, max: 30, step: 0.5, value: D.amp.G, unit: 'dB', onset: v => set('G', v) })],
    iso: () => [slider({ id: 'isoIL', label: 'Forward loss', min: 0, max: 3, step: 0.1, value: D.iso.IL, unit: 'dB', onset: v => set('IL', v) }),
      slider({ id: 'isoI', label: 'Reverse isolation (top = ∞)', min: 0, max: ISO_MAX, smax: ISO_MAX + 1, step: 1, value: D.iso.I, unit: 'dB',
        toSlider: v => (v === Infinity ? ISO_MAX + 1 : v), fromSlider: q => (q > ISO_MAX ? Infinity : q), fmt: v => (v === Infinity ? 'infinite isolation' : v + ' dB'),
        numText: v => (v === Infinity ? '' : v), placeholder: '∞',
        onset: v => set('I', v) })] }[D.dev]();
  const ed = edited(), st = ed ? D.edits[D.dev] : sEntries(deviceS(D.dev, D[D.dev]));
  D.est = st;
  const changed = full => { if(!edited()){ D.edits[D.dev] = st; redraw(true); } else redraw(full); };
  const title = h('div', { cls: 'sec', id: 'devTitle', text: devLabel() });
  const reset = ed ? h('button', { type: 'button', id: 'devReset', text: 'Reset to ' + DEV_NAME[D.dev], onclick: () => { delete D.edits[D.dev]; redraw(true); } }) : null;
  return [title, ...knobs, ...sEditor(st, 'c', changed), reset,
    note(ed ? 'Edited: the knob still sets ' + KNOB_TEXT[D.dev] + '; your other edits stay.' : 'Edit any S entry: the device keeps its name, marked "(edited)".')].filter(Boolean);
}
// Side panel of the Devices view: the power out; the controls; one line of explanation; the wave caption.
function panelDevices(){ const [k, v] = devicePower(); return [headline(k, v, 'roPower'), ...deviceControls(), note(DEV_NOTE[D.dev]), note(WAVE_CAPTION)]; }
// Refresh the readouts after a control moved (the panel is not rebuilt, so focus stays on the control); a preset's S
// entries follow its knob (unedited: the preset's S; edited: the edit set, which setKnob has updated).
function syncDevices(){
  const [k, v] = devicePower(), e = document.getElementById('roPower'); if(e){ e.textContent = v; e.previousSibling.textContent = k; }
  if(D.dev !== 'custom' && D.est){ if(!edited()) Object.assign(D.est, sEntries(deviceS(D.dev, D[D.dev])));
    const put = (id, x) => { const b = document.getElementById(id); if(b && b !== document.activeElement) b.value = +(+x).toPrecision(6); };
    for(const kk of S_KEYS){ put('c' + kk, D.est.e[kk][0]); put('c' + kk + 'm', D.est.e[kk][0]); put('c' + kk + 'a', D.est.e[kk][1]); }
    const rc = document.getElementById('crecip'); if(rc) rc.checked = D.est.recip; }
}
// ── END PANEL ─────────────────────────────────────────────────

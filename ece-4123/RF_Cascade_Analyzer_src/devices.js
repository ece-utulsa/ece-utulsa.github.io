/* RF Cascade Analyzer — View 2, Devices: one device at a time, driven one port at a time (Forward: a1 = 1∠0°, a2 = 0;
   Reverse: a2 = 1∠0°, a1 = 0, slide 12), drawn as the incident / reflected / transmitted flow diagram (Introduction
   deck, slide 14). The port-1 incident wave V1⁺ (grey) enters top-left and splits at a junction into S21, transmitted
   straight on to the right, and S11, reflected down and back to the left; the port-2 incident wave V2⁺ enters bottom-right
   and splits into S12, transmitted on to the left, and S22, reflected up and back to the right. Braces gather the
   outgoing normalized waves, b1 = S11·a1 + S12·a2 on the left and b2 = S21·a1 + S22·a2 on the right, with their values
   (v1.8.1: labelled b, the normalized waves, PPR-RFC-008); the device sits in the centre as a DUT box with its two port
   stubs. Each path is drawn in its S colour, as wide as its power ratio |S|² (W0 for 1; capped at 3 W0 with a break mark
   and a "×10" label), and labelled with its S value, Transmitted / Reflected, and its share of the incident power when the
   drive excites it. Paths the drive does not excite are faded but clearly visible. A path with |S| < S_BLOCK keeps the
   same solid style, at the minimum width, valued "0". Below: the matrix equation, symbolic then with the numbers for the
   drive (normalized waves a = V⁺/√Z0, b = V⁻/√Z0), and the four property badges. Every device's S entries are
   editable; a preset keeps its name and diagram, marked "(edited)", until reset; Custom is marked "(edited)" once it
   differs from the Teaching example. Next/Previous step through the device list. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — device list, path widths, fading, layout
   2. State            — per-device parameters and edits, current device
   3. Flow diagram     — incident waves, the four S paths, braces, DUT box, labels
   4. Matrix and badges — symbolic equation, numeric row for the drive, property badges
   5. Panel            — the power ratio out, the device's name, knobs and S entries, reset, one line of explanation
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DEVICES = ['through', 'atten', 'amp', 'iso', 'custom'];
const DEV_NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator', custom: 'Custom' };
const DEV_INIT = { through: { l: 0.25 }, atten: { A: 3 }, amp: { G: 10 }, iso: { IL: 0.5, I: Infinity } };   // knob values at start-up (ℓ/λ, dB)
const S_ZERO = 0.005;            // |S| or a wave below this is labelled 0
const S_BLOCK = 0.05;            // |S| below this: a path is valued "0" (drawn solid at the minimum width, like any other)
const ISO_MAX = 60;              // isolator reverse-isolation slider: 0..60 dB, then ∞
const MAG_MAX = 2;               // Custom |S| range: one limit for the slider and the box (CQ-RFC-013)
const MAG_STEP = 0.01;           // |S| slider step
const W0 = 16;                   // path width for power 1 (an incident wave); a path's width is W0·|S|²
const W_CAP = 3;                 // widths above 3 W0 are capped and drawn with a break mark and a "×10" label
const W_MIN = 3;                 // a path is never drawn thinner than this
const FADE = 0.4, FADE_LABEL = 0.7;   // opacity of what the drive does not excite (paths, their labels): faded, still clearly visible and legible in both themes
const EXACT = 1e-9;              // lengths, powers and waves within this are taken as equal (named fraction, power 1, unit wave)
const DEC_S = 2, DEC_DEG = 0;    // S values: |S| to 2 decimals, angles to whole degrees
const MAG_SIG = 3;               // waves from 1 up: 3 significant figures
const KNOBS = { len: [0, 1, 0.01], att: [0, 40, 0.5], gain: [0, 30, 0.5], isoIL: [0, 3, 0.1], isoI: [0, ISO_MAX, 1] };   // knob [min, max, step]
/* Layout (design units = px at 1280×720). The matrix rows and badges are stacked from the bottom up (gaps as in v1.2.0:
   badges 12 above the bottom, the numeric row 12 above the badges); the flow diagram takes the height left above them (at
   most boxMax; in a taller drawing the whole stack is centred). Flow diagram: the top line (V1⁺ → S21) yPad below its top,
   the bottom line (V2⁺ → S12) yPad above its bottom; V1⁺ from xIn1 to its junction xJ1, S21 on to xOutR; V2⁺ from xIn2
   to its junction xJ2, S12 on to xOutL; S11 drops a fraction drop of the way down and returns to xOutL, S22 rises as much
   and returns to xOutR; the braces at xBrL / xBrR (their labels braceIn outside them, two lines braceUp / braceDn from
   the middle; brace curl braceC), the S12 value at xS12; the DUT box dutW × dutH in the centre with stubW-wide port
   stubs (name lines nameUp / nameDn from the middle); label rows labUp above / below a line (beyond half its width),
   labGap apart. Arrowheads: at least headMin long and halfMin either side, growing with the width (headK, headAdd,
   halfAdd). Break mark: two slashes brkGap apart across a capped path. Line widths: stubSw, boxSw, braceSw. */
const LY_D = { top: 8, edge: 16, boxMax: 400, yPad: 58, xIn1: 70, xJ1: 300, xOutR: 752, xIn2: 796, xJ2: 600, xOutL: 150, xBrL: 136, xBrR: 766, xS12: 470,
               drop: 0.36, dutW: 200, dutH: 60, stubW: 22, labUp: 18, labGap: 22, labSide: 10, nameUp: 10, nameDn: 12,
               braceIn: [22, 20], braceUp: 11, braceDn: 13, braceC: 8, stubSw: 2, boxSw: 2.5, braceSw: 2,
               headMin: 14, headK: 0.9, headAdd: 8, halfMin: 8, halfAdd: 6, brk: { pad: 4, dx: 10, gap: 14, x0: 8, sw: 5 },
               badgeH: 32, badgeW: 212, badgeGap: 10, badgeR: 8, badgeSw: 2, gapEdge: 12, numHalf: 30, gapNum: 12, matHalf: 36, gapMat: 10, gapBox: 16,
               brkt: 8, brktSw: 2 };
// Matrix rows: column width (× text size), row height (× text size); row 1's symbolic layout (first column, entries and
// the a column, in column widths); row 2's padding, gap and "=" width (× text size).
const MATRIX = { cw: 2.6, rh: 1.8, x0: 1.3, mx: 1.7, entL: 0.6, entR: 1.6, sw: 2.2, aCol: 2.6, gap: 0.9, eqW: 0.6 };
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
// A Custom entry set { s11: [mag, deg], ... }: the Teaching example (reciprocal, lossy, not symmetric).
const customDefault = () => JSON.parse(JSON.stringify(TEACHING_S));
// (each device's knobs copied from DEV_INIT member by member: a JSON copy would turn the isolator's ∞ into null)
const D = Object.assign({ dev: 'through', drive: 'fwd', custom: { e: customDefault(), recip: true }, edits: {}, est: null },
  Object.fromEntries(Object.entries(DEV_INIT).map(([k, v]) => [k, Object.assign({}, v)])));
// edits: a preset's edited S entry set, by device (the device keeps its name, marked "(edited)", until reset);
// est: the unedited preset entry set shown in the panel (it follows the knob)
// S of a Custom entry set.
const customS = e => devPolar(e.s11, e.s21, e.s12, e.s22);
// A two-port's S as a Custom entry set { e: { s11: [mag, deg], … }, recip } (6 significant figures).
function sEntries(S){
  const e = {};
  for(const k of S_KEYS){ const m = cabs(S[k]); e[k] = [boxNum(m), m < S_ZERO ? 0 : boxNum(wrapDeg(carg(S[k]) * DEG))]; }
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
function lenText(l){ const f = FRACTIONS.find(([v]) => Math.abs(v - l) < EXACT); return f ? f[1] : fx(l, DEC_S) + 'λ'; }
// An angle in whole degrees with ±180° written +180°, after the magnitude ("∠−90°").
function angWhole(c){ const a = Math.round(wrapDeg(carg(c) * DEG)); return ANGLE_SIGN + fx(a === -HALF_TURN ? HALF_TURN : a, DEC_DEG) + '°'; }
// |S| to 2 decimals with the angle only where it isn't 0 (and the entry isn't 0).
function sText(c){
  const m = cabs(c); if(m < S_ZERO) return '0';
  return fx(m, DEC_S) + (Math.round(wrapDeg(carg(c) * DEG)) === 0 ? '' : angWhole(c));
}
// Signed dB text ("+10 dB", "−6 dB", "−0.5 dB"; whole numbers lose the ".0").
const dbText = db => fmtDbVal(db, { plus: true, trim: true });
// A normalized-wave value: "0" for zero, else |w| with the angle always shown: 2 decimals below 1 ("0.71∠0°"), 3
// significant figures from 1 up ("1.41∠0°", "10.0∠0°"); the unit drive wave is written "1∠0°".
const magText = m => (m >= 1 ? (+m.toPrecision(MAG_SIG)).toPrecision(MAG_SIG) : fx(m, DEC_S));
// A wave as text (see above).
function waveText(c){
  const m = cabs(c); if(m < S_ZERO) return '0';
  return (Math.abs(m - 1) < EXACT && Math.round(wrapDeg(carg(c) * DEG)) === 0 ? '1' : magText(m)) + angWhole(c);
}
// The waves at the ports for the current drive (port 2 or 1 terminated in Z0, so the other incident wave is 0).
const deviceWaves = S => drive(S, D.drive, ZERO);
// Whether the current preset has been edited; whether Custom differs from the Teaching example (DEFECT-RFC-009).
const edited = () => D.dev !== 'custom' && !!D.edits[D.dev];
// Custom differs from the Teaching example (or its link is off)
const customEdited = () => JSON.stringify(D.custom.e) !== JSON.stringify(customDefault()) || !D.custom.recip;
// the current device is edited (a preset with edits, or Custom changed)
const anyEdited = () => (D.dev === 'custom' ? customEdited() : edited());
// The S the Devices view shows: Custom's entries, a preset's edits, or the preset itself.
const curS = () => (D.dev === 'custom' ? customS(D.custom.e) : edited() ? customS(D.edits[D.dev].e) : deviceS(D.dev, D[D.dev]));
// The device's shown name: "Attenuator", "Attenuator (edited)", "Custom (edited)".
const devLabel = () => DEV_NAME[D.dev] + (anyEdited() ? ' (edited)' : '');
// ── END STATE ─────────────────────────────────────────────────

// ── FLOW DIAGRAM ──────────────────────────────────────────────
// Width of a path for power p = |S|²: W0·p, capped at W_CAP·W0, never thinner than W_MIN.
const pathW = p => Math.max(W_MIN, W0 * Math.min(p, W_CAP));
/* A path through the points pts (a polyline; the last segment carries an arrowhead unless head is false), stroke col, width
   w. The head is at least LY_D.headMin long and LY_D.halfMin either side of the line, so a thin path still shows its
   direction; the line stops where the head starts. */
function flowLine(pts, col, w, head){
  const L = LY_D, [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2], len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const hl = head === false ? 0 : Math.max(L.headMin, w * L.headK + L.headAdd), hh = Math.max(L.halfMin, w / 2 + L.halfAdd), body = pts.slice(0, -1).concat([[x1 - ux * hl, y1 - uy * hl]]);
  return [el('path', { d: body.map(([x, y], i) => (i ? 'L' : 'M') + n2(x) + ' ' + n2(y)).join(''), fill: 'none', stroke: col, 'stroke-width': n2(w), 'stroke-linejoin': 'miter', class: 'fline' }),
    hl ? arrowHead(x1, y1, ux, uy, hl, hh, { fill: col, class: 'fhead' }) : null];
}
// A brace at x from y0 to y1, its point dir (−1 left, +1 right) outward; returns the path.
function brace(x, y0, y1, dir){
  const L = LY_D, m = (y0 + y1) / 2, b = L.braceC, c = b * dir;
  return el('path', { d: 'M' + n2(x - c) + ' ' + n2(y0) + 'q' + n2(c) + ' 0 ' + n2(c) + ' ' + b + 'V' + n2(m - b) + 'q0 ' + b + ' ' + n2(c) + ' ' + b + 'q' + n2(-c) + ' 0 ' + n2(-c) + ' ' + b + 'V' + n2(y1 - b) + 'q0 ' + b + ' ' + n2(-c) + ' ' + b,
    fill: 'none', stroke: 'var(--txt)', 'stroke-width': L.braceSw, class: 'brace' });
}
// The break mark across a capped path whose last segment runs from (ax, ay) to bx, wk wide.
function breakMark(ax, ay, bx, wk){
  const B = LY_D.brk, xm = (ax + bx) / 2, yl = ay + wk / 2 + B.pad, yh = ay - wk / 2 - B.pad;
  return el('path', { d: 'M' + n2(xm - B.x0) + ' ' + n2(yl) + 'L' + n2(xm - B.x0 + B.dx) + ' ' + n2(yh) + 'M' + n2(xm - B.x0 + B.gap) + ' ' + n2(yl) + 'L' + n2(xm - B.x0 + B.gap + B.dx) + ' ' + n2(yh),
    stroke: 'var(--bg)', 'stroke-width': B.sw, class: 'brk' });
}
/* The flow diagram for the device's S in a drawing H units tall (see the file header). Returns { svg, S, w, G } for the
   matrix and badges below it. */
function drawFlowDiagram(H){
  const S = curS(), w = deviceWaves(S), on = DRIVE_PATHS[D.drive], fwd = D.drive === 'fwd', L = LY_D, G = geoD(H);
  const yTop = G.by + L.yPad, yBot = G.bb - L.yPad, span = yBot - yTop, y11 = yTop + L.drop * span, y22 = yBot - L.drop * span, mid = (yTop + yBot) / 2;
  // |S| of path k; blocked (valued 0); its drawn width; whether the drive excites it
  const M = k => cabs(S[k]), blocked = k => M(k) < S_BLOCK, wid = k => pathW(M(k) ** 2), live = k => on.includes(k);
  const ROUTE = { s21: [[L.xJ1, yTop], [L.xOutR, yTop]], s11: [[L.xJ1, yTop], [L.xJ1, y11], [L.xOutL, y11]],
                  s12: [[L.xJ2, yBot], [L.xOutL, yBot]], s22: [[L.xJ2, yBot], [L.xJ2, y22], [L.xOutR, y22]] };
  const TYPE = { s21: 'Transmitted', s12: 'Transmitted', s11: 'Reflected', s22: 'Reflected' };
  const s = [];
  // the DUT box with its port stubs, the device's name inside, "Port 1/2" under the stubs
  const dx = DESIGN_W / 2 - L.dutW / 2, dy = mid - L.dutH / 2, sh = L.dutH / 2, ed = anyEdited();
  s.push(el('rect', { x: dx - L.stubW, y: mid - sh / 2, width: L.stubW, height: sh, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': L.stubSw, class: 'stub' }),
    el('rect', { x: dx + L.dutW, y: mid - sh / 2, width: L.stubW, height: sh, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': L.stubSw, class: 'stub' }),
    el('rect', { x: dx, y: dy, width: L.dutW, height: L.dutH, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': L.boxSw, class: 'box' }));
  s.push(ed ? [txt(DESIGN_W / 2, mid - L.nameUp, DEV_NAME[D.dev], { anchor: 'middle', id: 'dutName' }), txt(DESIGN_W / 2, mid + L.nameDn, '(edited)', { anchor: 'middle', size: FS.small, fill: 'var(--mut)', weight: FW.normal, id: 'dutEdited' })]
    : txt(DESIGN_W / 2, mid, DEV_NAME[D.dev], { anchor: 'middle', id: 'dutName' }));
  s.push(txt(dx - L.stubW / 2, dy + L.dutH + L.labUp, 'Port 1', { anchor: 'middle', weight: FW.semi, cls: 'port' }), txt(dx + L.dutW + L.stubW / 2, dy + L.dutH + L.labUp, 'Port 2', { anchor: 'middle', weight: FW.semi, cls: 'port' }));
  // the incident waves (grey, width W0; the undriven one faded; data-v its |a|: 1 driven, 0 not) and the four S paths, unexcited ones first
  const inc = (n, pts) => { const lit = (n === 1) === fwd;
    return el('g', { class: 'flow inc', id: 'inc' + n, 'data-q': 'V' + n + '+', 'data-v': lit ? 1 : 0, 'data-faded': lit ? 0 : 1, 'data-w': W0, opacity: lit ? null : FADE }, flowLine(pts, 'var(--grey)', W0, false)); };
  s.push(inc(fwd ? 2 : 1, fwd ? [[L.xIn2, yBot], [L.xJ2, yBot]] : [[L.xIn1, yTop], [L.xJ1, yTop]]));
  const order = S_KEYS.slice().sort((a, b) => live(a) - live(b));
  for(const k of order){ const faded = !live(k), wk = wid(k), r = ROUTE[k], [[ax, ay], [bx]] = r.slice(-2);
    s.push(el('g', { class: 'flow path ' + k, 'data-s': k, 'data-q': S_NAME[k], 'data-v': +M(k).toPrecision(DATA_SIG), 'data-w': n2(wk), 'data-faded': faded ? 1 : 0, 'data-live': live(k) ? 1 : 0, opacity: faded ? FADE : null },
      flowLine(r, 'var(--' + k + ')', wk), M(k) ** 2 > W_CAP ? breakMark(ax, ay, bx, wk) : null)); }
  s.push(inc(fwd ? 1 : 2, fwd ? [[L.xIn1, yTop], [L.xJ1, yTop]] : [[L.xIn2, yBot], [L.xJ2, yBot]]));
  // labels: each path's S value (mag∠deg; "0" when blocked) and Transmitted / Reflected with its share of the incident
  // power when excited ("×10" above 1); the incident waves' "Incident"; faded with their path
  const val = k => (blocked(k) ? '0' : sText(S[k]));
  // the path's power ratio |S|² as a share ("50 %") or a gain ("×10")
  const pow = k => { const p = M(k) ** 2; return blocked(k) ? '0 %' : p > 1 + EXACT ? '×' + sig2(p) : pct2(p); };
  // one path label in the path's colour (or fill)
  const lab = (k, x, y, t, anchor, id, fill) => txt(x, y, t, { anchor, size: FS.label, fill: fill || 'var(--' + k + ')', id });
  // a label group, faded with an unexcited path
  const grp = (faded, ...kids) => el('g', { class: 'flabel', opacity: faded ? FADE_LABEL : null }, kids);
  // "Transmitted · 50 %" (the share only when excited)
  const typeText = k => TYPE[k] + (live(k) ? ' · ' + pow(k) : '');
  // half a path's width; the top and bottom lines' half-widths (at least an incident wave's)
  const half = k => wid(k) / 2, wT = Math.max(W0, wid('s21')) / 2, wB = Math.max(W0, wid('s12')) / 2;
  const yA = yTop - wT - L.labUp, yU = yBot + wB + L.labUp;
  s.push(grp(!fwd, lab(null, (L.xIn1 + L.xJ1) / 2, yA, 'Incident', 'middle', 'li1', 'var(--grey)')),
    grp(!live('s21'), lab('s21', DESIGN_W / 2, yA, 'S_21 = ' + val('s21'), 'middle', 'lv_s21'), lab('s21', L.xOutR, yA, typeText('s21'), 'end', 'lt_s21')),
    grp(!live('s11'), lab('s11', L.xJ1 - half('s11') - L.labSide, yTop + wT + L.labGap, 'S_11 = ' + val('s11'), 'end', 'lv_s11'),
      lab('s11', L.xJ1 - half('s11') - L.labSide, yTop + wT + 2 * L.labGap, typeText('s11'), 'end', 'lt_s11')),
    grp(!live('s22'), lab('s22', L.xJ2 + half('s22') + L.labSide, y22 + half('s22') + L.labGap, 'S_22 = ' + val('s22'), 'start', 'lv_s22'),
      lab('s22', L.xJ2 + half('s22') + L.labSide, y22 + half('s22') + 2 * L.labGap, typeText('s22'), 'start', 'lt_s22')),
    grp(!live('s12'), lab('s12', L.xOutL, yU, typeText('s12'), 'start', 'lt_s12'), lab('s12', L.xS12, yU, 'S_12 = ' + val('s12'), 'middle', 'lv_s12')),
    grp(fwd, lab(null, (L.xJ2 + L.xIn2) / 2, yU, 'Incident', 'middle', 'li2', 'var(--grey)')));
  // the incident waves' names, and the braces gathering the outgoing normalized waves b2, b1 with their values
  s.push(txt(L.edge, yTop, 'V_1⁺', { size: FS.big, weight: FW.bold, id: 'nV1p' }), txt(L.xIn2 + L.labSide, yBot, 'V_2⁺', { size: FS.big, weight: FW.bold, id: 'nV2p' }));
  s.push(brace(L.xBrR, yTop - wT, y22 + half('s22'), 1), brace(L.xBrL, y11 - half('s11'), yBot + wB, -1));
  const yR = (yTop - wT + y22 + half('s22')) / 2, yL = (y11 - half('s11') + yBot + wB) / 2;
  s.push(txt(L.xBrR + L.braceIn[0], yR - L.braceUp, 'b_2 =', { size: FS.big, weight: FW.bold, id: 'nV2m' }), txt(L.xBrR + L.braceIn[0], yR + L.braceDn, waveText(w.b2), { id: 'vV2m' }),
    txt(L.xBrL - L.braceIn[1], yL - L.braceUp, 'b_1 =', { anchor: 'end', size: FS.big, weight: FW.bold, id: 'nV1m' }), txt(L.xBrL - L.braceIn[1], yL + L.braceDn, waveText(w.b1), { anchor: 'end', id: 'vV1m' }));
  return { svg: s, S, w, G };
}
// ── END FLOW DIAGRAM ──────────────────────────────────────────

// ── MATRIX AND BADGES ─────────────────────────────────────────
// Bracket pair around a column block from x to x + w, rows at cy ± rh/2.
const brackets = (x, w, cy, rh) => { const b = LY_D.brkt;
  return el('path', { d: 'M' + n2(x + b) + ' ' + n2(cy - rh) + 'h' + (-b) + 'v' + n2(2 * rh) + 'h' + b + 'M' + n2(x + w - b) + ' ' + n2(cy - rh) + 'h' + b + 'v' + n2(2 * rh) + 'h' + (-b),
    fill: 'none', stroke: 'var(--txt)', 'stroke-width': LY_D.brktSw }); };
// Row 1 reaches MAT_L left of its "=" and MAT_R right of it (column widths MATRIX.cw; see matrixEq).
const MAT_L = FS.mat * MATRIX.cw * MATRIX.x0, MAT_R = FS.mat * MATRIX.cw * (MATRIX.aCol + MATRIX.mx - MATRIX.x0 + 1);
/* Row 1, the symbolic equation [b1; b2] = [S11 S12; S21 S22][a1; a2], with its "=" at xEq and centred on cy, entries
   FS.mat units: b in the text colour, S in the path colours, a neutral grey. */
function matrixEq(xEq, cy){
  const X = MATRIX, fs = FS.mat, cw = fs * X.cw, rh = fs * X.rh, x0 = xEq - cw * X.x0;
  // a one-wide column [a; b] at x in colour fill
  const col = (x, a, b, fill) => [brackets(x, cw, cy, rh), txt(x + cw / 2, cy - rh / 2, a, { anchor: 'middle', size: fs, fill }), txt(x + cw / 2, cy + rh / 2, b, { anchor: 'middle', size: fs, fill })];
  // the S entry k at column c, row r
  const mx = x0 + cw * X.mx, ent = (k, c, r) => txt(mx + cw * (c ? X.entR : X.entL), cy + (r ? rh / 2 : -rh / 2), 'S_' + k.slice(1), { anchor: 'middle', size: fs, fill: 'var(--' + k + ')', cls: 'ment' });
  return el('g', { class: 'matrix' }, col(x0, 'b_1', 'b_2', 'var(--txt)'), txt(xEq, cy, '=', { anchor: 'middle', size: fs }), brackets(mx, cw * X.sw, cy, rh),
    ent('s11', 0, 0), ent('s12', 1, 0), ent('s21', 0, 1), ent('s22', 1, 1), col(mx + cw * X.aCol, 'a_1', 'a_2', 'var(--grey)'));
}
/* Row 2's pieces at size fs, laid out from its first "=" at x = 0: "=", [S as numbers], [a], "=", [b]. Each matrix is
   bracketed with two rows and its entries centred in their columns; returns the pieces (with x offsets) and the width
   right of the first "=". Entries: [text, fill, id]. */
function numRowLayout(S, w, fs){
  const pad = fs, gap = fs * MATRIX.gap, eqW = fs * MATRIX.eqW;
  const S2 = [[[sText(S.s11), 'var(--s11)', 'n_s11'], [sText(S.s12), 'var(--s12)', 'n_s12']], [[sText(S.s21), 'var(--s21)', 'n_s21'], [sText(S.s22), 'var(--s22)', 'n_s22']]];
  const A2 = [[[waveText(w.a1), 'var(--grey)', 'n_a1']], [[waveText(w.a2), 'var(--grey)', 'n_a2']]];
  const B2 = [[[waveText(w.b1), 'var(--txt)', 'n_b1']], [[waveText(w.b2), 'var(--txt)', 'n_b2']]];
  // a matrix of rows at x: its column widths and total width
  const mat = (rows, x) => { const cws = rows[0].map((_, c) => Math.max(...rows.map(r => textW(r[c][0], fs))) + pad);
    return { rows, x, cws, w: cws.reduce((a, b) => a + b, 0) }; };
  const mS = mat(S2, eqW / 2 + gap), mA = mat(A2, mS.x + mS.w + gap), xEq2 = mA.x + mA.w + gap + eqW / 2, mB = mat(B2, xEq2 + eqW / 2 + gap);
  const text = '= [' + S2.map(r => r.map(e => e[0]).join('  ')).join('; ') + '] [' + A2.map(r => r[0][0]).join('; ') + '] = [' + B2.map(r => r[0][0]).join('; ') + ']';
  return { mats: [mS, mA, mB], xEq2, right: mB.x + mB.w, text };
}
// Row 2 drawn with its first "=" at xEq, centred on cy, at size fs.
function numericRow(lay, xEq, cy, fs){
  const rh = fs * MATRIX.rh, s = [txt(xEq, cy, '=', { anchor: 'middle', size: fs }), txt(xEq + lay.xEq2, cy, '=', { anchor: 'middle', size: fs })];
  for(const m of lay.mats){ let x = xEq + m.x;
    s.push(brackets(x, m.w, cy, rh));
    m.cws.forEach((cw, c) => { m.rows.forEach((r, ri) => { const [t, fill, id] = r[c]; s.push(txt(x + cw / 2, cy + (ri ? rh / 2 : -rh / 2), t, { anchor: 'middle', size: fs, fill, cls: 'nent', id })); }); x += cw; }); }
  return el('g', { class: 'numrow', id: 'numRow', 'data-text': lay.text, 'data-fs': fs }, s);
}
/* Both rows, with row 2's "=" under row 1's: at FS_NUM[0] if the pair fits between the side margins, else FS_NUM[1].
   The pair is centred in the drawing (moved in if needed to keep the margins). */
function matrixRows(S, w, G){
  const span = DESIGN_W - 2 * LY_D.edge;
  let fs = FS_NUM[0], lay = numRowLayout(S, w, fs);
  if(MAT_L + Math.max(MAT_R, lay.right) > span){ fs = FS_NUM[1]; lay = numRowLayout(S, w, fs); }
  const R_ = Math.max(MAT_R, lay.right), xEq = Math.min(Math.max(DESIGN_W / 2 - (R_ - MAT_L) / 2, LY_D.edge + MAT_L), DESIGN_W - LY_D.edge - R_);
  return [matrixEq(xEq, G.mat), numericRow(lay, xEq, G.num, fs)];
}
// The four property badges in one row centred on y (Passive uses σmax ≤ 1).
function badgeRow(S, y){
  const L = LY_D, P = properties(S), bw = L.badgeW, bh = L.badgeH, x0 = (DESIGN_W - BADGES.length * bw - (BADGES.length - 1) * L.badgeGap) / 2;
  return BADGES.map(([k, name], i) => { const on = P[k], x = x0 + i * (bw + L.badgeGap);
    return el('g', { class: 'badge', 'data-badge': k, 'data-on': on ? 1 : 0 },
      el('rect', { x, y: y - bh / 2, width: bw, height: bh, rx: L.badgeR, fill: 'none', stroke: on ? 'var(--txt)' : 'var(--mut)', 'stroke-width': L.badgeSw, 'stroke-dasharray': on ? null : '6 4' }),
      txt(x + bw / 2, y, name + ' ' + (on ? '✓' : '✗'), { anchor: 'middle', size: FS.label, fill: on ? 'var(--txt)' : 'var(--mut)' })); });
}
// The whole Devices drawing.
function drawDevices(H){
  const tp = drawFlowDiagram(H);
  return svgRoot(H, devLabel() + ', ' + (D.drive === 'fwd' ? 'forward' : 'reverse') + ' drive: incident, reflected and transmitted waves through the four S-parameter paths',
    [tp.svg, matrixRows(tp.S, tp.w, tp.G), badgeRow(tp.S, tp.G.badge)]);
}
// ── END MATRIX AND BADGES ─────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
/* The panel's one headline: the power ratio out ÷ in, |b2|²/|a1|² Forward or |b1|²/|a2|² Reverse (PPR-RFC-004: with
   peak phasors a wave carries ½|a|², so |b|² alone is not a power), as a percentage, or as a ratio ("10 × input") when
   the device has gain. The wave itself is on its arrow and in the numeric matrix row, so it is not repeated here. */
function devicePower(){
  const fwd = D.drive === 'fwd', w = deviceWaves(curS()), out = fwd ? 'b2' : 'b1', inn = fwd ? 'a1' : 'a2', pw = cabs(w[out]) ** 2 / cabs(w[inn]) ** 2;
  return ['power out ÷ in = |' + out + '|²/|' + inn + '|²', pw > 1 + EXACT ? sig2(pw) + ' × input' : pct2(pw)];
}
const WAVE_CAPTION = 'a, b = normalized waves (a = V⁺/√Z0, peak phasors). A wave carries ½|a|² of power; |b|²/|a|² is the power ratio.';
const DEV_NOTE = { through: 'A matched line only delays the wave: S21 = 1∠−βℓ, and βℓ grows with the length.',
  atten: 'A matched attenuator: nothing reflects, and the same loss applies in both directions.',
  amp: 'Power out of port 2 is the gain times the power in; nothing gets back through (S12 = 0). Linear, small-signal model: the output is not limited (no compression).',
  iso: 'Waves from port 1 pass; waves from port 2 are absorbed, so S12 ≈ 0.',
  custom: 'Set each entry by its |S| and angle. Tick the link to keep S12 = S21.' };
/* The Custom editor for entry set st = { e, recip } with input ids prefixed by pre: one row per S entry (name, |S| slider,
   |S| box, angle box in degrees) and the "reciprocal (S12 = S21)" link. changed(full) redraws; full also rebuilds the
   panel (needed when the link changes which row is locked). Boxes refuse entries outside the slider's range, in words. */
function sEditor(st, pre, changed){
  // Set entry k, part i (0 |S|, 1 angle) to v; the link copies S21 into S12. The twin inputs follow without a rebuild.
  const set = (k, i, v, src) => {
    st.e[k][i] = v; if(st.recip && k === 's21') st.e.s12 = st.e.s21.slice();
    // write a value into the input id unless it is the one being edited
    const put = (id, val) => { const e = document.getElementById(id); if(e && e !== src) e.value = boxNum(val); };
    for(const kk of S_KEYS){ put(pre + kk, st.e[kk][0]); put(pre + kk + 'm', st.e[kk][0]); put(pre + kk + 'a', st.e[kk][1]); }
    changed(false);
  };
  // one row: entry k's name, |S| slider, |S| box and angle box (each box with its refusal message)
  const row = k => {
    const e = st.e[k], lock = st.recip && k === 's12';
    // the |S| (part 0) or angle (part 1) box for entry k
    const box = (part, lbl, min, max, unit) => { const b = numBox({ id: pre + k + (part ? 'a' : 'm'), label: lbl, value: e[part],
        limits: () => ({ min, max, unit }), kept: () => boxNum(st.e[k][part]), onok: v => set(k, part, v, b.inp) });
      b.inp.disabled = lock; return b; };
    const r = rangeInput({ id: pre + k, min: 0, max: MAG_MAX, step: MAG_STEP, value: e[0], disabled: lock, attrs: { 'aria-label': '|' + S_NAME[k] + '|' } });
    r.addEventListener('input', () => set(k, 0, +r.value, r));
    const bm = box(0, '|' + S_NAME[k] + '|', 0, MAG_MAX, ''), ba = box(1, S_NAME[k] + ' angle (degrees)', -FULL_TURN, FULL_TURN, '°');
    return h('div', { cls: 'srowv' }, h('div', { cls: 'srow' }, h('span', { cls: 'sname ' + k, text: S_NAME[k] }), r, bm.inp, ba.inp, h('span', { text: '°' })), bm.msg, ba.msg);
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
// A knob slider: id, label, unit and parameter key k of the current device (limits from KNOBS).
const knob = (id, label, unit, k, extra) => { const [min, max, step] = KNOBS[id];
  return slider(Object.assign({ id, label, min, max, step, value: D[D.dev][k], unit, onset: v => setKnob(k, v) }, extra || {})); };
/* The controls of the current device. A preset: its name ("<Device> (edited)" once an S entry is edited), its knob(s), all
   four S entries with the reciprocal link and, when edited, "Reset to <Device>". The entries follow the knob live
   (syncDevices): unedited they show the preset's S; edited, the knob sets the entries it controls (KNOB_KEYS) and the
   other edits stay. Editing an entry keeps the device and its diagram, marked "(edited)". Custom: its name ("Custom
   (edited)" once it differs from the Teaching example), the S entries and, when edited, a reset. */
function deviceControls(){
  const title = h('div', { cls: 'sec', id: 'devTitle', text: devLabel() });
  if(D.dev === 'custom'){ D.est = null;
    // a Custom edit: rebuild the panel when the "(edited)" mark appears or goes, else redraw only
    const changedC = full => { const t = document.getElementById('devTitle'); redraw(full || !t || t.textContent !== devLabel()); };
    const reset = customEdited() ? h('button', { type: 'button', id: 'devReset', text: 'Reset to the Teaching example', onclick: () => { D.custom = { e: customDefault(), recip: true }; redraw(true); } }) : null;
    return [title, ...sEditor(D.custom, 'c', changedC), reset].filter(Boolean); }
  const knobs = { through: () => [knob('len', 'Line length ℓ/λ', 'λ', 'l')],
    atten: () => [knob('att', 'Attenuation', 'dB', 'A')],
    amp: () => [knob('gain', 'Gain', 'dB', 'G')],
    iso: () => [knob('isoIL', 'Forward loss', 'dB', 'IL'),
      knob('isoI', 'Reverse isolation (top = ∞)', 'dB', 'I', { smax: ISO_MAX + 1,
        toSlider: v => (v === Infinity ? ISO_MAX + 1 : v), fromSlider: q => (q > ISO_MAX ? Infinity : q), fmt: v => (v === Infinity ? 'infinite isolation' : v + ' dB'),
        numText: v => (v === Infinity ? '' : v), placeholder: INF, emptyValue: Infinity })] }[D.dev]();
  const ed = edited(), st = ed ? D.edits[D.dev] : sEntries(deviceS(D.dev, D[D.dev]));
  D.est = st;
  // an S entry edited: the preset becomes "(edited)" (panel rebuilt), else redraw
  const changed = full => { if(!edited()){ D.edits[D.dev] = st; redraw(true); } else redraw(full); };
  const reset = ed ? h('button', { type: 'button', id: 'devReset', text: 'Reset to ' + DEV_NAME[D.dev], onclick: () => { delete D.edits[D.dev]; redraw(true); } }) : null;
  return [title, ...knobs, ...sEditor(st, 'c', changed), reset,
    note(ed ? 'Edited: the knob still sets ' + KNOB_TEXT[D.dev] + '; your other edits stay.' : 'Edit any S entry: the device keeps its name, marked "(edited)".')].filter(Boolean);
}
// Side panel of the Devices view: the power ratio out; the controls; one line of explanation; the wave caption.
function panelDevices(){ const [k, v] = devicePower(); return [headline(k, v, 'roPower'), ...deviceControls(), note(DEV_NOTE[D.dev]), note(WAVE_CAPTION)]; }
// Refresh the readouts after a control moved (the panel is not rebuilt, so focus stays on the control); a preset's S
// entries follow its knob (unedited: the preset's S; edited: the edit set, which setKnob has updated).
function syncDevices(){
  const [k, v] = devicePower(), e = document.getElementById('roPower'); if(e){ e.textContent = v; e.previousSibling.textContent = k; }
  if(D.dev !== 'custom' && D.est){ if(!edited()) Object.assign(D.est, sEntries(deviceS(D.dev, D[D.dev])));
    for(const kk of S_KEYS){ setUnlessFocused('c' + kk, boxNum(D.est.e[kk][0])); setUnlessFocused('c' + kk + 'm', boxNum(D.est.e[kk][0])); setUnlessFocused('c' + kk + 'a', boxNum(D.est.e[kk][1])); }
    const rc = document.getElementById('crecip'); if(rc) rc.checked = D.est.recip; }
}
// ── END PANEL ─────────────────────────────────────────────────

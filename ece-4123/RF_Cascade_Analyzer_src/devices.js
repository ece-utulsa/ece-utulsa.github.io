/* RF Cascade Analyzer — View 2, Devices: the two-port path diagram (kept from the first v1.1.0 build, Step 2, Naming) for one device at
   a time, driven one port at a time (Forward: a1 = 1∠0°, a2 = 0; Reverse: a2 = 1∠0°, a1 = 0, slide 12). The port
   arrows carry the normalized waves a = V⁺/√Z0 and b = V⁻/√Z0 (no units; power is |wave|²). The four S-parameter paths
   run through or around the box, coloured, with stroke width proportional to |S| (capped at 3× with a break mark; a
   zero entry is a dotted ghost labelled 0); the paths the drive does not use fade. Below: the matrix equation with a
   numeric line for the current drive, and the four property badges. Next/Previous step through the device list. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — device list, path widths, layout
   2. State            — per-device parameters, current device
   3. Two-port drawing — box, header glyph, paths, labels, normalized waves at the ports
   4. Matrix and badges — symbolic equation, numeric line for the drive, property badges
   5. Panel            — the power out, the device's controls, one line of explanation
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DEVICES = ['through', 'atten', 'amp', 'iso', 'custom'];
const DEV_NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator', custom: 'Custom' };
const PATH_W1 = 8;               // path stroke width at |S| = 1 (units)
const PATH_CAP = 3;              // widths above 3× are capped and drawn with a break mark
const S_ZERO = 0.005;            // |S| below this is drawn as a ghost and labelled 0
const ISO_MAX = 60;              // isolator reverse-isolation slider: 0..60 dB, then ∞
const MAG_MAX = 2;               // Custom |S| slider range
/* Layout (design units = px at 1280×720). The drawing is stacked from the bottom up so each gap the v1.2.0 briefing
   names holds: badges 12 above the bottom, numeric line 12 above the badges, the matrix above it, wave labels 16 above
   the matrix and 24 below the box. The box is what is left above. edge: wave labels keep 16 from the drawing's sides. */
const LY_D = { bx: 165, bw: 570, top: 8, head: 86, inset: 22, loop: 24, edge: 16, badgeH: 42, gapEdge: 12, numH: 30, gapNum: 12,
               matHalf: 54, gapMat: 8, labH: 40, gapLab: 22, gapBox: 24, aUp: 26, portUp: 58 };
// Vertical positions for a drawing H units tall: badge, numeric line and matrix centres, wave-label row, box bottom.
function geoD(H){
  const L = LY_D, badge = H - L.gapEdge - L.badgeH / 2, num = badge - L.badgeH / 2 - L.gapNum - L.numH / 2;
  const mat = num - L.numH / 2 - L.gapMat - L.matHalf, lab = mat - L.matHalf - L.gapLab - L.labH / 2, bb = lab - L.labH / 2 - L.gapBox;
  return { badge, num, mat, lab, bb };
}
const FS_OUT = 22;               // the driven output's wave label (b2 Forward, b1 Reverse): larger and bold
const FADE = 0.25;               // opacity of the paths the current drive does not use
const GHOST_OP = 0.75;           // opacity of a zero (ghost) path: readable on a projector
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
// A normalized-wave value: "0" for zero, else |w| to 2 decimals with the angle always shown ("0.71∠0°"); the unit drive
// wave is written "1∠0°".
function waveText(c){
  const m = cabs(c); if(m < S_ZERO) return '0';
  const a = Math.round(wrapDeg(carg(c) * DEG)), ang = ANGLE_SIGN + fx(a === -HALF_TURN ? HALF_TURN : a, 0) + '°';
  return (Math.abs(m - 1) < 1e-12 && Math.abs(a) < 1e-9 ? '1' : fx(m, 2)) + ang;
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
// The device's glyph in the box header, centred (the "Two-Port" title sits at the header's left).
function headerGlyph(kind, p, cx, y0){
  if(kind === 'through'){ const x0 = cx - 110, x1 = cx + 110, yr = y0 + 40, yl = y0 + 52;
    return txt(cx, y0 + 20, 'ℓ = ' + lenText(p.l), { anchor: 'middle', cls: 'ruler' })
      + el('path', { d: 'M' + x0 + ' ' + (yr - 8) + 'V' + (yl + 4) + 'M' + x1 + ' ' + (yr - 8) + 'V' + (yl + 4) + 'M' + x0 + ' ' + yr + 'H' + x1, stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'ruler' })
      + el('line', { x1: x0, y1: yl, x2: x1, y2: yl, stroke: 'var(--txt)', 'stroke-width': 6, class: 'tline' })
      + txt(cx, y0 + 71, 'βℓ = 2πℓ/λ = ' + fx(FULL_TURN * p.l, 0) + '°', { anchor: 'middle' }); }
  if(kind === 'atten') return txt(cx, y0 + 46, dbText(-p.A), { anchor: 'middle', size: FS.mat, fill: 'var(--s22)', id: 'boxValue' });
  if(kind === 'amp') return txt(cx, y0 + 46, dbText(p.G), { anchor: 'middle', size: FS.mat, fill: 'var(--s21)', id: 'boxValue' });
  if(kind === 'iso') return txt(cx, y0 + 28, '→ forward: passes', { anchor: 'middle', fill: 'var(--s21)' })
    + txt(cx, y0 + 62, '← reverse: ' + (p.I === Infinity ? 'blocked' : 'mostly absorbed'), { anchor: 'middle', fill: 'var(--s12)' });
  return txt(cx, y0 + 46, '[S] set by hand', { anchor: 'middle' });
}
/* The two-port path diagram for device kind/params p in a drawing H units tall: box with a "Two-Port" header, the
   normalized waves a1, b1, a2, b2 at the ports (values for the current drive) and the four S paths. */
function drawTwoPort(H, kind, p){
  const S = deviceS(kind, p), w = deviceWaves(S), on = DRIVE_PATHS[D.drive], bx = LY_D.bx, bw = LY_D.bw, by = LY_D.top, cx = bx + bw / 2;
  const G = geoD(H), bb = G.bb, yA = by + LY_D.head + LY_D.inset, yB = bb - LY_D.inset, mid = (yA + yB) / 2, xl = bx + LY_D.loop, xr = bx + bw - LY_D.loop;
  let s = el('rect', { x: bx, y: by, width: bw, height: bb - by, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2.5, rx: 8, class: 'box' });
  s += el('line', { x1: bx, y1: by + LY_D.head, x2: bx + bw, y2: by + LY_D.head, stroke: 'var(--line)', 'stroke-width': 1.5 });
  s += txt(bx + 14, by + 18, 'Two-Port', { fill: 'var(--mut)', cls: 'boxTitle' });
  s += headerGlyph(kind, p, cx, by);
  // paths: [key, d, chevron point, chevron angle]
  const slope = Math.atan2(yB - yA, bw), at = (x0, y0, x1, y1, t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  const P = { s11: ['M' + bx + ' ' + n2(yA) + 'H' + xl + 'V' + n2(yB) + 'H' + bx, [xl, mid], Math.PI / 2],
              s22: ['M' + (bx + bw) + ' ' + n2(yA) + 'H' + xr + 'V' + n2(yB) + 'H' + (bx + bw), [xr, mid], Math.PI / 2],
              s21: ['M' + bx + ' ' + n2(yA) + 'L' + (bx + bw) + ' ' + n2(yB), at(bx, yA, bx + bw, yB, 0.22), slope],
              s12: ['M' + (bx + bw) + ' ' + n2(yA) + 'L' + bx + ' ' + n2(yB), at(bx + bw, yA, bx, yB, 0.22), Math.PI - slope] };
  const width = k => { const m = cabs(S[k]); return m < S_ZERO ? 0 : PATH_W1 * Math.min(m, PATH_CAP); };
  const order = S_KEYS.slice().sort((a, b) => (on.includes(a) - on.includes(b)) || (width(b) - width(a)));   // driven paths on top; thick first
  for(const k of order){ const m = cabs(S[k]), wd = width(k), ghost = wd === 0, capped = m > PATH_CAP, live = on.includes(k);
    let g = el('path', { d: P[k][0], fill: 'none', stroke: 'var(--' + k + ')', 'stroke-width': ghost ? 2.5 : wd, 'stroke-dasharray': ghost ? DOTS : null, 'stroke-linecap': ghost ? 'round' : 'butt',
      opacity: ghost ? GHOST_OP : 0.9, class: 'path ' + k, 'data-q': S_NAME[k], 'data-v': +m.toPrecision(12), 'data-ref': PATH_W1, 'data-ghost': ghost ? 1 : null, 'data-capped': capped ? 1 : null });
    // direction mark: on a band wider than 8 units, a background-coloured triangle inside the band; else a coloured one
    if(!ghost) g += wd > PATH_W1 ? chevron(P[k][1][0], P[k][1][1], P[k][2], wd * 0.42, 'var(--bg)') : chevron(P[k][1][0], P[k][1][1], P[k][2], Math.max(9, wd / 2 + 6), 'var(--' + k + ')');
    if(capped){ const [x, y] = k === 's21' ? at(bx, yA, bx + bw, yB, 0.7) : k === 's12' ? at(bx + bw, yA, bx, yB, 0.7) : [k === 's11' ? xl : xr, mid + 30];
      g += breakMark(x, y, k === 's21' ? slope : k === 's12' ? Math.PI - slope : Math.PI / 2, wd); }
    s += el('g', { class: 'pathg ' + k, 'data-s': k, 'data-live': live ? 1 : 0, opacity: live ? null : FADE }, g); }
  // a blocked reverse path: a red ✕ on S12 when it is zero but S21 is not
  if(cabs(S.s12) < S_ZERO && cabs(S.s21) >= S_ZERO){ const [x, y] = at(bx + bw, yA, bx, yB, 0.72); s += crossMark(x, y, 12, 'var(--s22)'); }
  // |S| on every path: S11/S22 beside their loops (two lines); S21 at the top of the upper triangle and S12 at the foot
  // of the lower one, where the triangles are widest and clear of a thick path
  const lab2 = (x, k, anchor) => txt(x, mid - 12, S_NAME[k], { anchor, fill: 'var(--' + k + ')', cls: 'slabel' }) + txt(x, mid + 12, sText(S[k]), { anchor, fill: 'var(--' + k + ')', cls: 'slabel', id: 'v' + k });
  s += lab2(xl + 18, 's11', 'start') + lab2(xr - 18, 's22', 'end');
  s += txt(cx, yA, 'S21 ' + sText(S.s21), { anchor: 'middle', fill: 'var(--s21)', cls: 'slabel', id: 'vs21' });
  s += txt(cx, yB, 'S12 ' + sText(S.s12), { anchor: 'middle', fill: 'var(--s12)', cls: 'slabel', id: 'vs12' });
  // normalized waves at the ports: a in at the top, labelled above the arrow's outer end; b out at the bottom, labelled
  // in the row under the box at the arrow's outer end. Labels keep LY_D.edge from the drawing's sides; the driven
  // output (b2 Forward, b1 Reverse) is larger and bold. A label too long for half the width breaks into two lines.
  const xa = bx - LY_D.edge, fwd = D.drive === 'fwd', colB1 = fwd ? 'var(--s11)' : 'var(--s12)', colB2 = fwd ? 'var(--s21)' : 'var(--s22)';
  const xL = LY_D.edge, xR = DESIGN_W - LY_D.edge - 2, half = DESIGN_W / 2 - LY_D.edge - 12;
  const label = (name, c, col, x, y, anchor, big) => { const size = big ? FS_OUT : FS.label, head = name.replace(/(\d)$/, '_$1') + ' =', val = waveText(c);
    const o = { anchor, fill: col, size, weight: big ? 700 : 600, cls: 'wlabel' + (big ? ' out' : '') };
    if(textW(head + ' ' + val, size) <= half) return txt(x, y, head + ' ' + val, Object.assign(o, { id: 'w' + name }));
    return el('g', { id: 'w' + name, class: 'wlabel2' }, txt(x, y - size * 0.6, head, o) + txt(x, y + size * 0.6, val, o)); };
  const arrow = (x0, x1, y, name, c, col) => lineArrow(x0, x1, y, col, cabs(c) < S_ZERO, name, cabs(c));
  s += arrow(bx - xa, bx, yA, 'a1', w.a1, 'var(--neutral)') + label('a1', w.a1, 'var(--neutral)', xL, yA - LY_D.aUp, 'start', false);
  s += arrow(bx + bw + xa, bx + bw, yA, 'a2', w.a2, 'var(--neutral)') + label('a2', w.a2, 'var(--neutral)', xR, yA - LY_D.aUp, 'end', false);
  s += arrow(bx, bx - xa, yB, 'b1', w.b1, colB1) + label('b1', w.b1, colB1, xL, G.lab, 'start', !fwd);
  s += arrow(bx + bw, bx + bw + xa, yB, 'b2', w.b2, colB2) + label('b2', w.b2, colB2, xR, G.lab, 'end', fwd);
  s += txt(bx - xa / 2, yA - LY_D.portUp, 'Port 1', { anchor: 'middle', fill: 'var(--mut)' }) + txt(bx + bw + xa / 2, yA - LY_D.portUp, 'Port 2', { anchor: 'middle', fill: 'var(--mut)' });
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

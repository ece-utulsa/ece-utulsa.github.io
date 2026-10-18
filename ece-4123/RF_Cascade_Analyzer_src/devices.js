/* RF Cascade Analyzer — View 2, Devices: the two-port path diagram (kept from v1.1.0 Step 2, Naming) for one device at
   a time. The four S-parameter paths run through or around the box, coloured, with stroke width proportional to |S|
   (capped at 3× with a break mark; a zero entry is a faint dotted ghost labelled 0). Below: the matrix equation and
   the four property badges. Next/Previous step through the device list. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — device list, path widths, layout
   2. State            — per-device parameters, current device
   3. Two-port drawing — box, header glyph, paths, labels, port waves
   4. Matrix and badges
   5. Panel            — the device's controls, one headline, one line of explanation
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DEVICES = ['through', 'atten', 'amp', 'iso', 'custom'];
const DEV_NAME = { through: 'Through line', atten: 'Attenuator', amp: 'Amplifier', iso: 'Isolator', custom: 'Custom' };
const PATH_W1 = 8;               // path stroke width at |S| = 1 (units)
const PATH_CAP = 3;              // widths above 3× are capped and drawn with a break mark
const S_ZERO = 0.005;            // |S| below this is drawn as a ghost and labelled 0
const ISO_MAX = 60;              // isolator reverse-isolation slider: 0..60 dB, then ∞
const MAG_MAX = 2;               // Custom |S| slider range
const LY_D = { bx: 210, bw: 480, top: 40, head: 126, inset: 30, loop: 24, arrow: 110, mat: 140, matGap: 92, badge: 30 };
const FRACTIONS = [[1 / 8, 'λ/8'], [1 / 4, 'λ/4'], [3 / 8, '3λ/8'], [1 / 2, 'λ/2'], [5 / 8, '5λ/8'], [3 / 4, '3λ/4'], [7 / 8, '7λ/8'], [1, 'λ'], [0, '0']];
const BADGES = [['reciprocal', 'Reciprocal'], ['symmetric', 'Symmetric'], ['lossless', 'Lossless'], ['passive', 'Passive']];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
// A Custom entry set { s11: [mag, deg], ... } (the Teaching example: reciprocal, lossy, not symmetric).
const customDefault = () => ({ s11: [0.3, 40], s21: [0.6, -70], s12: [0.6, -70], s22: [0.4, -20] });
const D = { dev: 'through', through: { l: 0.25 }, atten: { A: 6 }, amp: { G: 10 }, iso: { IL: 0.5, I: Infinity },
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
// ── END STATE ─────────────────────────────────────────────────

// ── TWO-PORT DRAWING ──────────────────────────────────────────
// A thin line arrow from x0 to x1 along y (the waves a and b at the ports).
function lineArrow(x0, x1, y, col, cls){
  const dir = Math.sign(x1 - x0);
  return el('path', { d: 'M' + n2(x0) + ' ' + n2(y) + 'H' + n2(x1 - dir * 12), stroke: col, 'stroke-width': 3, fill: 'none', class: cls })
    + el('path', { d: 'M' + n2(x1) + ' ' + n2(y) + 'l' + n2(-dir * 14) + ' -8v16Z', fill: col, class: cls });
}
// The device's glyph in the box header (below the "Two-Port" title).
function headerGlyph(kind, p, cx, y0){
  if(kind === 'through'){ const x0 = cx - 110, x1 = cx + 110, yr = y0 + 72, yl = y0 + 86;
    return txt(cx, y0 + 50, 'ℓ = ' + lenText(p.l), { anchor: 'middle', cls: 'ruler' })
      + el('path', { d: 'M' + x0 + ' ' + (yr - 8) + 'V' + (yl + 4) + 'M' + x1 + ' ' + (yr - 8) + 'V' + (yl + 4) + 'M' + x0 + ' ' + yr + 'H' + x1, stroke: 'var(--mut)', 'stroke-width': 1.5, class: 'ruler' })
      + el('line', { x1: x0, y1: yl, x2: x1, y2: yl, stroke: 'var(--txt)', 'stroke-width': 6, class: 'tline' })
      + txt(cx, y0 + 106, 'βℓ = 2πℓ/λ = ' + fx(FULL_TURN * p.l, 0) + '°', { anchor: 'middle' }); }
  if(kind === 'atten') return txt(cx, y0 + 76, dbText(-p.A), { anchor: 'middle', size: FS.mat, fill: 'var(--s22)', id: 'boxValue' });
  if(kind === 'amp') return txt(cx, y0 + 76, dbText(p.G), { anchor: 'middle', size: FS.mat, fill: 'var(--s21)', id: 'boxValue' });
  if(kind === 'iso') return txt(cx, y0 + 60, '→ forward: passes', { anchor: 'middle', fill: 'var(--s21)' })
    + txt(cx, y0 + 96, '← reverse: ' + (p.I === Infinity ? 'blocked' : 'mostly absorbed'), { anchor: 'middle', fill: 'var(--s12)' });
  return txt(cx, y0 + 76, '[S] set by hand', { anchor: 'middle' });
}
/* The two-port path diagram for device kind/params p in a drawing H units tall: box with a "Two-Port" header, the
   a1, b1, a2, b2 waves at the ports and the four S paths. */
function drawTwoPort(H, kind, p){
  const S = deviceS(kind, p), bx = LY_D.bx, bw = LY_D.bw, by = LY_D.top, cx = bx + bw / 2;
  const matY = H - LY_D.mat, bb = matY - LY_D.matGap, yA = by + LY_D.head + LY_D.inset, yB = bb - LY_D.inset, mid = (yA + yB) / 2, xl = bx + LY_D.loop, xr = bx + bw - LY_D.loop;
  let s = el('rect', { x: bx, y: by, width: bw, height: bb - by, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2.5, rx: 8, class: 'box' });
  s += el('line', { x1: bx, y1: by + LY_D.head, x2: bx + bw, y2: by + LY_D.head, stroke: 'var(--line)', 'stroke-width': 1.5 });
  s += txt(cx, by + 18, 'Two-Port', { anchor: 'middle', fill: 'var(--mut)', cls: 'boxTitle' });
  s += headerGlyph(kind, p, cx, by);
  // paths: [key, d, chevron point, chevron angle]
  const slope = Math.atan2(yB - yA, bw), at = (x0, y0, x1, y1, t) => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  const P = { s11: ['M' + bx + ' ' + n2(yA) + 'H' + xl + 'V' + n2(yB) + 'H' + bx, [xl, mid], Math.PI / 2],
              s22: ['M' + (bx + bw) + ' ' + n2(yA) + 'H' + xr + 'V' + n2(yB) + 'H' + (bx + bw), [xr, mid], Math.PI / 2],
              s21: ['M' + bx + ' ' + n2(yA) + 'L' + (bx + bw) + ' ' + n2(yB), at(bx, yA, bx + bw, yB, 0.22), slope],
              s12: ['M' + (bx + bw) + ' ' + n2(yA) + 'L' + bx + ' ' + n2(yB), at(bx + bw, yA, bx, yB, 0.22), Math.PI - slope] };
  const width = k => { const m = cabs(S[k]); return m < S_ZERO ? 0 : PATH_W1 * Math.min(m, PATH_CAP); };
  const order = S_KEYS.slice().sort((a, b) => width(b) - width(a));   // thick paths first, thin ones on top
  for(const k of order){ const m = cabs(S[k]), w = width(k), ghost = w === 0, capped = m > PATH_CAP;
    s += el('path', { d: P[k][0], fill: 'none', stroke: 'var(--' + k + ')', 'stroke-width': ghost ? 2 : w, 'stroke-dasharray': ghost ? DOTS : null, 'stroke-linecap': ghost ? 'round' : 'butt',
      opacity: ghost ? 0.55 : 0.9, class: 'path ' + k, 'data-q': S_NAME[k], 'data-v': +m.toPrecision(12), 'data-ref': PATH_W1, 'data-ghost': ghost ? 1 : null, 'data-capped': capped ? 1 : null });
    if(!ghost) s += chevron(P[k][1][0], P[k][1][1], P[k][2], Math.max(9, w / 2 + 6), 'var(--' + k + ')');
    if(capped){ const [x, y] = k === 's21' ? at(bx, yA, bx + bw, yB, 0.7) : k === 's12' ? at(bx + bw, yA, bx, yB, 0.7) : [k === 's11' ? xl : xr, mid + 30];
      s += breakMark(x, y, k === 's21' ? slope : k === 's12' ? Math.PI - slope : Math.PI / 2, w); } }
  // a blocked reverse path: a red ✕ on S12 when it is zero but S21 is not
  if(cabs(S.s12) < S_ZERO && cabs(S.s21) >= S_ZERO){ const [x, y] = at(bx + bw, yA, bx, yB, 0.72); s += crossMark(x, y, 12, 'var(--s22)'); }
  // labels: S11/S22 beside their loops (two lines); S21 at the top of the upper triangle and S12 at the foot of the lower
  // one, where the triangles are widest and clear of a thick path
  const lab2 = (x, k, anchor) => txt(x, mid - 12, S_NAME[k], { anchor, fill: 'var(--' + k + ')', cls: 'slabel' }) + txt(x, mid + 12, sText(S[k]), { anchor, fill: 'var(--' + k + ')', cls: 'slabel', id: 'v' + k });
  s += lab2(xl + 18, 's11', 'start') + lab2(xr - 18, 's22', 'end');
  s += txt(cx, yA, 'S21 ' + sText(S.s21), { anchor: 'middle', fill: 'var(--s21)', cls: 'slabel', id: 'vs21' });
  s += txt(cx, yB, 'S12 ' + sText(S.s12), { anchor: 'middle', fill: 'var(--s12)', cls: 'slabel', id: 'vs12' });
  // waves at the ports: a in at the top, b out at the bottom
  const xa = LY_D.arrow;
  s += lineArrow(bx - xa, bx, yA, 'var(--neutral)', 'wave') + txt(bx - xa - 10, yA, 'a_1', { anchor: 'end' });
  s += lineArrow(bx, bx - xa, yB, 'var(--neutral)', 'wave') + txt(bx - xa - 10, yB, 'b_1', { anchor: 'end' });
  s += lineArrow(bx + bw + xa, bx + bw, yA, 'var(--neutral)', 'wave') + txt(bx + bw + xa + 10, yA, 'a_2');
  s += lineArrow(bx + bw, bx + bw + xa, yB, 'var(--neutral)', 'wave') + txt(bx + bw + xa + 10, yB, 'b_2');
  s += txt(bx - xa / 2, yA - 36, 'Port 1', { anchor: 'middle', fill: 'var(--mut)' }) + txt(bx + bw + xa / 2, yA - 36, 'Port 2', { anchor: 'middle', fill: 'var(--mut)' });
  return { svg: s, S, matY };
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
// The four property badges in one row centred on y (Passive uses σmax ≤ 1).
function badgeRow(S, y){
  const P = properties(S), bw = 196, gap = 16, x0 = (DESIGN_W - 4 * bw - 3 * gap) / 2;
  return BADGES.map(([k, name], i) => { const on = P[k], x = x0 + i * (bw + gap);
    return el('g', { class: 'badge', 'data-badge': k, 'data-on': on ? 1 : 0 },
      el('rect', { x, y: y - 18, width: bw, height: 36, rx: 7, fill: 'none', stroke: on ? 'var(--txt)' : 'var(--mut)', 'stroke-width': 2, 'stroke-dasharray': on ? null : '6 4' })
      + txt(x + bw / 2, y, name + ' ' + (on ? '✓' : '✗'), { anchor: 'middle', fill: on ? 'var(--txt)' : 'var(--mut)' })); }).join('');
}
// The whole Devices drawing.
function drawDevices(H){
  const p = D[D.dev], tp = drawTwoPort(H, D.dev, p);
  return svgRoot(H, DEV_NAME[D.dev] + ': two-port with its four S-parameter paths', tp.svg + matrixEq(DESIGN_W / 2, tp.matY) + badgeRow(tp.S, H - LY_D.badge));
}
// ── END MATRIX AND BADGES ─────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// The headline readout of the current device: [key, value].
function deviceHead(){
  const S = deviceS(D.dev, D[D.dev]);
  switch(D.dev){
    case 'through': return ['Phase of S21', fx(Math.round(wrapDeg(carg(S.s21) * DEG)), 0) + '°'];
    case 'amp': return ['Gain', dbText(D.amp.G)];
    case 'iso': return ['Power back through', fmtPct(cabs(S.s12) ** 2)];
  }
  return ['Power through', fmtPct(cabs(S.s21) ** 2)];
}
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
// Side panel of the Devices view.
function panelDevices(){ const [k, v] = deviceHead(); return [headline(k, v, 'roDev'), ...deviceControls(), note(DEV_NOTE[D.dev])]; }
// Refresh the headline after a control moved (the panel is not rebuilt, so focus stays on the control).
function syncDevices(){ const [k, v] = deviceHead(), e = document.getElementById('roDev'); if(e){ e.textContent = v; e.previousSibling.textContent = k; } }
// ── END PANEL ─────────────────────────────────────────────────

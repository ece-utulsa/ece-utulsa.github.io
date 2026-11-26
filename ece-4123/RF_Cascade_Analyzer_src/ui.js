/* RF Cascade Analyzer — UI helpers: text sizes, SVG drawing primitives (built as DOM nodes, never as markup), marks
   (band arrows, arrowheads, ✕ marks, focus rings), the shared plot axis helpers, and the HTML control builders (validated
   number boxes, sliders) shared by the three views.
   Every drawing is made in a design space 900 units wide (DESIGN_W); its height follows the drawing area's aspect.
   At 1280×720 in presentation mode the drawing area is 900 px wide, so one design unit is one CSS pixel there; the drawing
   never grows past that in a window (main.js drawBox). Drawn text is never smaller than TEXT_MIN_PX on screen (v1.8.1):
   at a smaller drawing scale its size in design units grows to keep it legible. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — design width, text sizes, S colours and names, mark and control geometry, input limits
   2. Sizes            — HTML text sizes (CSS variables); the drawing scale the SVG text and targets follow
   3. SVG primitives   — elements as nodes, text, the drawing root, number formats for drawn values
   4. Marks            — arrowheads, band arrows, ✕ marks, focus rings and hit areas of drawn buttons
   5. Plot helpers     — dB axis (ticks, gridlines, labels), legend row, frame, clipped series
   6. HTML controls    — element builder, validated number boxes, sliders, readouts
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DESIGN_W = 900;            // drawing width in design units (the mock-ups' drawing area at 1280×720)
const BASE_H = 720;              // presentation sizes are given for a 720 px tall viewport, scaled with the height
const FS = { label: 16, small: 14, big: 18, head: 32, title: 20, panel: 15, mat: 18 };   // text sizes (design units / px at 720 p)
const FW = { normal: 400, semi: 600, bold: 700 };   // font weights
const SUB_SCALE = 0.8;           // letter subscript size relative to its text (never below FS.small)
const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';  // digit subscripts are written inline (Z₀₁, S₂₁), so they never drop below the line
const GLYPH_W = 0.6;             // IBM Plex Mono advance width (em), to place text without measuring
const TEXT_MIN_PX = 11.2;        // drawn text is never smaller than this on screen (CSS px; Visual V-M9 floor 11 px)
const TARGET_MIN_PX = 24;        // a drawn button's hit area is at least this wide on screen (CSS px; WCAG 2.2 SC 2.5.8)
const DASH = '10 7';
const S_KEYS = ['s11', 's21', 's12', 's22'];
const S_NAME = { s11: 'S11', s21: 'S21', s12: 'S12', s22: 'S22' };
const SVG_NS = 'http://www.w3.org/2000/svg';   // namespace of the drawn elements (an identifier, not a network address)
const GEOM_STEP = 100;           // geometry attributes are rounded to 1/GEOM_STEP of a design unit
const SIG_ZERO = 1e-9;           // sig2: a value below this is written "0"
const LOG_GUARD = 1e-12;         // sig2: guard against log10 rounding at exact powers of ten
const PCT_PER_UNIT = 100;        // fraction → percent
// band arrows: ghost (zero-power) outline thickness, head height (minimum and × thickness), head length (fraction of the
// arrow, minimum, × half-height), outline widths, fill opacity and dashes
const BAND = { ghostTh: 14, headMin: 22, headK: 1.7, lenFrac: 0.4, lenMin: 18, lenK: 1.1, ghostSw: 1.5, sw: 1, op: 0.85, ghostDash: '5 5', dash: '8 5' };
const CROSS_SW = 4;              // ✕ mark stroke width
const RING = { off: 6, sw: 3 };  // focus ring of a drawn button: offset outside the shape and stroke width (design units)
const BOX_DIGITS = 6;            // significant figures written into a number box
const DATA_SIG = 12;             // significant figures of a data-v value (read by the tests)
const DATA_DEC = 6;              // decimals of a dB data-v value
const WAVE_HALF = 4;             // a symbol's drawn wave: its control point sits 1/WAVE_HALF of the wave's width along
const AXIS = { tickGap: 22, steps: [10, 20, 30], tickPad: 6, frameSw: 1.5, gridSw: 1, legendSw: 3 };   // dB axes: ticks at least tickGap apart, chosen from steps
const CLIP_DASH = '2 4';         // a series beyond the axis is drawn dotted on the frame edge (clipped, v1.8.1)
// ── END CONSTANTS ─────────────────────────────────────────────

// ── SIZES ─────────────────────────────────────────────────────
/* Publish the HTML text sizes as CSS variables. Windowed: the base sizes. Presentation: the base sizes scaled with
   the viewport height (×1 at 720 p, ×1.5 at 1080 p), the same factor the drawing area scales by. */
function updateSizes(present){
  const k = present ? window.innerHeight / BASE_H : 1, r = document.documentElement.style;
  r.setProperty('--k', String(k));
  r.setProperty('--fl', FS.panel * k + 'px'); r.setProperty('--fh', FS.head * k + 'px'); r.setProperty('--ft', FS.title * k + 'px');
}
// The drawing scale (CSS px per design unit) of the drawing being built; main.js sets it before each draw.
const DRAW = { s: 1 };
// A text size in design units, raised so it renders at least TEXT_MIN_PX at the current drawing scale.
const fsz = size => Math.max(size, TEXT_MIN_PX / DRAW.s);
// A hit radius in design units that gives at least TARGET_MIN_PX across on screen.
const hitR = r => Math.max(r, TARGET_MIN_PX / 2 / DRAW.s);
// ── END SIZES ─────────────────────────────────────────────────

// ── SVG PRIMITIVES ────────────────────────────────────────────
// Number for a geometry attribute, rounded to 1/GEOM_STEP unit.
const n2 = v => Math.round(v * GEOM_STEP) / GEOM_STEP;
/* An SVG element node from a tag, an attribute map and children. Children may be nodes, arrays of children, or plain
   strings (always added as text nodes, never parsed as markup); null, undefined, false and '' are skipped. Geometry
   numbers are rounded; data-* values are not. */
function el(tag, attrs, ...kids){
  const e = document.createElementNS(SVG_NS, tag);
  for(const k in attrs){ const v = attrs[k]; if(v === undefined || v === null || v === false) continue;
    e.setAttribute(k, typeof v === 'number' && !k.startsWith('data-') ? String(n2(v)) : String(v)); }
  kids.flat(Infinity).forEach(c => { if(c !== null && c !== undefined && c !== false && c !== '') e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
  return e;
}
// A subscript part "_21" or "_max": digits as inline subscript characters (text), letters as a smaller lowered tspan.
const subPart = (p, subSize) => (/^_\d+$/.test(p) ? p.slice(1).replace(/\d/g, d => SUB_DIGITS[d])
  : el('tspan', { 'font-size': n2(subSize), 'baseline-shift': 'sub' }, p.slice(1)));
/* Text at (x, y), vertically centred. opts: size, anchor (start|middle|end), fill, weight, cls, id, and any extra
   attributes in opts.attrs. "S_21" or "V_max": the part after "_" up to a space or symbol is drawn as a subscript. */
function txt(x, y, s, opts){
  opts = opts || {};
  const size = fsz(opts.size || FS.label), subSize = Math.max(size * SUB_SCALE, fsz(FS.small));
  const parts = String(s).split(/(_[A-Za-z0-9]+)/).map(p => (p.startsWith('_') ? subPart(p, subSize) : p));
  return el('text', Object.assign({ x, y, 'font-size': size, 'text-anchor': opts.anchor || 'start', fill: opts.fill || 'var(--txt)', 'font-weight': opts.weight || FW.semi,
    'dominant-baseline': 'central', class: opts.cls, id: opts.id }, opts.attrs || {}), parts);
}
// Muted small label text (ticks, axis and symbol names): FS.small, muted colour, normal weight; opts override (CQ-RFC-021).
const mutedTxt = (x, y, s, opts) => txt(x, y, s, Object.assign({ size: FS.small, fill: 'var(--mut)', weight: FW.normal }, opts));
// A dB value as a data-v attribute value (read by the tests), DATA_DEC decimals (CQ-RFC-021).
const dataV = d => +d.toFixed(DATA_DEC);
// Approximate drawn width of text s at size (monospace; subscript markers do not count), at its rendered size.
const textW = (s, size) => String(s).replace(/_/g, '').length * GLYPH_W * fsz(size || FS.label);
// The drawing root: an SVG of design width W (default DESIGN_W) and height H. role: 'img' for a picture, 'group' when
// the drawing holds buttons (CQ-RFC-011: interactive children are not allowed inside role="img").
const svgRoot = (H, label, kids, W, role) => el('svg', { class: 'vis', viewBox: '0 0 ' + n2(W || DESIGN_W) + ' ' + n2(H), role: role || 'img', 'aria-label': label }, kids);
// Section heading at the top-left of a panel.
const heading = (x, y, s) => txt(x, y, s, { size: FS.label, fill: 'var(--mut)', cls: 'heading' });
// Two significant figures, as on the slides ("3.0", "0.50", "75", "100", "10"); "0" for zero, "∞" for infinity.
function sig2(v){
  if(v === Infinity) return INF; if(Math.abs(v) < SIG_ZERO) return '0';
  v = +v.toPrecision(SIG_FIGS); const d = 1 - Math.floor(Math.log10(Math.abs(v)) + LOG_GUARD);   // round first: 0.999 → 1.0
  return d <= 0 ? fx(Math.round(v / DECADE ** -d) * DECADE ** -d, 0) : fx(v, d);
}
// A fraction as a percentage to 2 significant figures with a space before the sign ("75 %", "100 %", "0.50 %").
const pct2 = f => sig2(f * PCT_PER_UNIT) + ' %';
// ── END SVG PRIMITIVES ────────────────────────────────────────

// ── MARKS ─────────────────────────────────────────────────────
/* A filled arrowhead with its tip at (x, y) pointing along the unit vector (ux, uy): len long, half wide either side.
   attrs are added to the path (fill, class). The one arrowhead shape used by every drawing (CQ-RFC-017). */
function arrowHead(x, y, ux, uy, len, half, attrs){
  const bx = x - ux * len, by = y - uy * len;
  return el('path', Object.assign({ d: 'M' + n2(x) + ' ' + n2(y) + 'L' + n2(bx - uy * half) + ' ' + n2(by + ux * half) + 'L' + n2(bx + uy * half) + ' ' + n2(by - ux * half) + 'Z' }, attrs));
}
/* A filled band arrow from x0 to x1 along y with thickness th (its encoding: thickness ∝ the quantity). The head is
   at x1 and at least BAND.headMin units tall so a thin band still shows its direction. th = 0 draws a dashed ghost
   outline. opts: col, q (data-q), v (data-v), ref (thickness at v = 1), dashed, op (fill opacity), cls. */
function bandArrow(x0, x1, y, th, opts){
  opts = opts || {};
  const dir = Math.sign(x1 - x0) || 1, ghost = th <= 0, t = ghost ? BAND.ghostTh : th, hh = Math.max(BAND.headMin, t * BAND.headK) / 2;
  const hl = Math.min(Math.abs(x1 - x0) * BAND.lenFrac, Math.max(BAND.lenMin, hh * BAND.lenK)), xh = x1 - dir * hl;
  const d = 'M' + n2(x0) + ' ' + n2(y - t / 2) + 'H' + n2(xh) + 'V' + n2(y - hh) + 'L' + n2(x1) + ' ' + n2(y) + 'L' + n2(xh) + ' ' + n2(y + hh) + 'V' + n2(y + t / 2) + 'H' + n2(x0) + 'Z';
  return el('path', { d, fill: ghost ? 'none' : opts.col, stroke: opts.col, 'stroke-width': ghost ? BAND.ghostSw : BAND.sw, 'stroke-dasharray': ghost ? BAND.ghostDash : (opts.dashed ? BAND.dash : null),
    'fill-opacity': ghost ? null : (opts.op || BAND.op), class: 'band ' + (opts.cls || ''), 'data-q': opts.q, 'data-v': opts.q ? +(+opts.v).toPrecision(DATA_SIG) : null,
    'data-ref': opts.q ? n2(opts.ref) : null, 'data-th': opts.q ? n2(ghost ? 0 : th) : null, 'data-ghost': ghost ? 1 : null });
}
// A ✕ mark of half-size r at (x, y): a blocked path, or a remove button's glyph.
function crossMark(x, y, r, col){
  return el('path', { d: 'M' + n2(x - r) + ' ' + n2(y - r) + 'L' + n2(x + r) + ' ' + n2(y + r) + 'M' + n2(x + r) + ' ' + n2(y - r) + 'L' + n2(x - r) + ' ' + n2(y + r),
    stroke: col, 'stroke-width': CROSS_SW, 'stroke-linecap': 'round', class: 'xmark' });
}
/* The focus ring of a drawn button (VIS-RFC-002): drawn RING.off outside its shape, invisible until the button has
   keyboard focus (CSS #stage [role=button]:focus-visible .fring), and distinct from the selection outline. shape: a
   rectangle { x, y, w, h, rx } or a circle { cx, cy, r }. */
function focusRing(shape){
  const o = RING.off, a = { class: 'fring', fill: 'none', 'stroke-width': RING.sw, 'pointer-events': 'none' };
  return shape.r !== undefined ? el('circle', Object.assign({ cx: shape.cx, cy: shape.cy, r: shape.r + o }, a))
    : el('rect', Object.assign({ x: shape.x - o, y: shape.y - o, width: shape.w + 2 * o, height: shape.h + 2 * o, rx: (shape.rx || 0) + o }, a));
}
// An invisible circle that makes a small drawn button's hit area at least TARGET_MIN_PX across (VIS-RFC-004).
const hitCircle = (cx, cy, r) => el('circle', { cx, cy, r: hitR(r), fill: 'transparent', stroke: 'none', class: 'hitarea' });
// ── END MARKS ─────────────────────────────────────────────────

// ── PLOT HELPERS ──────────────────────────────────────────────
/* A dB axis over [bot, top] dB drawn between y = yb (bot) and y = yt (top), x0..x1 wide (shared by every plot and
   spectrum, CQ-RFC-004): y(dB) clamps to the axis; clip(dB) tells whether a value lies beyond it (−1 below, +1 above). */
function dbAxis(bot, top, yt, yb){
  const span = top - bot;
  return { bot, top, span, yt, yb,
    y: d => yb - (yb - yt) * (Math.max(bot, Math.min(top, d)) - bot) / span,
    // y of a dB value, −∞ dB (zero power) drawn at the axis floor (CQ-RFC-021: the one place this mapping is written)
    yDb(d){ return this.y(d === -Infinity ? bot : d); },
    clip: d => (d < bot ? -1 : d > top ? 1 : 0) };
}
// The dB axis's ticks, gridlines and labels at x0..x1: ticks at least AXIS.tickGap units apart, on a whole step.
function dbTicks(ax, x0, x1){
  const step = AXIS.steps.find(t => (ax.yb - ax.yt) * t / ax.span >= AXIS.tickGap) || DECADE * Math.ceil(ax.span / DECADE);
  const out = [];
  for(let v = ax.top - step * Math.floor(ax.span / step); v <= ax.top; v += step){ const y = ax.y(v);
    out.push(el('line', { x1: x0, y1: y, x2: x1, y2: y, stroke: 'var(--line)', 'stroke-width': AXIS.gridSw, class: 'grid' }),
      mutedTxt(x0 - AXIS.tickPad, y, fmtDbVal(v, { plus: true, trim: true }), { anchor: 'end' })); }
  return out;
}
// A plot's frame rectangle.
const plotFrame = (x0, yt, x1, yb) => el('rect', { x: x0, y: yt, width: x1 - x0, height: yb - yt, fill: 'none', stroke: 'var(--mut)', 'stroke-width': AXIS.frameSw, class: 'frame' });
// The width a legend row takes (see legendRow).
const legendW = (items, sw, gap, pad) => items.reduce((a, [t]) => a + textW(t, FS.small) + gap + sw + pad, 0);
/* A plot's heading at (x, y) when it fits left of a legend reaching left to xl (with a gap of one swatch), else nothing:
   at a small drawing scale the text grows (TEXT_MIN_PX) and the legend takes the line. */
const headingIf = (x, y, s, xl, gap) => (x + textW(s, FS.label) + gap <= xl ? heading(x, y, s) : null);
/* A legend row drawn right-aligned to xr on line y: items [text, colour, swatch width, swatch dash]; each swatch is sw
   long, gap before its text and pad before the next item. */
function legendRow(xr, y, items, sw, gap, pad){
  const out = []; let lx = xr;
  items.slice().reverse().forEach(([t, col, w, dash]) => { out.push(txt(lx, y, t, { anchor: 'end', size: FS.small, fill: col, cls: 'legend' })); lx -= textW(t, FS.small) + gap;
    out.push(el('line', { x1: lx - sw, y1: y, x2: lx, y2: y, stroke: col, 'stroke-width': w || AXIS.legendSw, 'stroke-dasharray': dash || null, 'stroke-linecap': 'round' })); lx -= sw + pad; });
  return out;
}
/* A series of [x, dB] points on axis ax as path data: in-range runs as drawn lines ("d"), runs beyond the axis drawn
   along the frame edge they pass ("clipped", drawn dotted so a clipped trace never reads as the frame, VIS-RFC-007).
   A point whose value has no dB (dB = null: a power ≤ 0, PPR-RFC-001) breaks the line. */
function seriesPaths(pts, ax){
  let d = '', c = '', prev = null;
  for(const [x, db] of pts){
    if(db === null || db === undefined || Number.isNaN(db)){ prev = null; continue; }
    const k = db === -Infinity ? -1 : ax.clip(db), y = ax.yDb(db), cmd = n2(x) + ' ' + n2(y);
    if(prev === null){ if(k) c += 'M' + cmd; else d += 'M' + cmd; }
    else if(k && prev.k){ c += 'L' + cmd; }
    else if(k){ c += 'M' + prev.cmd + 'L' + cmd; d += 'L' + cmd; }
    else if(prev.k){ c += 'L' + cmd; d += 'M' + prev.cmd + 'L' + cmd; }
    else d += 'L' + cmd;
    prev = { k, cmd };
  }
  return { d, c };
}
// ── END PLOT HELPERS ──────────────────────────────────────────

// ── HTML CONTROLS ─────────────────────────────────────────────
// An HTML element: tag, properties (cls, text, attrs, on* handlers, other DOM properties) and children.
function h(tag, props, ...kids){
  const e = document.createElement(tag); props = props || {};
  for(const k in props){ const v = props[k];
    if(k === 'text') e.textContent = v; else if(k === 'cls') e.className = v; else if(k === 'attrs'){ for(const a in v) e.setAttribute(a, v[a]); }
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), v); else e[k] = v; }
  kids.flat().forEach(c => { if(c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
  return e;
}
/* Text with true subscripts for HTML (VIS-RFC-013), the same convention as drawn text (txt): "Z_L", "P_avs", "G_T" →
   letters in a <sub> element, "b_2" → the inline digit subscript b₂. Returns nodes; no markup is parsed. */
const subNodes = s => String(s).split(/(_[A-Za-z0-9]+)/).filter(p => p !== '')
  .map(p => (!p.startsWith('_') ? p : /^_\d+$/.test(p) ? p.slice(1).replace(/\d/g, d => SUB_DIGITS[d]) : h('sub', { text: p.slice(1) })));
/* A range input that never steps on PageUp/PageDown (DEFECT-RFC-008): those keys always navigate (main.js onKey), so
   the slider's own default is cancelled here too, whatever reaches it first. Returns the input. */
function rangeInput(props){
  const r = h('input', Object.assign({ type: 'range' }, props));
  r.addEventListener('keydown', e => { if(e.key === 'PageUp' || e.key === 'PageDown') e.preventDefault(); });
  return r;
}
// Set an input's value unless it has focus (the student is typing in it) or already shows it (CQ-RFC-017).
function setUnlessFocused(id, value){ const e = document.getElementById(id); if(e && e !== document.activeElement && e.value !== String(value)) e.value = value; }
// A number for a number box: 6 significant figures.
const boxNum = v => +(+v).toPrecision(BOX_DIGITS);
// The refusal message element shown under an input (aria-live, empty when the entry is accepted).
const errSpan = id => h('span', { cls: 'err', id: id + 'Err', attrs: { 'aria-live': 'polite' } });
// Show or clear an input's refusal: red outline, aria-invalid and the cause in words (CQ-RFC-012, VIS-RFC-005).
function markInput(inp, msg, cause){
  inp.classList.toggle('invalid', !!cause); inp.setAttribute('aria-invalid', String(!!cause)); msg.replaceChildren(...subNodes(cause || ''));
}
/* Check a number box's text against limits read when the entry is made (never the limits at build time, CQ-RFC-007):
   lim = { min, max, minOpen, maxOpen (the limit itself refused), integer, unit, kept, also(v) → a further cause in
   words or null }. Returns { v } or { cause } (the cause in words, with the value kept). */
function checkNumber(inp, lim){
  const t = inp.value, kept = lim.kept !== undefined ? '; keeping ' + lim.kept : '', u = lim.unit ? ' ' + lim.unit : '';
  if(t.length > INPUT_MAXLEN) return { cause: 'Refused: too long (over ' + INPUT_MAXLEN + ' characters)' + kept };
  if(t === '') return { cause: (inp.validity && inp.validity.badInput ? 'Refused: not a number' : 'Refused: empty') + kept };
  const v = +t;
  if(!isFinite(v)) return { cause: 'Refused: not a finite number' + kept };
  if(lim.integer && !Number.isInteger(v)) return { cause: 'Refused: a whole number is needed' + kept };
  const lo = lim.minOpen ? v <= lim.min : v < lim.min, hi = lim.maxOpen ? v >= lim.max : v > lim.max;
  if(lo || hi) return { cause: 'Refused: allowed ' + (lim.minOpen ? 'above ' : 'from ') + boxNum(lim.min) + (lim.maxOpen ? ' and below ' : ' to ') + boxNum(lim.max) + u + kept };
  const why = lim.also ? lim.also(v) : null;
  return why ? { cause: 'Refused: ' + why + kept } : { v };
}
/* A validated number box (CQ-RFC-017: the one number-box validator). o: id, label (aria), value, limits() →
   { min, max, integer, unit } read at each entry, kept() → text of the value in use, onok(v). Returns { inp, msg }. */
function numBox(o){
  const inp = h('input', { type: 'number', id: o.id, value: boxNum(o.value), step: o.step || 'any', attrs: { 'aria-label': o.label, 'aria-describedby': o.id + 'Err' } });
  const msg = errSpan(o.id);
  inp.addEventListener('input', () => { const r = checkNumber(inp, Object.assign({ kept: o.kept ? o.kept() : undefined }, o.limits()));
    markInput(inp, msg, r.cause); if(r.cause === undefined) o.onok(r.v); });
  return { inp, msg };
}
/* A labelled slider with a number box. o: id, label, min, max (or limits() for limits that follow the state), step,
   value, unit, toSlider(v)/fromSlider(p) for tapered sliders (smin, smax, sstep: the slider's own range), fmt(v) for
   aria-valuetext, numText(v) / placeholder for the box (an empty box with placeholder "∞" shows an infinite value),
   emptyValue (the value an empty box means, e.g. ∞), onset(v). The number box takes any value inside the current limits;
   other entries are refused with the cause in words and the last value kept. */
function slider(o){
  // slider position ↔ value (tapered sliders), and the limits now (they may follow the state)
  const toS = o.toSlider || (v => v), fromS = o.fromSlider || (p => p), lim = () => (o.limits ? o.limits() : { min: o.min, max: o.max });
  // number-box text for a value
  const l0 = lim(), num = v => (o.numText ? o.numText(v) : boxNum(v));
  const r = rangeInput({ id: o.id, min: o.smin !== undefined ? o.smin : l0.min, max: o.smax !== undefined ? o.smax : l0.max, step: o.sstep || o.step || 'any',
    value: toS(o.value), attrs: { 'aria-label': o.label } });
  let cur = o.value;
  const nb = h('input', { type: 'number', id: o.id + 'N', min: l0.min, max: l0.max, step: o.step || 'any', value: num(o.value), placeholder: o.placeholder || '',
    attrs: { 'aria-label': o.label + ' (' + o.unit + ')', 'aria-describedby': o.id + 'NErr' } });
  const msg = errSpan(o.id + 'N');
  // the slider's spoken value
  const vt = v => r.setAttribute('aria-valuetext', o.fmt ? o.fmt(v) : v + ' ' + o.unit);
  vt(o.value);
  r.addEventListener('input', () => { const v = fromS(+r.value); cur = v; nb.value = num(v); markInput(nb, msg, ''); vt(v); o.onset(v); });
  nb.addEventListener('input', () => {
    if(nb.value === '' && o.emptyValue !== undefined && !(nb.validity && nb.validity.badInput)){ cur = o.emptyValue; markInput(nb, msg, ''); r.value = toS(cur); vt(cur); o.onset(cur); return; }
    const L = lim(), c = checkNumber(nb, { min: L.min, max: L.max, unit: o.unit, kept: (o.numText ? o.numText(cur) || o.placeholder : boxNum(cur)) });
    markInput(nb, msg, c.cause); if(c.cause !== undefined) return;
    cur = c.v; r.value = toS(c.v); vt(c.v); o.onset(c.v); });
  return h('div', { cls: 'ctl' }, h('label', { htmlFor: o.id, text: o.label }), h('div', { cls: 'row' }, r, nb, h('span', { cls: 'unit', text: o.unit })), msg);
}
// A headline readout: key text above a large value (the value is a polite live region, CQ-RFC-011).
const headline = (key, value, id) => h('div', { cls: 'ro head' }, h('span', { cls: 'k' }, subNodes(key)), h('span', { cls: 'v', id, text: value, attrs: { 'aria-live': 'polite' } }));
// One line of plain explanation.
const note = (s, id) => h('p', { cls: 'note', id }, subNodes(s));
// A button that shows a pressed state.
const pbtn = (id, text, on, onclick, label) => h('button', { type: 'button', id, text, onclick, attrs: Object.assign({ 'aria-pressed': on ? 'true' : 'false' }, label ? { 'aria-label': label } : {}) });
// ── END HTML CONTROLS ─────────────────────────────────────────

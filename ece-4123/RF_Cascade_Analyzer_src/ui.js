/* RF Cascade Analyzer — UI helpers: text sizes, SVG drawing primitives (text, band arrows, chevrons, ✕ marks) that
   carry data-q / data-v for the developer tests, and HTML control builders shared by the three views.
   Every drawing is made in a design space 900 units wide (DESIGN_W); its height follows the drawing area's aspect.
   At 1280×720 in presentation mode the drawing area is 900 px wide, so one design unit is one CSS pixel there. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — design width, text sizes, S colours and names
   2. Sizes            — HTML text sizes (CSS variables) for windowed and presentation views
   3. SVG primitives   — escaping, elements, text, the drawing root
   4. Marks            — band arrows, ✕ marks
   5. HTML controls    — element builder, sliders with number boxes, readouts
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const DESIGN_W = 900;            // drawing width in design units (the mock-ups' drawing area at 1280×720)
const BASE_H = 720;              // presentation sizes are given for a 720 px tall viewport, scaled with the height
const FS = { label: 18, small: 18, head: 46, title: 20, mat: 30 };   // text sizes (design units / px at 720 p)
const SUB_SCALE = 0.8;           // subscript size relative to its text (never below FS.small)
const GLYPH_W = 0.6;             // IBM Plex Mono advance width (em), to place text without measuring
const DASH = '10 7', DOTS = '2 7';
const S_KEYS = ['s11', 's21', 's12', 's22'];
const S_NAME = { s11: 'S11', s21: 'S21', s12: 'S12', s22: 'S22' };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── SIZES ─────────────────────────────────────────────────────
/* Publish the HTML text sizes as CSS variables. Windowed: the base sizes. Presentation: the base sizes scaled with
   the viewport height (×1 at 720 p, ×1.5 at 1080 p), the same factor the drawing area scales by. */
function updateSizes(present){
  const k = present ? window.innerHeight / BASE_H : 1, r = document.documentElement.style;
  r.setProperty('--k', String(k));
  r.setProperty('--fl', FS.label * k + 'px'); r.setProperty('--fh', FS.head * k + 'px'); r.setProperty('--ft', FS.title * k + 'px');
}
// ── END SIZES ─────────────────────────────────────────────────

// ── SVG PRIMITIVES ────────────────────────────────────────────
// Escape text for SVG/HTML markup (all drawn text is built here, never raw user input).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Number for a geometry attribute, rounded to 0.01 unit.
const n2 = v => Math.round(v * 100) / 100;
// An SVG element from a tag, an attribute map and inner markup. Geometry numbers are rounded; data-* values are not.
function el(tag, attrs, inner){
  let s = '<' + tag;
  for(const k in attrs){ const v = attrs[k]; if(v === undefined || v === null || v === false) continue;
    s += ' ' + k + '="' + esc(typeof v === 'number' && !k.startsWith('data-') ? n2(v) : v) + '"'; }
  return inner === undefined ? s + '/>' : s + '>' + inner + '</' + tag + '>';
}
/* Text at (x, y), vertically centred. opts: size, anchor (start|middle|end), fill, weight, cls, id.
   "S_21" or "a_1": the part after "_" up to a space or symbol is drawn as a subscript. */
function txt(x, y, s, opts){
  opts = opts || {};
  const size = opts.size || FS.label, subSize = Math.max(size * SUB_SCALE, FS.small);
  const parts = String(s).split(/(_[A-Za-z0-9]+)/).map(p => p.startsWith('_') ? el('tspan', { 'font-size': n2(subSize), 'baseline-shift': 'sub' }, esc(p.slice(1))) : esc(p)).join('');
  return el('text', { x, y, 'font-size': size, 'text-anchor': opts.anchor || 'start', fill: opts.fill || 'var(--txt)', 'font-weight': opts.weight || 600,
    'dominant-baseline': 'central', class: opts.cls, id: opts.id }, parts);
}
// Approximate drawn width of text s at size (monospace; subscript markers do not count).
const textW = (s, size) => String(s).replace(/_/g, '').length * GLYPH_W * (size || FS.label);
// The drawing root: an SVG of design width DESIGN_W and height H, scaled to the drawing area.
const svgRoot = (H, label, inner) => el('svg', { class: 'vis', viewBox: '0 0 ' + DESIGN_W + ' ' + n2(H), role: 'img', 'aria-label': label }, inner);
// Section heading at the top-left of a panel.
const heading = (x, y, s) => txt(x, y, s, { size: FS.label, fill: 'var(--mut)', cls: 'heading' });
// Two significant figures, as on the slides ("3.0", "0.50", "75", "100", "10"); "0" for zero, "∞" for infinity.
function sig2(v){
  if(v === Infinity) return '∞'; if(Math.abs(v) < 1e-9) return '0';
  v = +v.toPrecision(2); const d = 1 - Math.floor(Math.log10(Math.abs(v)) + 1e-12);   // round first: 0.999 → 1.0
  return d <= 0 ? fx(Math.round(v / 10 ** -d) * 10 ** -d, 0) : fx(v, d);
}
// A fraction as a percentage to 2 significant figures with a space before the sign ("75 %", "100 %", "0.50 %").
const pct2 = f => sig2(f * 100) + ' %';
// ── END SVG PRIMITIVES ────────────────────────────────────────

// ── MARKS ─────────────────────────────────────────────────────
/* A filled band arrow from x0 to x1 along y with thickness th (its encoding: thickness ∝ the quantity). The head is
   at x1 and at least 22 units tall so a thin band still shows its direction. th = 0 draws a dashed ghost outline.
   opts: col, q (data-q), v (data-v), ref (thickness at v = 1), dashed, cls. */
function bandArrow(x0, x1, y, th, opts){
  opts = opts || {};
  const dir = Math.sign(x1 - x0) || 1, ghost = th <= 0, t = ghost ? 14 : th, hh = Math.max(22, t * 1.7) / 2, hl = Math.min(Math.abs(x1 - x0) * 0.4, Math.max(18, hh * 1.1));
  const xh = x1 - dir * hl;
  const d = 'M' + n2(x0) + ' ' + n2(y - t / 2) + 'H' + n2(xh) + 'V' + n2(y - hh) + 'L' + n2(x1) + ' ' + n2(y) + 'L' + n2(xh) + ' ' + n2(y + hh) + 'V' + n2(y + t / 2) + 'H' + n2(x0) + 'Z';
  return el('path', { d, fill: ghost ? 'none' : opts.col, stroke: opts.col, 'stroke-width': ghost ? 1.5 : 1, 'stroke-dasharray': ghost ? '5 5' : (opts.dashed ? '8 5' : null),
    'fill-opacity': ghost ? null : (opts.op || 0.85), class: 'band ' + (opts.cls || ''), 'data-q': opts.q, 'data-v': opts.q ? +(+opts.v).toPrecision(12) : null,
    'data-ref': opts.q ? n2(opts.ref) : null, 'data-th': opts.q ? n2(ghost ? 0 : th) : null, 'data-ghost': ghost ? 1 : null });
}
// A ✕ mark of half-size r at (x, y): a blocked path.
function crossMark(x, y, r, col){
  return el('path', { d: 'M' + n2(x - r) + ' ' + n2(y - r) + 'L' + n2(x + r) + ' ' + n2(y + r) + 'M' + n2(x + r) + ' ' + n2(y - r) + 'L' + n2(x - r) + ' ' + n2(y + r),
    stroke: col, 'stroke-width': 4, 'stroke-linecap': 'round', class: 'xmark' });
}
// ── END MARKS ─────────────────────────────────────────────────

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
/* A labelled slider with a number box. o: id, label, min, max, step, value, unit, toSlider(v)/fromSlider(p) for tapered
   sliders (smin, smax, sstep: the slider's own range), fmt(v) for aria-valuetext, numText(v) / placeholder for the box
   (an empty box with placeholder "∞" shows an infinite value), onset(v). The number box takes any
   value in [min, max]; out-of-range or empty text is flagged and ignored. */
function slider(o){
  const toS = o.toSlider || (v => v), fromS = o.fromSlider || (p => p);
  const r = h('input', { type: 'range', id: o.id, min: o.smin !== undefined ? o.smin : o.min, max: o.smax !== undefined ? o.smax : o.max, step: o.sstep || o.step || 'any',
    value: toS(o.value), attrs: { 'aria-label': o.label } });
  const num = v => (o.numText ? o.numText(v) : +(+v).toPrecision(6));
  const nb = h('input', { type: 'number', id: o.id + 'N', min: o.min, max: o.max, step: o.step || 'any', value: num(o.value), placeholder: o.placeholder || '', attrs: { 'aria-label': o.label + ' (' + o.unit + ')' } });
  const vt = v => r.setAttribute('aria-valuetext', o.fmt ? o.fmt(v) : v + ' ' + o.unit);
  vt(o.value);
  r.addEventListener('input', () => { const v = fromS(+r.value); nb.value = num(v); nb.classList.remove('invalid'); nb.setAttribute('aria-invalid', 'false'); vt(v); o.onset(v); });
  nb.addEventListener('input', () => { const v = +nb.value, okv = nb.value !== '' && isFinite(v) && v >= o.min && v <= o.max;
    nb.classList.toggle('invalid', !okv); nb.setAttribute('aria-invalid', okv ? 'false' : 'true'); if(!okv) return; r.value = toS(v); vt(v); o.onset(v); });
  return h('div', { cls: 'ctl' }, h('label', { htmlFor: o.id, text: o.label }), h('div', { cls: 'row' }, r, nb, h('span', { cls: 'unit', text: o.unit })));
}
// A headline readout: key text above a large value.
const headline = (key, value, id) => h('div', { cls: 'ro head' }, h('span', { cls: 'k', text: key }), h('span', { cls: 'v', id, text: value }));
// One line of plain explanation.
const note = s => h('p', { cls: 'note', text: s });
// A button that shows a pressed state.
const pbtn = (id, text, on, onclick, label) => h('button', { type: 'button', id, text, onclick, attrs: Object.assign({ 'aria-pressed': on ? 'true' : 'false' }, label ? { 'aria-label': label } : {}) });
// ── END HTML CONTROLS ─────────────────────────────────────────

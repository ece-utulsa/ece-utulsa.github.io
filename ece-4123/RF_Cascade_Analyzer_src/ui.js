/* RF Cascade Analyzer — UI helpers: text sizes for windowed and presentation views, SVG drawing primitives (arrows,
   bars, text) that follow the spec A.7 encoding rules and carry data-q / data-v (A.6.2), and HTML control builders.
   SVG is drawn in real CSS pixels (no viewBox scaling), so drawn lengths and font sizes are what the page shows. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — text sizes, arrow encoding limits, S colours and names
   2. Sizes            — windowed and presentation text sizes (spec A.6.4, A.6.5)
   3. SVG primitives   — escaping, elements, text, patterns
   4. Encodings        — amplitude arrows, power arrows, power-bar segments (spec A.7)
   5. HTML controls    — element builder, sliders with number boxes, buttons, readouts
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const BASE_H = 720;              // presentation sizes are given for a 720 px tall viewport (spec A.6.4)
const PRESENT_PX = { any: 24, label: 32, title: 40, head: 56 };   // minimum sizes at 1280×720, ×1.5 at 1080 p
const WINDOW_PX = { any: 14, label: 16, title: 18, head: 26 };    // windowed and Lab (≥ 14 px at 1366×768, A.6.5)
const ARROW_CAP = 2.5;           // amplitude arrows longer than 2.5·L_ref are capped with a break mark (A.7)
const ARROW_GHOST = 0.005;       // below 0.005·|a_ref| an arrow is a dashed ghost (A.7)
const STROKE = 4, STROKE_POWER = 10, HEAD = 14;   // arrow stroke widths and head length (px, windowed)
const DASH = '10 7', DASH_GHOST = '4 6';
const SUB_SCALE = 0.75;           // subscript size relative to its text
const S_KEYS = ['s11', 's21', 's12', 's22'];
const S_NAME = { s11: 'S11', s21: 'S21', s12: 'S12', s22: 'S22' };
const S_PORT = { s11: [1, 1], s21: [2, 1], s12: [1, 2], s22: [2, 2] };   // S_ij: out at port i, in at port j
const S_TITLE = { s11: 'input reflection', s21: 'forward transmission', s12: 'reverse transmission (isolation)', s22: 'output reflection' };
const S_MEANING = { s11: 'reflected at port 1 (Γ at port 1)', s21: 'port 1 → port 2: gain or loss',
                    s12: 'port 2 → port 1: isolation', s22: 'reflected at port 2 (Γ at port 2)' };
// ── END CONSTANTS ─────────────────────────────────────────────

// ── SIZES ─────────────────────────────────────────────────────
let sz = Object.assign({}, WINDOW_PX), scale = 1;   // current text sizes (px) and drawing scale
// Recompute the text sizes for the current view and publish them as CSS variables (--fa, --fl, --ft, --fh).
function updateSizes(present){
  scale = present ? window.innerHeight / BASE_H : 1;
  const base = present ? PRESENT_PX : WINDOW_PX;
  sz = { any: base.any * scale, label: base.label * scale, title: base.title * scale, head: base.head * scale };
  if(!present) sz = Object.assign({}, WINDOW_PX);
  const r = document.documentElement.style;
  r.setProperty('--fa', sz.any + 'px'); r.setProperty('--fl', sz.label + 'px'); r.setProperty('--ft', sz.title + 'px'); r.setProperty('--fh', sz.head + 'px');
}
// Stroke width scaled with the view.
const sw = w => w * Math.max(1, scale);
// ── END SIZES ─────────────────────────────────────────────────

// ── SVG PRIMITIVES ────────────────────────────────────────────
// Escape text for SVG/HTML markup (all text the stage draws is built here, never raw user input).
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Number for a geometry attribute, rounded to 0.01 px.
const n2 = v => Math.round(v * 100) / 100;
// An SVG element from a tag, an attribute map and inner markup. Geometry numbers are rounded; data-* values are not.
function el(tag, attrs, inner){
  let s = '<' + tag;
  for(const k in attrs){ const v = attrs[k]; if(v === undefined || v === null || v === false) continue; s += ' ' + k + '="' + esc(typeof v === 'number' && !k.startsWith('data-') ? n2(v) : v) + '"'; }
  return inner === undefined ? s + '/>' : s + '>' + inner + '</' + tag + '>';
}
/* Text at (x, y). opts: size (px), anchor (start|middle|end), fill, weight, base (dominant-baseline), cls.
   Subscripts are written "S_11" or "a_1": the part after "_" up to a space is drawn as a subscript. */
function txt(x, y, s, opts){
  opts = opts || {};
  const size = opts.size || sz.label, subSize = Math.max(size * SUB_SCALE, sz.any);   // a subscript is never below "any text"
  const parts = String(s).split(/(_[A-Za-z0-9]+)/).map(p => p.startsWith('_') ? el('tspan', { 'font-size': n2(subSize), 'baseline-shift': 'sub' }, esc(p.slice(1))) : esc(p)).join('');
  return el('text', { x, y, 'font-size': size, 'text-anchor': opts.anchor || 'start', fill: opts.fill || 'var(--txt)',
    'font-weight': opts.weight || 600, 'dominant-baseline': opts.base || 'middle', class: opts.cls }, parts);
}
// Text lines from (x, y) downward, one line every 1.35 × size (room for subscripts).
const txtLines = (x, y, lines, opts) => lines.map((t, i) => txt(x, y + i * (opts.size || sz.label) * 1.35, t, opts)).join('');
// Hatch and dot patterns for power-bar segments (colour is never the only cue, WCAG 1.4.1).
function patterns(){
  const hatch = (id, col) => el('pattern', { id, width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
    el('rect', { width: 10, height: 10, fill: col, 'fill-opacity': 0.35 }) + el('line', { x1: 0, y1: 0, x2: 0, y2: 10, stroke: col, 'stroke-width': 4 }));
  const dots = (id, col) => el('pattern', { id, width: 9, height: 9, patternUnits: 'userSpaceOnUse' },
    el('rect', { width: 9, height: 9, fill: col, 'fill-opacity': 0.3 }) + el('circle', { cx: 4.5, cy: 4.5, r: 2, fill: col }));
  const cross = (id, col) => el('pattern', { id, width: 12, height: 12, patternUnits: 'userSpaceOnUse' },
    el('rect', { width: 12, height: 12, fill: col, 'fill-opacity': 0.3 }) + el('path', { d: 'M0 6H12M6 0V12', stroke: col, 'stroke-width': 2 }));
  return el('defs', {}, hatch('pRefl', 'var(--s11)') + dots('pAbs', 'var(--abs)') + hatch('pAdd', 'var(--s21)') + cross('pRev', 'var(--s22)'));
}
// ── END SVG PRIMITIVES ────────────────────────────────────────

// ── ENCODINGS ─────────────────────────────────────────────────
/* An amplitude arrow (spec A.7) from (x, y) pointing dir (+1 right, −1 left), for value v relative to the driving
   wave (|a_ref| = 1) drawn at Lref px. Returns { svg, len, end } where end is the x of the head tip.
   opts: col, dashed (reflected path), q (data-q name), label (text placed beyond the arrow), lab (label position:
   'above' | 'below' | 'end'), lx / la (label x and text-anchor, overriding the centred default), dim (faded, not
   highlighted), w (stroke width). */
function ampArrow(x, y, dir, v, Lref, opts){
  opts = opts || {};
  const ghost = v < ARROW_GHOST, capped = v > ARROW_CAP;
  const len = ghost ? Lref : (capped ? ARROW_CAP : v) * Lref, end = x + dir * len, w = sw(opts.w || STROKE), hd = Math.min(sw(HEAD), len * 0.5);
  const col = opts.col || 'var(--neutral)';
  const shaft = 'M' + n2(x) + ' ' + n2(y) + 'H' + n2(end - dir * hd);
  const head = 'M' + n2(end) + ' ' + n2(y) + 'L' + n2(end - dir * hd) + ' ' + n2(y - hd * 0.6) + 'L' + n2(end - dir * hd) + ' ' + n2(y + hd * 0.6) + 'Z';
  let g = el('path', { d: shaft, stroke: col, 'stroke-width': w, fill: 'none', 'stroke-dasharray': ghost ? DASH_GHOST : (opts.dashed ? DASH : null) })
        + el('path', { d: head, fill: ghost ? 'none' : col, stroke: col, 'stroke-width': ghost ? sw(1.5) : 0, 'stroke-dasharray': ghost ? '3 3' : null });
  if(capped){ const bx = x + dir * len * 0.55;   // break mark ≈ across the shaft
    g += el('path', { d: 'M' + n2(bx - 6) + ' ' + n2(y + 10) + 'l8 -20M' + n2(bx + 2) + ' ' + n2(y + 10) + 'l8 -20', stroke: 'var(--bg)', 'stroke-width': sw(5) })
       + el('path', { d: 'M' + n2(bx - 6) + ' ' + n2(y + 10) + 'l8 -20M' + n2(bx + 2) + ' ' + n2(y + 10) + 'l8 -20', stroke: col, 'stroke-width': sw(2) }); }
  const attrs = { class: 'arrow', 'data-q': opts.q, 'data-v': opts.q ? +v.toPrecision(12) : null, 'data-ref': opts.q ? n2(Lref) : null,
                  'data-ghost': ghost ? 1 : null, 'data-capped': capped ? 1 : null, opacity: opts.dim ? 0.3 : null };
  let svg = el('g', attrs, g);
  if(opts.label){ const lab = opts.lab || 'above', fs = opts.size || sz.label;
    const lx = opts.lx !== undefined ? opts.lx : lab === 'end' ? end + dir * 8 : (x + end) / 2, ly = lab === 'above' ? y - w / 2 - 6 - fs * 0.5 : lab === 'below' ? y + w / 2 + 6 + fs * 0.5 : y;
    svg += txt(lx, ly, opts.label, { anchor: opts.la || (lab === 'end' ? (dir > 0 ? 'start' : 'end') : 'middle'), fill: col, size: fs, cls: opts.dim ? 'dim' : null }); }
  return { svg, len, end };
}
/* A power arrow (Step 1a): a thick arrow whose length is proportional to its power fraction f of the incident (Lref
   at f = 1), with a dashed ghost at zero. */
function powArrow(x, y, dir, f, Lref, opts){
  opts = opts || {}; const len = f * Lref, ghost = f < ARROW_GHOST, drawn = ghost ? Lref * 0.5 : len, end = x + dir * drawn, th = sw(STROKE_POWER), hd = Math.min(sw(HEAD * 1.4), drawn * 0.5);
  const col = opts.col || 'var(--neutral)';
  const d = 'M' + n2(x) + ' ' + n2(y - th / 2) + 'H' + n2(end - dir * hd) + 'V' + n2(y - th) + 'L' + n2(end) + ' ' + n2(y) + 'L' + n2(end - dir * hd) + ' ' + n2(y + th) + 'V' + n2(y + th / 2) + 'H' + n2(x) + 'Z';
  const svg = el('g', { class: 'power', 'data-q': opts.q, 'data-v': +f.toPrecision(12), 'data-ref': n2(Lref), 'data-ghost': ghost ? 1 : null },
    el('path', { d, fill: ghost ? 'none' : (opts.fill || col), stroke: col, 'stroke-width': sw(2), 'stroke-dasharray': ghost ? DASH_GHOST : (opts.dashed ? '8 5' : null) }));
  return { svg, len: drawn, end };
}
/* A horizontal power-bar segment at (x, y) of width f·W100 (W100 = the 100 % width). opts: fill, col, q, label,
   cap (max drawn fraction; beyond it a break mark is drawn and data-capped set), h (height). */
function barSeg(x, y, f, W100, opts){
  opts = opts || {}; const capped = opts.cap !== undefined && f > opts.cap, w = Math.max(0, (capped ? opts.cap : f) * W100), bh = opts.h || sw(36);
  let g = el('rect', { x, y, width: w, height: bh, fill: opts.fill, stroke: opts.col, 'stroke-width': sw(2) });
  if(capped){ const bx = x + w - sw(18);
    g += el('path', { d: 'M' + n2(bx) + ' ' + n2(y + bh + 4) + 'l10 ' + n2(-bh - 8) + 'M' + n2(bx + 8) + ' ' + n2(y + bh + 4) + 'l10 ' + n2(-bh - 8), stroke: 'var(--bg)', 'stroke-width': sw(6) }); }
  return { svg: el('g', { class: 'seg', 'data-q': opts.q, 'data-v': +f.toPrecision(12), 'data-ref': n2(W100), 'data-capped': capped ? 1 : null }, g), w };
}
// ── END ENCODINGS ─────────────────────────────────────────────

// ── HTML CONTROLS ─────────────────────────────────────────────
// An HTML element: tag, properties (class, id, text, attrs, on handlers) and children.
function h(tag, props, ...kids){
  const e = document.createElement(tag); props = props || {};
  for(const k in props){ const v = props[k];
    if(k === 'text') e.textContent = v; else if(k === 'cls') e.className = v; else if(k === 'attrs'){ for(const a in v) e.setAttribute(a, v[a]); }
    else if(k.startsWith('on')) e.addEventListener(k.slice(2), v); else e[k] = v; }
  kids.flat().forEach(c => { if(c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
  return e;
}
/* A labelled slider with a number box. o: id, label, min, max, step, value, unit, toSlider(v)/fromSlider(p) for
   tapered sliders, fmt(v) for aria-valuetext, onset(v). The number box accepts any value in range; both stay in step. */
function slider(o){
  const toS = o.toSlider || (v => v), fromS = o.fromSlider || (p => p), smin = o.smin !== undefined ? o.smin : o.min, smax = o.smax !== undefined ? o.smax : o.max;
  const val = () => o.value;
  const r = h('input', { type: 'range', id: o.id, min: smin, max: smax, step: o.sstep || o.step || 'any', value: toS(val()), attrs: { 'aria-label': o.label } });
  const nb = h('input', { type: 'number', id: o.id + 'N', min: o.min, max: o.max, step: o.step || 'any', value: o.numText ? o.numText(val()) : val(), attrs: { 'aria-label': o.label + ' (' + o.unit + ')' } });
  const vt = v => r.setAttribute('aria-valuetext', o.fmt ? o.fmt(v) : v + ' ' + o.unit);
  vt(val());
  r.addEventListener('input', () => { const v = fromS(+r.value); nb.value = o.numText ? o.numText(v) : +(+v).toPrecision(6); nb.classList.remove('invalid'); vt(v); o.onset(v); });
  nb.addEventListener('input', () => { const v = +nb.value; const okv = nb.value !== '' && isFinite(v) && v >= o.min && v <= o.max;
    nb.classList.toggle('invalid', !okv); nb.setAttribute('aria-invalid', okv ? 'false' : 'true'); if(!okv) return; r.value = toS(v); vt(v); o.onset(v); });
  return h('div', { cls: 'ctl' }, h('label', { htmlFor: o.id, text: o.label }), h('div', { cls: 'row' }, r, nb, h('span', { text: o.unit })));
}
/* A readout row: key text and value. kind: 'head' (headline, ≥ 56 px in presentation; a polar value may wrap before
   its ∠), 'lab' (label size), 'line' (key and value on one line, both label size) or 'sub' (plain value). */
function ro(key, value, kind, cls){
  const v = h('span', { cls: 'v ' + (cls || '') }), at = String(value).indexOf(ANGLE_SIGN);
  if(kind === 'head' && at > 0) v.append(String(value).slice(0, at), h('wbr'), String(value).slice(at)); else v.textContent = value;
  return h('div', { cls: 'ro ' + (kind || 'lab') }, h('span', { cls: 'k ' + (kind === 'line' ? cls || '' : ''), text: key }), v);
}
// ── END HTML CONTROLS ─────────────────────────────────────────

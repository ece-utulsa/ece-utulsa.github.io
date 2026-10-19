/* RF Cascade Analyzer — View 3, Cascade (mock-up v3): build a chain source → up to 4 two-port blocks → load, see the
   forward power as a green band ("river") whose height is proportional to |a_k|² at each junction, the reflected
   power |b_k|² as orange backward arrows, and the dB budget. Every block is a two-port whose S-parameters can be
   edited. The source is matched (Γ_s = 0) and drives a unit incident wave, so "input = 1". */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — limits, block defaults, layout
   2. State            — blocks, selection, load
   3. Solution         — S of each block, junction waves, overall S, G_T
   4. Drawing          — chain, power flow, budget
   5. Interaction      — select, add, remove (clicks and keys on the drawing)
   6. Panel            — block editor, whole chain as one two-port, load
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const Z0_CASC = 50;              // reference impedance (Ω)
const MAX_BLOCKS = 4;
const BLOCK_TYPES = ['through', 'atten', 'amp', 'iso', 'custom'];
const BLOCK_DEFAULT = { through: () => ({ l: 0.25 }), atten: () => ({ A: 3 }), amp: () => ({ G: 10 }), iso: () => ({ IL: 0.5, I: Infinity }),
                        custom: () => ({ e: customDefault(), recip: true }) };
const MATCH_EPS = 0.01;          // |S11| below this: "source sees a match"
const RIVER_UNIT = 36;           // band height for power 1 when nothing in the chain is larger
const REFL_X = 3, REFL_MAX = 30; // reflected arrows are drawn REFL_X× the band scale, reduced so none is thicker than REFL_MAX
/* Layout (design units = px at 1280×720). s2: top of the flow panel; s3up: the budget panel's height. Flow panel rows from
   s2: heading (headY), two caption lines (cap1, cap2), the river arithmetic (arY, a second line arDy lower when it needs
   two), the junction values (jGap below the arithmetic, jUp above the band), the band, and below it the reflected arrows
   and values (below). Budget rows from its top: heading and total (headY), the dB (bud1) and power factor (bud2). */
const LY_K = { edge: 16, src: 52, srcR: 26, chainY: 100, bh: 80, bw: 120, left: 100, loadW: 100, plusR: 16, plusW: 40, s2: 176, s3up: 104,
               headY: 14, cap1: 38, cap2: 62, arY: 90, arDy: 24, jGap: 30, jUp: 16, below: 100, bud1: 42, bud2: 68 };
const FS_CAP = 14;               // caption lines under the flow heading (muted)
const RERE = '↺';                // marks a junction whose forward power includes waves reflected back from later blocks
// Top of the band area below the flow panel's top, with nA lines of river arithmetic.
const riverTop = nA => LY_K.arY + (nA - 1) * LY_K.arDy + LY_K.jGap + LY_K.jUp;
// Tallest band (units) for a drawing H units tall; the band scale is the smaller of RIVER_UNIT and this over the largest power.
const riverMax = (H, nA) => H - LY_K.s3up - LY_K.s2 - riverTop(nA) - LY_K.below;
// ── END CONSTANTS ─────────────────────────────────────────────

// ── STATE ─────────────────────────────────────────────────────
// The briefing's check case: Amplifier 10 dB → Attenuator 3 dB → Custom → 100 Ω.
const K = { blocks: [{ type: 'amp', p: { G: 10 } }, { type: 'atten', p: { A: 3 } },
                     { type: 'custom', p: { e: { s11: [0.2, 30], s21: [0.9, -45], s12: [0.9, -45], s22: [0.2, 30] }, recip: true } }],
            sel: 0, menu: false, load: { kind: 'value', z: 100 }, est: null };   // est: the S entry set in the editor
// Load impedance object.
const loadOf = () => (K.load.kind === 'open' ? OPEN_LOAD : zLoad(C(K.load.kind === 'short' ? 0 : K.load.kind === 'match' ? Z0_CASC : K.load.z, 0)));
// Load as text.
const loadText = () => (K.load.kind === 'open' ? '∞ (open)' : K.load.kind === 'short' ? '0 (short)' : fx(K.load.kind === 'match' ? Z0_CASC : K.load.z, 0) + ' Ω');
// ── END STATE ─────────────────────────────────────────────────

// ── SOLUTION ──────────────────────────────────────────────────
// The block's one key value as text (+10 dB, −3 dB, λ/4 …).
function keyValue(b){
  switch(b.type){
    case 'through': return 'ℓ = ' + lenText(b.p.l);
    case 'atten': return dbText(-b.p.A);
    case 'amp': return dbText(b.p.G);
    case 'iso': return dbText(-b.p.IL);
  }
  const m = cabs(customS(b.p.e).s21); return m < S_ZERO ? '−∞ dB' : dbText(dbOf(m));
}
// The chain solved with a unit incident wave from a matched source: junction waves a_k, b_k (k = 0 … N), overall S, G_T.
function solveChain(){
  const devs = K.blocks.map(b => deviceS(b.type, b.p)), GL = gammaLoad(loadOf(), Z0_CASC), setup = branchSetup(devs, GL);
  const nodes = propagate(devs, setup, ONE, Z0_CASC), St = overallS(devs), GT = transducerGain(St, ZERO, GL);
  return { devs, GL, St, GT, fwd: nodes.map(n => cabs(n.a) ** 2), refl: nodes.map(n => cabs(n.b) ** 2) };
}
// A power relative to the input, to 2 significant figures; exactly 1 (the input itself) is written "1".
const relText = p => (Math.abs(p - 1) < 1e-9 ? '1' : sig2(p));
// A block's |S21| in dB (−∞ when blocked) and its power factor |S21|².
const blockDb = S => dbOf(cabs(S.s21)), blockGain = S => cabs(S.s21) ** 2;
// A dB value to 1 decimal with its sign ("+10.0", "−3.0", "−∞").
const db1 = db => (db === -Infinity ? '−∞' : (db > 0.05 ? '+' : '') + fx(db, 1));
// ── END SOLUTION ──────────────────────────────────────────────

// ── DRAWING ───────────────────────────────────────────────────
/* x positions: each block's left edge, the load's left edge, the junction x's (junction 0 between the source and block
   1, junction N at the load), and the "+" centre. The "+" has its own slot on the wire after the last block, with the
   same gap on both sides (the slot is kept at 4 blocks, where the "+" is disabled). */
function chainGeo(){
  const N = K.blocks.length, loadX = DESIGN_W - LY_K.edge - LY_K.loadW, span = loadX - LY_K.left, gap = (span - N * LY_K.bw - LY_K.plusW) / (N + 2);
  const bx = K.blocks.map((_, i) => LY_K.left + gap + i * (LY_K.bw + gap));
  const jx = [(LY_K.src + LY_K.srcR + bx[0]) / 2].concat(bx.map((x, i) => (i < N - 1 ? (x + LY_K.bw + bx[i + 1]) / 2 : (x + LY_K.bw + loadX) / 2)));
  return { N, bx, loadX, jx, gap, plusX: bx[N - 1] + LY_K.bw + gap + LY_K.plusW / 2, plusY: LY_K.chainY };
}
// A clickable group on the drawing (role=button, keyboard focusable).
const btnG = (attrs, label, inner) => el('g', Object.assign({ role: 'button', tabindex: 0, 'aria-label': label, class: 'hit' }, attrs), inner);
// "Build the chain": source, blocks (type and key value, × to remove, the selected one highlighted), "+", load.
function drawChain(G){
  const y = LY_K.chainY, top = y - LY_K.bh / 2;
  let s = heading(LY_K.edge, 14, 'Build the chain');
  s += el('line', { x1: LY_K.src + LY_K.srcR, y1: y, x2: G.loadX, y2: y, stroke: 'var(--mut)', 'stroke-width': 2, class: 'wire' });
  s += el('circle', { cx: LY_K.src, cy: y, r: LY_K.srcR, fill: 'var(--panel)', stroke: 'var(--txt)', 'stroke-width': 2.5 });
  s += el('path', { d: 'M' + (LY_K.src - 14) + ' ' + y + 'c5 -12 9 -12 14 0s9 12 14 0', fill: 'none', stroke: 'var(--txt)', 'stroke-width': 2.5 });
  s += txt(LY_K.src, y + LY_K.srcR + 20, 'Source', { anchor: 'middle', fill: 'var(--mut)' });
  K.blocks.forEach((b, i) => { const x = G.bx[i], on = i === K.sel, cx = x + LY_K.bw / 2;
    s += btnG({ 'data-blk': i, 'aria-pressed': on ? 'true' : 'false' }, 'Block ' + (i + 1) + ': ' + DEV_NAME[b.type] + ' ' + keyValue(b) + (on ? ' (selected)' : ''),
      el('rect', { x, y: top, width: LY_K.bw, height: LY_K.bh, rx: 8, fill: 'var(--panel)', stroke: on ? 'var(--focus)' : 'var(--txt)', 'stroke-width': on ? 5 : 2, class: 'block' + (on ? ' sel' : '') })
      + txt(cx, top + 24, DEV_NAME[b.type].split(' ')[0], { anchor: 'middle' })
      + txt(cx, top + 54, keyValue(b), { anchor: 'middle', fill: b.type === 'amp' ? 'var(--s21)' : 'var(--txt)', cls: 'keyv' }));
    if(G.N > 1) s += btnG({ 'data-del': i }, 'Remove block ' + (i + 1),
      el('circle', { cx: x + LY_K.bw, cy: top, r: 12, fill: 'var(--bg)', stroke: 'var(--mut)', 'stroke-width': 1.5 }) + crossMark(x + LY_K.bw, top, 5, 'var(--mut)')); });
  // "+" in its own slot on the wire after the last block; disabled and greyed at MAX_BLOCKS ("Up to 4 blocks")
  const full = G.N >= MAX_BLOCKS, px = G.plusX, py = G.plusY, pc = full ? 'var(--mut)' : 'var(--txt)';
  s += btnG({ 'data-add': 1, 'aria-expanded': K.menu ? 'true' : 'false', 'aria-disabled': full ? 'true' : null, opacity: full ? 0.35 : null },
    full ? 'Add a block: up to ' + MAX_BLOCKS + ' blocks' : 'Add a block after block ' + G.N,
    el('title', {}, full ? 'Up to ' + MAX_BLOCKS + ' blocks' : 'Add a block') + el('circle', { cx: px, cy: py, r: LY_K.plusR, fill: 'var(--panel)', stroke: pc, 'stroke-width': 2 })
    + el('path', { d: 'M' + n2(px - 8) + ' ' + py + 'h16M' + n2(px) + ' ' + (py - 8) + 'v16', stroke: pc, 'stroke-width': 3 }));
  s += el('rect', { x: G.loadX, y: top, width: LY_K.loadW, height: LY_K.bh, rx: 8, fill: 'var(--bg2)', stroke: 'var(--txt)', 'stroke-width': 2, class: 'load' });
  s += txt(G.loadX + LY_K.loadW / 2, top + 24, 'Load', { anchor: 'middle' }) + txt(G.loadX + LY_K.loadW / 2, top + 54, K.load.kind === 'open' ? '∞' : loadText().replace(' (short)', ' Ω'), { anchor: 'middle', id: 'loadVal' });
  return s;
}
/* The river arithmetic over each block: "a × f = b" (a the junction value before it, f its power factor, b the next
   junction value) when the shown product equals the shown next value; otherwise only "× f ↺" (the forward power there
   includes waves reflected back from later in the chain). Returns per block { lines, text, rere }: lines are 1 or 2
   (split before "="), as wide as the block pitch allows. */
function riverArith(G, sol){
  const pitch = LY_K.bw + G.gap;
  const parts = sol.devs.map((S, i) => { const a = sol.fwd[i], f = blockGain(S), ok = sig2(a * f) === sig2(sol.fwd[i + 1]);
    return ok ? [relText(a) + ' × ' + sig2(f), '= ' + relText(sol.fwd[i + 1])] : ['× ' + sig2(f) + ' ' + RERE]; });
  const one = parts.every(p => textW(p.join(' ')) + 12 <= pitch);
  return { n: one || parts.every(p => p.length === 1) ? 1 : 2, items: parts.map(p => ({ lines: one ? [p.join(' ')] : p, text: p.join(' '), rere: p.length === 1 })) };
}
// "Forward power at each junction": the forward-power band, its value at each junction, the river arithmetic, and the
// reflected-power arrows.
function drawFlow(G, sol, H){
  const L = LY_K, AR = riverArith(G, sol), RM = riverMax(H, AR.n), y0 = L.s2, pmax = Math.max(...sol.fwd), sc = Math.min(RIVER_UNIT, RM / Math.max(pmax, 1e-9));
  const yr = y0 + riverTop(AR.n) + RM / 2, rmax = Math.max(...sol.refl), rx = Math.min(REFL_X, REFL_MAX / Math.max(sc * rmax, 1e-9));
  let s = heading(L.edge, y0 + L.headY, 'Forward power at each junction (input power = 1)');
  const cap = (y, t, id) => txt(L.edge, y, t, { size: FS_CAP, fill: 'var(--mut)', weight: 400, cls: 'caption16', id });
  s += cap(y0 + L.cap1, 'reflected arrows drawn ' + (rx === REFL_X ? REFL_X : fx(rx, 1)) + '× thicker', 'thickCap');
  if(AR.items.some(a => a.rere)) s += cap(y0 + L.cap2, RERE + ' forward power here includes waves reflected back from later in the chain.', 'rereCap');
  // band outline: constant across each junction gap, tapering across each block, arrowhead into the load
  const hk = sol.fwd.map(p => p * sc), x0 = L.src + L.srcR, pts = [[x0, hk[0]]];
  G.bx.forEach((x, i) => { pts.push([x, hk[i]], [x + L.bw, hk[i + 1]]); });
  const hN = hk[G.N], head = Math.max(16, hN * 0.6), xe = G.loadX - head;
  pts.push([xe, hN]);
  const up = pts.map(([x, hh], i) => (i ? 'L' : 'M') + n2(x) + ' ' + n2(yr - hh / 2)).join(''), dn = pts.slice().reverse().map(([x, hh]) => 'L' + n2(x) + ' ' + n2(yr + hh / 2)).join('');
  const hh2 = Math.max(hN, 20) / 2 + 6;
  s += el('path', { d: up + 'L' + n2(xe) + ' ' + n2(yr - hh2) + 'L' + n2(G.loadX) + ' ' + n2(yr) + 'L' + n2(xe) + ' ' + n2(yr + hh2) + dn + 'Z', fill: 'var(--s21)', 'fill-opacity': 0.5,
    stroke: 'var(--s21)', 'stroke-width': 1.5, class: 'river' });
  // band height at x (the outline is piecewise linear), and its largest value over [xa, xb]
  const bandAt = x => { for(let i = 1; i < pts.length; i++){ const [x0p, h0] = pts[i - 1], [x1p, h1] = pts[i];
    if(x <= x1p) return x1p > x0p ? h0 + (h1 - h0) * Math.max(0, x - x0p) / (x1p - x0p) : h1; }
    return x < G.loadX ? 2 * hh2 * (G.loadX - x) / (G.loadX - xe) : 0; };
  const bandMax = (xa, xb) => { let m = 0; for(let x = xa; x <= xb; x += 2) m = Math.max(m, bandAt(x)); return m; };
  sol.fwd.forEach((p, k) => { const t = relText(p) + ' × input', w = textW(t) / 2 + 6;
    s += el('line', { x1: G.jx[k], y1: yr - hk[k] / 2, x2: G.jx[k], y2: yr + hk[k] / 2, stroke: 'var(--s21)', 'stroke-width': 0, class: 'jmark', 'data-q': 'fwd' + k, 'data-v': +p.toPrecision(12), 'data-ref': n2(sc), 'data-th': n2(hk[k]) });
    s += txt(G.jx[k], yr - bandMax(G.jx[k] - w, G.jx[k] + w) / 2 - L.jUp, t, { anchor: 'middle', fill: 'var(--s21)', cls: 'fwdv', id: 'fwd' + k }); });
  // the arithmetic over each block, in the rows above the junction values
  AR.items.forEach((a, i) => { const cx = G.bx[i] + L.bw / 2;
    s += el('g', { class: 'arith', id: 'ar' + i, 'data-text': a.text, 'data-rere': a.rere ? 1 : 0 },
      a.lines.map((t, r) => txt(cx, y0 + L.arY + r * L.arDy, t, { anchor: 'middle', fill: 'var(--mut)', weight: 400 })).join('')); });
  // reflected power |b_k|² at each junction: orange arrows pointing back toward the source, value underneath
  // (at the source on two lines, "back to source" above the value, so it stays clear of junction 1's)
  const yb = yr + RM / 2 + 24, rt = p => (p < S_ZERO * S_ZERO ? '0' : sig2(p) + ' × input');
  sol.refl.forEach((p, k) => { const t = p > 1e-6 ? p * sc * rx : 0, x = G.jx[k], aw = k === 0 ? 30 : 36;
    s += bandArrow(x + aw, x - aw, yb, t, { col: 'var(--s11)', q: 'refl' + k, v: p, ref: sc * rx });
    const yt = yb + Math.max(22, t * 1.7) / 2 + 14, lines = k === 0 ? ['back to source', rt(p)] : [rt(p)];
    const xt = Math.max(x, Math.max(...lines.map(l => textW(l))) / 2 + L.edge);   // centred on the junction, 16 from the edge
    s += el('g', { class: 'reflv', id: 'refl' + k, 'data-text': lines.join(' ') }, lines.map((l, r) => txt(xt, yt + r * 24, l, { anchor: 'middle', fill: 'var(--s11)' })).join('')); });
  return s;
}
/* "Budget": under each block its |S21| in dB and its power factor |S21|² (green gain, red loss); on the heading's line,
   the dB adding up: "+10.0 − 3.0 − 0.9 = +6.1 dB delivered to load" (G_T), or both totals when the block sum and G_T
   differ by more than 0.05 dB (mismatch between the blocks or at the load). */
function drawBudget(G, sol, H){
  const L = LY_K, y0 = H - L.s3up;
  let s = heading(L.edge, y0 + L.headY, 'Budget');
  sol.devs.forEach((S, i) => { const db = blockDb(S), col = db > 0.05 ? 'var(--s21)' : db < -0.05 ? 'var(--s22)' : 'var(--txt)', cx = G.bx[i] + L.bw / 2;
    s += el('g', { class: 'budget', id: 'bud' + i }, txt(cx, y0 + L.bud1, db1(db) + ' dB', { anchor: 'middle', fill: col })
      + txt(cx, y0 + L.bud2, '= ×' + (blockGain(S) < S_ZERO * S_ZERO ? '0' : sig2(blockGain(S))), { anchor: 'middle', fill: col })); });
  const gt = sol.GT > 1e-12 ? 10 * Math.log10(sol.GT) : -Infinity, dbs = sol.devs.map(blockDb), sum = dbs.reduce((a, b) => a + b, 0);
  const same = (sum === -Infinity && gt === -Infinity) || Math.abs(sum - gt) <= 0.05;
  const terms = dbs.map((d, i) => (i === 0 ? db1(d) : (d < -0.05 || d === -Infinity ? ' − ' : ' + ') + db1(Math.abs(d)).replace('+', ''))).join('');
  s += txt(DESIGN_W - L.edge, y0 + L.headY, same ? terms + ' = ' + db1(gt) + ' dB delivered to load' : 'blocks: ' + db1(sum) + ' dB · delivered to load: ' + db1(gt) + ' dB',
    { anchor: 'end', id: 'budTotal', cls: 'budget' });
  return s;
}
// The whole Cascade drawing.
function drawCascade(H){
  const G = chainGeo(), sol = solveChain();
  return svgRoot(H, 'Cascade: chain, power flow and budget', drawChain(G) + drawFlow(G, sol, H) + drawBudget(G, sol, H));
}
// ── END DRAWING ───────────────────────────────────────────────

// ── INTERACTION ───────────────────────────────────────────────
// Select block i (its editor opens in the panel).
function selectBlock(i){ K.sel = i; K.menu = false; redraw(true); }
// Remove block i (at least one block stays).
function removeBlock(i){ if(K.blocks.length <= 1) return; K.blocks.splice(i, 1); K.sel = Math.min(K.sel, K.blocks.length - 1); K.menu = false; redraw(true); }
// Add a block of the given type at the end and select it.
function addBlock(type){ if(K.blocks.length >= MAX_BLOCKS) return; K.blocks.push({ type, p: BLOCK_DEFAULT[type]() }); K.sel = K.blocks.length - 1; K.menu = false; redraw(true); }
// A click or Enter/Space on the drawing: select, remove or "+". Returns true when handled.
function cascadeActivate(t){
  const g = t.closest && t.closest('[data-blk],[data-del],[data-add]'); if(!g) return false;
  if(g.dataset.del !== undefined) removeBlock(+g.dataset.del);
  else if(g.dataset.blk !== undefined) selectBlock(+g.dataset.blk);
  else if(K.blocks.length < MAX_BLOCKS){ K.menu = !K.menu; redraw(true); }
  return true;
}
// The "+" menu: an HTML list of block types over the drawing, at the "+" position (placed in px by the drawing scale).
function addMenu(){
  if(!K.menu || K.blocks.length >= MAX_BLOCKS) return null;
  const G = chainGeo(), b = drawBox();
  return h('div', { cls: 'addmenu', attrs: { role: 'menu', 'aria-label': 'Add a block', style: 'left:' + n2(b.off + b.s * Math.min(G.plusX - 60, DESIGN_W - 170)) + 'px;top:' + n2(b.s * (G.plusY + 20)) + 'px' } },
    BLOCK_TYPES.map(t => h('button', { type: 'button', id: 'add_' + t, text: DEV_NAME[t], attrs: { role: 'menuitem' }, onclick: () => addBlock(t) })));
}
// ── END INTERACTION ───────────────────────────────────────────

// ── PANEL ─────────────────────────────────────────────────────
// A block's current S as a Custom entry set (devices.js sEntries).
const entriesOf = b => sEntries(deviceS(b.type, b.p));
/* The selected block's editor, shown as soon as the block is selected: a preset's one knob (when it has one) and all
   four S entries with the reciprocal link, filled with the block's values and following the knob live (syncCascade).
   Editing an S entry turns a preset into Custom with those values (its knob goes). K.est is the entry set shown. */
function blockEditor(){
  const i = K.sel, b = K.blocks[i], set = (k, v) => { b.p[k] = v; redraw(false); };
  const title = h('div', { cls: 'sec', text: 'Block ' + (i + 1) + ' · ' + DEV_NAME[b.type] });
  if(b.type === 'custom'){ K.est = b.p; return [title, ...sEditor(b.p, 'k', redraw)]; }
  const knob = { through: () => slider({ id: 'kLen', label: 'Line length ℓ/λ', min: 0, max: 1, step: 0.01, value: b.p.l, unit: 'λ', onset: v => set('l', v) }),
    atten: () => slider({ id: 'kAtt', label: 'Attenuation', min: 0, max: 40, step: 0.5, value: b.p.A, unit: 'dB', onset: v => set('A', v) }),
    amp: () => slider({ id: 'kGain', label: 'Gain', min: 0, max: 30, step: 0.5, value: b.p.G, unit: 'dB', onset: v => set('G', v) }),
    iso: () => slider({ id: 'kIL', label: 'Forward loss', min: 0, max: 3, step: 0.1, value: b.p.IL, unit: 'dB', onset: v => set('IL', v) }) }[b.type]();
  const st = K.est = entriesOf(b);
  const changed = full => { if(b.type !== 'custom'){ b.type = 'custom'; b.p = st; redraw(true); } else redraw(full); };
  return [title, knob, ...sEditor(st, 'k', changed)];
}
// "Whole chain as one two-port": overall S21 (|S|∠ and dB), S11 (with the match note), S22, S12.
function chainLines(){
  const S = solveChain().St, m11 = cabs(S.s11), db = dbOf(cabs(S.s21));
  return [['s21', sText(S.s21) + ' (' + (db === -Infinity ? '−∞ dB' : dbText(db)) + ')'], ['s11', sText(S.s11) + (m11 < MATCH_EPS ? ' (source sees a match)' : '')],
          ['s22', sText(S.s22)], ['s12', sText(S.s12)]];
}
// Side panel of the Cascade view.
function panelCascade(){
  const lk = K.load.kind, set = kind => { K.load.kind = kind; redraw(true); };
  const box = h('input', { type: 'number', id: 'loadZ', min: 0, max: 1e6, step: 'any', value: lk === 'value' ? K.load.z : lk === 'match' ? Z0_CASC : lk === 'short' ? 0 : '', attrs: { 'aria-label': 'Load resistance (Ω)' } });
  box.addEventListener('input', () => { const v = +box.value, okv = box.value !== '' && isFinite(v) && v >= 0 && v <= 1e6;
    box.classList.toggle('invalid', !okv); box.setAttribute('aria-invalid', String(!okv)); if(okv){ K.load = { kind: 'value', z: v }; redraw(false); } });
  return [...blockEditor(),
    h('div', { cls: 'sec', text: 'Whole chain as one two-port' }),
    h('div', { cls: 'slines', id: 'chainS' }, chainLines().map(([k, v]) => h('div', { cls: 'sline' }, h('span', { cls: 'sname ' + k, text: S_NAME[k] }), h('span', { cls: 'sv', text: v })))),
    h('div', { cls: 'sec', text: 'Load' }),
    h('div', { cls: 'btnrow' }, pbtn('lMatch', 'Matched', lk === 'match', () => set('match')), pbtn('lShort', 'Short', lk === 'short', () => set('short')),
      pbtn('lOpen', 'Open', lk === 'open', () => set('open'))),
    h('div', { cls: 'ctl' }, h('div', { cls: 'row' }, h('label', { htmlFor: 'loadZ', text: 'Value' }), box, h('span', { cls: 'unit', text: 'Ω' })))];
}
// Refresh the chain readouts after a control moved.
function syncCascade(){
  const blk = K.blocks[K.sel];
  if(blk && blk.type !== 'custom' && K.est){ Object.assign(K.est, entriesOf(blk));   // a preset's S entries follow its knob
    const put = (id, v) => { const e = document.getElementById(id); if(e && e !== document.activeElement) e.value = +(+v).toPrecision(6); };
    for(const k of S_KEYS){ put('k' + k, K.est.e[k][0]); put('k' + k + 'm', K.est.e[k][0]); put('k' + k + 'a', K.est.e[k][1]); }
    const rc = document.getElementById('krecip'); if(rc) rc.checked = K.est.recip; }
  const lines = document.querySelectorAll('#chainS .sv'); chainLines().forEach(([, v], i) => { if(lines[i]) lines[i].textContent = v; });
  const lk = K.load.kind; [['lMatch', 'match'], ['lShort', 'short'], ['lOpen', 'open']].forEach(([id, k]) => { const b = document.getElementById(id); if(b) b.setAttribute('aria-pressed', String(lk === k)); });
}
// ── END PANEL ─────────────────────────────────────────────────

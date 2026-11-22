/* ═══ LECTURE KIT — shared by the Laplace lecture pages (L9, L10) ═════════════
   TOC
     1  CONSTANTS + COLOUR ROLES
     2  BEAT HELPERS            beatStart, beatAt (a page defines BEATS)
     3  SCHEMATIC PRIMITIVES    wires, R / C / L, sources, labels that morph and highlight
     4  MATH PIECES             2×2 matrix, determinant, slots, the landing path
     5  PANELS                  rail, work panel, plot, caption, band, Your-turn card
     6  SCENE                   LectureScene (a page supplies PAGE = { lang, steps, parts })
   A page file defines, after this kit: LANG, STEPS, BEATS, IX, LAST, focusOf, doneRows and PAGE. */

/* ═══ 1 CONSTANTS + COLOUR ROLES ══════════════════════════════════════════ */
const LINE_HOLD = 1.5;       // s: pause after each clip before the next line replaces it (focus rule R6)
const CIRC_H = 200;          // px: height of the circuit panel
const BOARD_H = 236;         // px: height of the results panel
const SCH_W = 596, SCH_H = 172;   // px: schematic drawing area
const COL_SLIDE = 0.5;       // s: time a replaced determinant column takes to slide in
const C_Z = TEAL;            // the circuit and its s-domain values
const C_IC = AMBER;          // initial conditions, coefficients, values that land
const C_ALG = PURPLE;        // algebra (Cramer's rule)
const C_IT = GREEN;          // time-domain answers
const C_HL = ACCENT;         // the element being spoken about
const MINUS = '−';

/* ═══ 2 BEAT HELPERS ══════════════════════════════════════════════════════ */
// start time (s) of beat i on the measured timeline: a fraction of the clip that narrates it
const beatStart = (TL, i) => TL.L[BEATS[i].line - 1] + BEATS[i].from * TL.durs[BEATS[i].line - 1];
// beat on screen at `time` (-1 before the first beat)
function beatAt(TL, time) {
  let k = -1;
  for (let i = 0; i < BEATS.length; i++) if (time >= beatStart(TL, i)) k = i;
  return k;
}

/* ═══ 3 SCHEMATIC PRIMITIVES ══════════════════════════════════════════════ */
// text attributes for schematic labels
const svgText = (size, fill, weight) => ({ fontFamily: MONO, fontSize: size || FS_MIN, fill: fill || C_Z, fontWeight: weight || 600 });
// stroke attributes of an element: thicker and in the highlight colour while the voice names it
const strokeOf = (hl, color) => ({ stroke: hl ? C_HL : (color || C_Z), strokeWidth: hl ? 3.2 : 1.8 });
// a straight wire
const Wire = ({ x1, y1, x2, y2 }) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C_Z} strokeWidth="1.6" />;
// halo behind a highlighted element
const Halo = ({ x, y, w, h }) => <rect x={x} y={y} width={w} height={h} rx="8" fill={C_HL} opacity="0.13" />;

// an impedance box (resistor, or any element once transformed); `vert` draws it on a vertical wire
function ZBox({ cx, cy, vert, hl }) {
  const w = vert ? 18 : 46, h = vert ? 46 : 18;
  return <g>{hl ? <Halo x={cx - w / 2 - 7} y={cy - h / 2 - 7} w={w + 14} h={h + 14} /> : null}<rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={CARD} {...strokeOf(hl)} /></g>;
}
// a capacitor: two plates across the wire
function Cap({ cx, cy, vert, hl }) {
  const s = strokeOf(hl), g = 4, p = 13;
  return (
    <g>
      {hl ? <Halo x={cx - 20} y={cy - 20} w={40} h={40} /> : null}
      <rect x={vert ? cx - p : cx - g} y={vert ? cy - g : cy - p} width={vert ? 2 * p : 2 * g} height={vert ? 2 * g : 2 * p} fill={CARD} />
      {vert ? <g><line x1={cx - p} y1={cy - g} x2={cx + p} y2={cy - g} {...s} /><line x1={cx - p} y1={cy + g} x2={cx + p} y2={cy + g} {...s} /></g>
        : <g><line x1={cx - g} y1={cy - p} x2={cx - g} y2={cy + p} {...s} /><line x1={cx + g} y1={cy - p} x2={cx + g} y2={cy + p} {...s} /></g>}
    </g>
  );
}
// an inductor: four humps along the wire
function Ind({ cx, cy, vert, hl }) {
  const s = strokeOf(hl), r = 5.5, n = 4, len = 2 * r * n;
  const d = vert ? 'M' + cx + ' ' + (cy - len / 2) + ' ' + Array.from({ length: n }, () => 'a' + r + ' ' + r + ' 0 0 1 0 ' + 2 * r).join(' ')
    : 'M' + (cx - len / 2) + ' ' + cy + ' ' + Array.from({ length: n }, () => 'a' + r + ' ' + r + ' 0 0 1 ' + 2 * r + ' 0').join(' ');
  return (
    <g>
      {hl ? <Halo x={vert ? cx - 12 : cx - len / 2 - 6} y={vert ? cy - len / 2 - 6 : cy - 14} w={vert ? 26 : len + 12} h={vert ? len + 12 : 24} /> : null}
      <rect x={vert ? cx - 3 : cx - len / 2} y={vert ? cy - len / 2 : cy - 3} width={vert ? 6 : len} height={vert ? len : 6} fill={CARD} />
      <path d={d} fill="none" {...s} />
    </g>
  );
}
// a voltage source on a vertical wire; `plusTop` puts + at the top terminal
function VSrc({ cx, cy, plusTop, hl, color }) {
  const s = strokeOf(hl, color), c = hl ? C_HL : (color || C_Z);
  return (
    <g data-vsrc={plusTop ? 'plus-top' : 'minus-top'}>
      {hl ? <Halo x={cx - 20} y={cy - 20} w={40} h={40} /> : null}
      <circle cx={cx} cy={cy} r="13" fill={CARD} {...s} />
      <text x={cx} y={cy - 2} textAnchor="middle" {...svgText(FS_MIN, c)}>{plusTop ? '+' : MINUS}</text>
      <text x={cx} y={cy + 11} textAnchor="middle" {...svgText(FS_MIN, c)}>{plusTop ? MINUS : '+'}</text>
    </g>
  );
}
// a current source on a vertical wire; the arrow points up or down
function ISrc({ cx, cy, up, hl, color }) {
  const s = strokeOf(hl, color), c = hl ? C_HL : (color || C_Z), d = up ? -1 : 1;
  return (
    <g data-isrc={up ? 'up' : 'down'}>
      {hl ? <Halo x={cx - 20} y={cy - 20} w={40} h={40} /> : null}
      <circle cx={cx} cy={cy} r="13" fill={CARD} {...s} />
      <path d={`M${cx} ${cy - 8 * d} L${cx} ${cy + 8 * d} M${cx - 4.5} ${cy + 3 * d} L${cx} ${cy + 8 * d} L${cx + 4.5} ${cy + 3 * d}`} fill="none" stroke={c} strokeWidth="1.8" />
    </g>
  );
}
// the ground symbol hanging from (x, y)
const Gnd = ({ x, y }) => (
  <g stroke={C_Z} strokeWidth="1.6"><line x1={x} y1={y} x2={x} y2={y + 6} /><line x1={x - 10} y1={y + 6} x2={x + 10} y2={y + 6} /><line x1={x - 6} y1={y + 10} x2={x + 6} y2={y + 10} /><line x1={x - 2.5} y1={y + 14} x2={x + 2.5} y2={y + 14} /></g>
);
// ELabel: an element's label. It shows the time-domain text until its s-domain value has been spoken, then the
// s-domain text; while that value lands it carries an amber ring (R5, R7). `slot` names the landing target.
function ELabel({ x, y, anchor, was, now, got, landing, slot, hl, color }) {
  const t = got ? now : was, w = t.length * 8 + 10, x0 = anchor === 'end' ? x - w + 5 : anchor === 'middle' ? x - w / 2 : x - 5;
  return (
    <g>
      {landing ? <rect x={x0} y={y - 14} width={w} height="19" rx="4" fill="none" stroke={AMBER} strokeWidth="2" /> : null}
      <text data-slot={slot} data-tape={slot} x={x} y={y} textAnchor={anchor} {...svgText(FS_MIN, hl ? C_HL : (color || C_Z))}>{t}</text>
    </g>
  );
}
// a clockwise mesh-current marker centred at (cx, cy)
function MeshArrow({ cx, cy, label, hl }) {
  const c = hl ? C_HL : INK, r = 22;
  return (
    <g>
      <path d={`M${cx - r} ${cy + 6} A${r} ${r} 0 1 1 ${cx + r - 3} ${cy + 9}`} fill="none" stroke={c} strokeWidth={hl ? 2.4 : 1.4} />
      <path d={`M${cx + r + 3} ${cy + 2} L${cx + r - 3} ${cy + 10} L${cx + r - 11} ${cy + 4}`} fill="none" stroke={c} strokeWidth={hl ? 2.4 : 1.4} />
      <text x={cx} y={cy + 5} textAnchor="middle" {...svgText(FS_MIN, c)}>{label}</text>
    </g>
  );
}

/* ═══ 4 MATH PIECES ═══════════════════════════════════════════════════════ */
// one bracketed column block of a matrix; `cols` is an array of columns, each an array of cell nodes
function Block({ cols, bar, size, gap }) {
  const side = bar ? { borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}` } : { borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`, borderRadius: 7 };
  return (
    <span style={Object.assign({ display: 'inline-flex', gap: gap || 16, padding: '2px 8px', verticalAlign: 'middle' }, side)}>
      {cols.map((col, j) => (
        <span key={j} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: size, lineHeight: 1.3 }}>{col.map((c, i) => <span key={i} style={{ whiteSpace: 'nowrap', minHeight: '1.3em' }}>{c}</span>)}</span>
      ))}
    </span>
  );
}
// Mat2: [A]·[x] = [b] for a 2×2 system; rows after `shown` are left blank (the matrix is built row by row, R3)
function Mat2({ a, x, b, shown, size }) {
  const cell = (r, t) => (r < shown ? t : ' ');
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: size }}>
      <Block size={size} cols={[[cell(0, a[0][0]), cell(1, a[1][0])], [cell(0, a[0][1]), cell(1, a[1][1])]]} />
      <Block size={size} cols={[x.map((v, i) => <span key={i} style={{ color: C_IC, fontWeight: 600 }}>{v}</span>)]} />
      <span>=</span>
      <Block size={size} cols={[[cell(0, b[0]), cell(1, b[1])]]} />
    </span>
  );
}
// Det2: a 2×2 determinant in which column `swap` (0 or 1) has been replaced by the right-hand side b.
// `prog` (0–1) slides the new column into place; with reduced motion it is simply shown in place.
function Det2({ a, b, swap, prog, size, name }) {
  const dx = (1 - easeOutCubic(clamp(prog == null ? 1 : prog, 0, 1))) * 46;
  const col = (j) => (j === swap
    ? b.map((v, i) => <span key={i} data-swapcol={j} style={{ color: C_IC, fontWeight: 600, transform: 'translateX(' + dx.toFixed(1) + 'px)', display: 'inline-block' }}>{v}</span>)
    : [a[0][j], a[1][j]]);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: size }}>
      <span>{name + ' ='}</span><Block bar size={size} cols={[col(0), col(1)]} />
    </span>
  );
}
// BSlot: a value box on the results panel. It reads "?" until its value has been spoken, then takes a 2 px amber
// border (R4, R5); with reduced motion the box is outlined while its value arrives (R7).
function BSlot({ k, got, landing, reduced, children, size, pad }) {
  return (
    <span data-slot={k} style={{ display: 'inline-flex', alignItems: 'center', border: `2px solid ${got ? C_IC : LINE}`, borderRadius: 6, padding: pad || '1px 7px',
      outline: landing && got && reduced ? `3px solid ${C_IC}` : 'none', outlineOffset: 2 }}>
      <span data-tape={k} style={{ fontFamily: MONO, fontSize: size || FS_MIN, fontWeight: 600, color: got ? INK : MUTE, whiteSpace: 'nowrap' }}>{got ? children : '?'}</span>
    </span>
  );
}
// LVal: a value forming in the focus line at 30 px amber, the start of its landing path (R5)
const LVal = ({ k, children }) => <span data-landing-from={k} style={{ display: 'inline-flex', fontFamily: MONO, fontSize: VALUE_FS, fontWeight: 600, color: AMBER, marginLeft: 12, verticalAlign: 'middle' }}>{children}</span>;
// a stacked fraction for the focus line or the board
const LFrac = ({ num, den, size, color }) => <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><Frac num={num} den={den} size={size} color={color || INK} /></span>;
// a board row: a muted label and its content
const BRow = ({ label, children, w }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: w || 58, flexShrink: 0 }}>{label}</span>
    <span style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>{children}</span>
  </div>
);

// LLanding: the dashed path a value takes from the focus line to its slot (R5): up from the value, across, then
// into the slot's lower edge, so the path never runs through the value itself. `progress` 0–1 moves the dot.
function LLanding({ fromSel, toSel, progress }) {
  const [pts, setPts] = useState(null);
  useEffect(() => {
    const stage = document.getElementById('stage'), a = document.querySelector(fromSel), b = document.querySelector(toSel);
    if (!stage || !a || !b) { setPts(null); return; }
    const s = stage.getBoundingClientRect(), k = STAGE_W / s.width, ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const p = [(ra.left + ra.width / 2 - s.left) * k, (ra.top - s.top) * k - 3, (rb.left + rb.width / 2 - s.left) * k, (rb.bottom - s.top) * k + 4];
    setPts((o) => (o && o.every((v, i) => Math.abs(v - p[i]) < 0.5) ? o : p));
  });
  if (!pts) return null;
  const [x0, y0, x1, y1] = pts, ym = Math.min(y0 - 10, Math.max(y1 + 12, y0 - 26)), f = progress == null ? 1 : clamp(progress, 0, 1);
  const route = [[x0, y0], [x0, ym], [x1, ym], [x1, y1]], seg = route.slice(1).map((q, i) => Math.abs(q[0] - route[i][0]) + Math.abs(q[1] - route[i][1]));
  let d = f * seg.reduce((a, c) => a + c, 0), dot = route[3];
  for (let i = 0; i < 3; i++) { if (d <= seg[i]) { const g = seg[i] ? d / seg[i] : 0; dot = [route[i][0] + g * (route[i + 1][0] - route[i][0]), route[i][1] + g * (route[i + 1][1] - route[i][1])]; break; } d -= seg[i]; }
  return (
    <svg data-landing="1" width={STAGE_W} height={STAGE_H} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none' }}>
      <path d={'M' + route.map((q) => q[0] + ' ' + q[1]).join(' L')} fill="none" stroke={AMBER} strokeWidth="2" strokeDasharray="6 5" />
      <circle cx={dot[0]} cy={dot[1]} r="5" fill={AMBER} />
    </svg>
  );
}

/* ═══ 5 PANELS ════════════════════════════════════════════════════════════ */
// LRail: the steps of the method; the active one in its colour, finished ones ticked
function LRail({ head, steps, active }) {
  return (
    <div data-gate="rail" style={panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, display: 'flex', flexDirection: 'column', gap: 9 })}>
      {zoneHead(head)}
      {steps.map((s, i) => {
        const isAct = i === active, done = i < active, col = isAct ? s.tint : done ? INK : UPCOMING;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 }}>{done ? '✓' : String(i + 1)}</span>
            <span style={{ fontFamily: HEAD, fontSize: 13.5, lineHeight: '18px', color: col, fontWeight: isAct ? 600 : 400, textWrap: 'pretty' }}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// LWork: finished lines as compact rows, and the one focus line with its 5 px colour bar (R1, R2)
function LWork({ head, rows, focusId, bar, children, opacity }) {
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP + CIRC_H + 8, width: WORK_W, height: PANEL_H - CIRC_H - 8, display: 'flex', flexDirection: 'column', gap: 5, opacity })}>
      {zoneHead(head, INK)}
      <div data-done="1" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((r) => <div key={r.key} data-done-row={r.key} style={Object.assign(kMono(SMALL_FS, r.color || MUTE), { whiteSpace: 'nowrap', lineHeight: '21px' })}>{r.node}</div>)}
      </div>
      <div data-focus={focusId} style={{ marginTop: 2, borderLeft: `5px solid ${bar}`, paddingLeft: 14, minHeight: 44, display: 'flex', alignItems: 'center',
        fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.35 }}>
        <span>{children}</span>
      </div>
    </div>
  );
}

// LPlot: one or more curves against t (s) with numbered axes. Each curve: { f, t0, t1, dash, label }; labelled
// curves get a legend entry at the top right. `marks` are dots: { t, y, color, label }.
function LPlot({ curves, tmin, tmax, ymin, ymax, width, height, unitY, marks, tstep }) {
  const padL = 40, padR = 52, padT = 8, padB = 20, N = 260;
  const PX = (t) => padL + ((t - tmin) / (tmax - tmin)) * (width - padL - padR), PY = (y) => padT + (1 - (y - ymin) / (ymax - ymin)) * (height - padT - padB);
  const ystep = niceStep(ymax - ymin, 3), yt = [], tt = [];
  for (let v = Math.ceil(ymin / ystep - 1e-9) * ystep; v <= ymax + ystep * 1e-6; v += ystep) yt.push(Math.abs(v) < 1e-9 ? 0 : v);
  for (let v = Math.ceil(tmin / tstep - 1e-9) * tstep; v <= tmax + tstep * 1e-6; v += tstep) tt.push(Math.abs(v) < 1e-9 ? 0 : v);
  const path = (c) => { let d = ''; for (let k = 0; k <= N; k++) { const t = c.t0 + (k / N) * (c.t1 - c.t0); d += (k ? 'L' : 'M') + PX(t).toFixed(1) + ' ' + PY(c.f(t)).toFixed(1) + ' '; } return d; };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" data-plot="1" aria-label={'Plot against time in seconds; vertical axis in ' + unitY} style={{ display: 'block', flexShrink: 0 }}>
      {yt.map((v) => (
        <g key={v}><line x1={padL} y1={PY(v)} x2={width - padR} y2={PY(v)} stroke={v === 0 ? MUTE : LINE} strokeWidth={v === 0 ? 1 : 0.8} />
          <text x={padL - 6} y={PY(v) + 4.5} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>{tickLabel(v, ystep)}</text></g>
      ))}
      <line x1={PX(0)} y1={padT} x2={PX(0)} y2={height - padB} stroke={MUTE} strokeWidth="1" />
      {tt.map((v) => (
        <g key={v}><line x1={PX(v)} y1={height - padB} x2={PX(v)} y2={height - padB + 4} stroke={MUTE} strokeWidth="1" />
          <text x={PX(v)} y={height - 3} textAnchor="middle" {...svgText(FS_MIN, MUTE, 400)}>{tickLabel(v, tstep)}</text></g>
      ))}
      <text x={width - 2} y={height - 3} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>t, s</text>
      <text x={width - 2} y={padT + 10} textAnchor="end" {...svgText(FS_MIN, MUTE, 400)}>{unitY}</text>
      {curves.map((c, i) => (
        <g key={i}>
          <path data-curve={c.label || String(i)} d={path(c)} fill="none" stroke={C_IT} strokeWidth="2.4" strokeDasharray={c.dash ? '7 4' : undefined} strokeLinejoin="round" />
          {c.label ? <g><line x1={width - padR - 62} y1={padT + 9 + 17 * i} x2={width - padR - 34} y2={padT + 9 + 17 * i} stroke={C_IT} strokeWidth="2.4" strokeDasharray={c.dash ? '7 4' : undefined} />
            <text x={width - padR - 28} y={padT + 13.5 + 17 * i} {...svgText(FS_MIN, C_IT)}>{c.label}</text></g> : null}
        </g>
      ))}
      {(marks || []).map((m, i) => (
        <g key={i} data-mark={m.id}><circle cx={PX(m.t)} cy={PY(m.y)} r="5" fill={m.hollow ? CARD : (m.color || C_IC)} stroke={m.color || C_IC} strokeWidth="2" />
          {m.label ? <text x={PX(m.t) + (m.left ? -9 : 9)} y={PY(m.y) + (m.left ? -8 : 4.5)} textAnchor={m.left ? 'end' : 'start'} {...svgText(FS_MIN, m.color || C_IC)}>{m.label}</text> : null}</g>
      ))}
    </svg>
  );
}

// LCaption: the on-screen line for the current beat, as plain text
function LCaption({ sched, text }) {
  const time = useTime(); const TL = useTL();
  const i = idxAt(sched, time);
  if (i < 0 || time >= TL.FINISH || !text) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div data-gate="caption" style={{ maxWidth: 1040, margin: '0 20px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW,
        padding: '8px 18px', fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' }}>{text}</div>
    </div>
  );
}

// LBand: one-line-back / forward, the note for the current line, and (once the tour has reached the end) the series links
function LBand({ ui, bi, goBeat, yt, note, links, showLinks }) {
  return (
    <div data-gate="band" style={panel({ left: RAIL_X, top: BAND_TOP, width: STAGE_W - 2 * RAIL_X, height: BAND_H, display: 'flex', gap: 16, padding: '10px 14px', alignItems: 'stretch' })}>
      <div style={{ width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {zoneHead(ui.bandHead)}
        <div style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE, lineHeight: 1.4 }}>{ui.bandHelp}</div>
      </div>
      <div style={{ width: 1, background: LINE }} />
      <KNav cur={clamp(bi, 0, LAST)} total={LAST + 1} goBeat={goBeat} yt={yt} note={note} width={420} />
      <div style={{ width: 1, background: LINE }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {showLinks ? (
          <React.Fragment>
            {zoneHead(ui.linksHead, ACCENT)}
            {links.map((l) => (
              <div key={l.href} data-link="1" style={{ fontFamily: HEAD, fontSize: 14, color: INK, lineHeight: '21px', whiteSpace: 'nowrap' }}>
                <span style={{ color: MUTE }}>{l.dir + ' '}</span><a href={l.href} style={{ color: ACCENT, fontWeight: 600 }}>{l.label}</a>
              </div>
            ))}
          </React.Fragment>
        ) : null}
      </div>
    </div>
  );
}

// LYourTurn (rule 63): the problem over the circuit and work panels; Show solution reveals the key. No answer boxes.
function LYourTurn({ yt, shown, onToggle, onClose }) {
  const lab = { fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 70, flexShrink: 0 };
  return (
    <div data-gate="work" data-card="yourturn" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5, border: `2px solid ${ACCENT}`, padding: '8px 11px', display: 'flex', flexDirection: 'column', gap: 6 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT }}>YOUR TURN</div>
        <button type="button" onClick={onClose} style={btnStyle(false)}>{'← back to the worked example'}</button>
      </div>
      {yt.circuit}
      <div data-yt-problem="1" style={{ fontFamily: HEAD, fontSize: 14.5, color: INK, lineHeight: 1.35 }}>{yt.problem}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: HEAD, fontSize: 15.5, color: INK }}><b>{yt.ask}</b>{' Work it on paper.'}</div>
        <button type="button" onClick={onToggle} aria-expanded={shown} style={Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '6px 16px', marginLeft: 'auto' })}>{shown ? 'Hide solution' : 'Show solution'}</button>
      </div>
      {shown ? (
        <div data-solution="1" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {yt.steps.map((s) => (
            <div key={s[0]} data-yt-step={s[0]} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={lab}>{s[0]}</span><span style={{ fontFamily: MONO, fontSize: FS_MIN, color: INK, lineHeight: 1.35 }}>{s[1]}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={lab}>answer</span><span data-yt-answer="1" style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: C_IT }}>{yt.answer}</span>
            <span style={{ fontFamily: HEAD, fontSize: FS_MIN, color: MUTE, marginLeft: 'auto' }}>plotted on the right</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ═══ 6 SCENE ═════════════════════════════════════════════════════════════ */
// Scene: builds the schedule from the measured clip durations and mounts the stage
function Scene() {
  const { urls, durs } = useClips(LANG.clips);
  const sched = useMemo(() => buildSchedule(LANG, durs), [durs]);
  const TL = useMemo(() => makeTL(sched), [sched]);
  const narration = useMemo(() => LANG.clips.map((clip, i) => ({ clip, at: sched.starts[i], dur: sched.durs[i] })), [sched]);
  return (
    <Stage duration={sched.total}>
      <TLCtx.Provider value={TL}>
        <LectureBody lang={LANG} ui={LANG.ui} sched={sched} narration={narration} urls={urls} />
      </TLCtx.Provider>
    </Stage>
  );
}

// LectureBody: which beat is on screen (from the playhead, or from ◀ ▶) and the panels for it
function LectureBody({ lang, ui, sched, narration, urls }) {
  const { time, playing, setPlaying } = useTimeline();
  const TL = useTL();
  const yt = useYourTurn();
  const reduced = useReducedMotion();
  const [hand, setHand] = useState(-1);          // beat chosen by hand; -1 while the tour drives
  useEffect(() => { if (playing) setHand(-1); }, [playing]);
  const shown = hand >= 0 ? hand : beatAt(TL, Math.min(time, TL.REVERT));
  const b = BEATS[Math.max(0, shown)];
  const goBeat = (i) => { yt.close(); if (playing) setPlaying(false); setHand(i); };
  const since = hand >= 0 ? null : time - beatStart(TL, Math.max(0, shown));   // s into the current beat (null when stepping by hand)
  const landing = shown >= 0 && b.land && !yt.open ? b.land : '';
  const st = { bi: shown, b, land: landing, reduced, since, ytShown: yt.shown };
  const note = hand >= 0 ? ui.noteStep : ui.notes[clamp(b.line - 1, 0, ui.notes.length - 1)];
  return (
    <React.Fragment>
      <TitleCard ui={ui} />
      <Header head={ui.header} sub={ui.headerSub} keyPoint={ui.keyPoint} />
      {shown >= 0 ? <LRail head={ui.railHead} steps={STEPS} active={b.step} /> : null}
      {shown >= 0 && !yt.open ? (
        <div data-gate="circuit" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: CIRC_H, display: 'flex', flexDirection: 'column', gap: 2 })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{zoneHead(ui.circHead, ACCENT)}{smallLabel(PAGE.circuitTag(shown), C_Z)}</div>
          <PAGE.Circuit {...st} />
        </div>
      ) : null}
      {shown >= 0 && !yt.open ? (
        <LWork head={ui.workHead} rows={doneRows(shown)} focusId={b.id} bar={STEPS[Math.max(0, b.step)].tint}
          opacity={shown >= 1 || hand >= 0 ? 1 : clamp((time - beatStart(TL, 0)) / 0.6, 0, 1)}>{focusOf(b, st)}</LWork>
      ) : null}
      {yt.open ? <LYourTurn yt={PAGE.yourTurn} shown={yt.shown} onToggle={yt.toggle} onClose={yt.close} /> : null}
      <PAGE.Board {...st} />
      <PAGE.PlotPanel {...st} />
      {landing && !reduced ? <LLanding fromSel={'[data-landing-from="' + landing + '"]'} toSel={'[data-slot="' + landing + '"]'} progress={since == null ? null : since / LAND_MOVE} /> : null}
      <LBand ui={ui} bi={shown} goBeat={goBeat} yt={yt} note={note} links={PAGE.links} showLinks={yt.reached} />
      <LCaption sched={sched} text={shown >= 0 ? b.cap : ''} />
      <FinishStrip ui={ui} />
      <ProgressBar />
      <Stamp />
      <Narrator lines={narration} urls={urls} />
      <SoundToggle />
      <ReplayPill />
      <OpeningCard card={lang.card} />
      <SrSummary text={ui.srSummary + (shown >= 0 ? b.cap + '. ' : '') + (yt.open ? PAGE.yourTurn.sr + (yt.shown ? ' Solution: ' + PAGE.yourTurn.srAnswer : '') : '')} />
      {/*#GATE*/}
    </React.Fragment>
  );
}

/* ═══ KIT — shared engine for the Inverse Laplace PFE pages ═══════════════════
   TOC
     1  CONSTANTS            layout, timing, version
     2  PALETTE              text colours (>= 4.5:1 on white), fonts
     3  TIMELINE + STAGE     playhead, fit-to-window scaling, keyboard
     4  CLIPS + NARRATOR     embedded MP3 -> blob URLs, schedule, playback
     5  SMALL PARTS          Reveal, SrSummary, Eq, Frac, Bracket, panel helpers
     6  PLOT AXES            ticks and labels for the f(t) panel
     7  CHROME               OpeningCard, ReplayPill, SoundToggle, Header,
                             Captions, ProgressBar, FinishStrip, TitleCard, Stamp
     8  YOUR TURN            problem card with Show solution
   Units: stage coordinates are px on a 1280 x 720 stage (scaled to the window);
   all times are seconds on the narration timeline. */

const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;

/* ═══ 1 CONSTANTS ═════════════════════════════════════════════════════════ */
const VERSION = 'v1.1.0';
const STAGE_W = 1280, STAGE_H = 720;        // stage size, px
const MIN_SCALE = 0.05;                     // lower bound for the fit scale
const LEAD = 1.00, GAP = 1.20, TAIL = 3.0;  // s: before line 1, between lines, after the last line
const FS_MIN = 13;                          // px: smallest text on the stage (spec V2)
const PANEL_TOP = 62, PANEL_H = 424;        // px: the three upper panels
const BAND_TOP = 494, BAND_H = 110;         // px: the bottom band
const RAIL_X = 20, RAIL_W = 176;            // px: skeleton rail
const WORK_X = 206, WORK_W = 622;           // px: work zone
const SIDE_X = 838, SIDE_W = 422;           // px: tape and f(t) column
const CAPTION_BOTTOM = 62;                  // px above the stage bottom
const SEEK_STEP = 1, SEEK_STEP_BIG = 5;     // s: arrow-key seek on the progress slider
const KEY_STEP = 0.1, KEY_STEP_BIG = 1;     // s: arrow-key seek on the page
const START_EPS = 0.1;                      // s: playhead counts as "at the start / at the end" within this
const CLIP_RESYNC = 0.3;                    // s: audio is re-seeked when it drifts this far from the playhead
const CLIP_END_EPS = 0.05;                  // s: within this of a clip's end the clip is treated as finished
const HALF_MIN = 30;                        // s: running time is shown to the nearest half minute
const PLOT_TICKS = 4;                       // target number of y-axis intervals

/* ═══ 2 PALETTE ═══════════════════════════════════════════════════════════ */
// Semantic hues are those of the Design build; lightness is lowered from 0.62
// to 0.50 so coloured text meets 4.5:1 on white (spec V2).
const BG = '#FAFAF7', CARD = '#FFFFFF', LETTERBOX = '#F1EFE8';
const INK = '#23262E';          // body text
const MUTE = '#5E6470';         // labels, secondary text (>= 4.5:1)
const UPCOMING = '#858A94';     // rows not yet reached (>= 3:1)
const LINE = '#E6E3DA';         // hairline border
const SHADOW = '0 1px 3px rgba(0,0,0,0.08)';
const ACCENT = 'oklch(0.50 0.14 255)';
const CORAL = 'oklch(0.50 0.11 28)';
const AMBER = 'oklch(0.50 0.11 75)';
const GREEN = 'oklch(0.50 0.11 150)';
const TEAL = 'oklch(0.50 0.11 190)';
const BLUE = 'oklch(0.50 0.11 255)';
const PURPLE = 'oklch(0.50 0.11 300)';
const HEAD = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

/* ═══ 3 TIMELINE + STAGE ══════════════════════════════════════════════════ */
// clamp v to [min, max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
// cubic ease-out on t in [0, 1]
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

const TimelineContext = createContext({ time: 0, duration: 10, playing: false });
// current playhead, s
const useTime = () => useContext(TimelineContext).time;
// full timeline state and setters
const useTimeline = () => useContext(TimelineContext);

// Stage: owns the playhead, scales the 1280 x 720 stage to the window, runs the clock.
function Stage({ duration, children }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef(null);
  const lastTs = useRef(null);

  // fit the stage to the window
  useEffect(() => {
    const el = wrapRef.current;
    const measure = () => setScale(Math.max(MIN_SCALE, Math.min(el.clientWidth / STAGE_W, el.clientHeight / STAGE_H)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // clock: requestAnimationFrame only, one state update per frame
  useEffect(() => {
    if (!playing) { lastTs.current = null; return undefined; }
    let raf = 0;
    const step = (ts) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) { setPlaying(false); return duration; }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); lastTs.current = null; };
  }, [playing, duration]);

  // page keys: space = play / pause, arrows = seek, Home = start.
  // Keys typed on a button, a range input or the seek slider belong to that control.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('role') === 'slider'))) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.code === 'ArrowLeft') setTime((v) => clamp(v - (e.shiftKey ? KEY_STEP_BIG : KEY_STEP), 0, duration));
      else if (e.code === 'ArrowRight') setTime((v) => clamp(v + (e.shiftKey ? KEY_STEP_BIG : KEY_STEP), 0, duration));
      else if (e.code === 'Home') setTime(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);

  const ctx = useMemo(() => ({ time, duration, playing, setTime, setPlaying, muted, setMuted }),
    [time, duration, playing, muted]);

  return (
    <div ref={wrapRef} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', overflow: 'hidden', background: LETTERBOX }}>
      <div id="stage" style={{ width: STAGE_W, height: STAGE_H, flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: BG, transform: `scale(${scale})`, transformOrigin: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
        <TimelineContext.Provider value={ctx}>{children}</TimelineContext.Provider>
      </div>
    </div>
  );
}

/* ═══ 4 CLIPS + NARRATOR ══════════════════════════════════════════════════ */
// The narration clips are embedded as base64 MP3 in the #clip-data JSON block.
const CLIP_DATA = JSON.parse(document.getElementById('clip-data').textContent);

// decode one embedded clip to a blob URL; null when the clip is not embedded
function clipBlobUrl(name) {
  const data = Object.prototype.hasOwnProperty.call(CLIP_DATA, name) ? CLIP_DATA[name] : null;
  if (!data) return null;
  const bin = atob(data.slice(data.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}

// blob URLs for the named clips, plus each clip's measured duration (s) once its metadata has loaded
function useClips(names) {
  const urls = useMemo(() => { const o = {}; names.forEach((n) => { o[n] = clipBlobUrl(n); }); return o; }, [names]);
  const [durs, setDurs] = useState({});
  useEffect(() => {
    let live = true;
    names.forEach((n) => {
      if (!urls[n]) return;
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => { if (live && isFinite(a.duration)) setDurs((s) => Object.assign({}, s, { [n]: a.duration })); };
      a.src = urls[n];
    });
    return () => { live = false; };
  }, [urls]);
  return { urls, durs };
}

// event-driven schedule: each line starts when the previous clip has ended plus GAP
function buildSchedule(lang, measured) {
  const durs = lang.clips.map((clip, i) => {
    const m = measured[clip];
    return (m != null && isFinite(m) && m > 0) ? m : lang.durs[i];
  });
  const starts = []; let t = LEAD;
  for (let i = 0; i < durs.length; i++) { starts[i] = t; t += durs[i] + GAP; }
  return { starts, durs, total: t - GAP + TAIL };
}

// index of the line the playhead is in (-1 before line 1)
const idxAt = (sched, time) => { let i = -1; for (let k = 0; k < sched.starts.length; k++) if (time >= sched.starts[k]) i = k; return i; };

// named times on the timeline; the last line is the "Your turn" line
function makeTL(sched) {
  const last = sched.starts.length - 1;
  const S = (i) => sched.starts[i], D = (i) => sched.durs[i];
  return {
    starts: sched.starts, durs: sched.durs, total: sched.total, DUR: sched.total, L: sched.starts,
    TITLE_OUT: S(0) + 0.24 * D(0), FS_ON: S(0) + 0.34 * D(0), HEAD_ON: S(0) + 0.6,
    YOUR_TURN: S(last), EXPLORE: S(last) + 0.16 * D(last), REVERT: S(last) + D(last),
    FINISH: sched.total - TAIL + 0.4,
  };
}
const TLCtx = createContext(null);
// named timeline times for the current schedule
const useTL = () => useContext(TLCtx);

// banner shown when a clip is missing: narration halts, silence is never played
function ClipHalt({ name }) {
  return (
    <div role="alert" style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(250,250,247,0.85)' }}>
      <div style={{ background: CARD, border: `2px solid ${CORAL}`, borderRadius: 8, padding: '20px 28px', textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: CORAL }}>{'⚠ MISSING CLIP — NARRATION HALTED'}</div>
        <div style={{ fontFamily: MONO, fontSize: 16, color: INK, marginTop: 10 }}>{name}</div>
        <div style={{ fontFamily: HEAD, fontSize: 14, color: MUTE, marginTop: 8 }}>This clip is not embedded in the page. Silence is never played.</div>
      </div>
    </div>
  );
}

// Narrator: plays the clip of the current line in step with the playhead (pre-rendered clips only, no device speech)
function Narrator({ lines, urls }) {
  const { time, playing, setPlaying, muted } = useTimeline();
  const refs = useRef([]);
  const missing = lines.find((l) => !urls[l.clip]);
  useEffect(() => { if (missing && playing) setPlaying(false); }, [missing, playing]);
  let idx = -1;
  for (let i = 0; i < lines.length; i++) if (time >= lines[i].at) idx = i;
  useEffect(() => {
    lines.forEach((l, i) => {
      const a = refs.current[i]; if (!a) return;
      a.muted = muted;
      if (i === idx && playing && !missing) {
        const off = time - l.at;
        // the clip is finishing or has finished: leave it alone (a finished clip is never restarted)
        if (isFinite(a.duration) && off >= a.duration - CLIP_END_EPS) return;
        if (a.ended || Math.abs(a.currentTime - off) > CLIP_RESYNC) a.currentTime = Math.max(0, off);
        if (a.paused) a.play().catch(() => setPlaying(false));   // playback refused (no user gesture): stop the clock too
      } else {
        if (!a.paused) a.pause();
        if (i > idx && a.currentTime > 0.01) a.currentTime = 0;   // arm later clips to replay from 0
      }
    });
  });
  return (
    <React.Fragment>
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {lines.map((l, i) => (urls[l.clip]
          ? <audio key={i} ref={(el) => { refs.current[i] = el; }} src={urls[l.clip]} preload="auto" data-clip={l.clip} />
          : null))}
      </div>
      {missing ? <ClipHalt name={missing.clip} /> : null}
    </React.Fragment>
  );
}

/* ═══ 5 SMALL PARTS ═══════════════════════════════════════════════════════ */
// timed reveal: children fade and slide in at `from`
function Reveal({ from, dur, y, style, children }) {
  const time = useTime();
  if (time < from) return null;
  const e = easeOutCubic(clamp((time - from) / dur, 0, 1));
  return <div style={Object.assign({ opacity: e, transform: `translateY(${(1 - e) * y}px)` }, style)}>{children}</div>;
}

// screen-reader-only live summary of the current state
function SrSummary({ text }) {
  return <div aria-live="polite" aria-atomic="true" className="sr-only">{text}</div>;
}

// class for a row the tour has not reached yet: one grey at >= 3:1 (spec V2)
const up = (reached) => (reached ? undefined : 'up');

// Eq: equation text with the unknowns A, B, C, D in amber (spec V1).
// A letter counts as an unknown when it stands alone or multiplies s: "A/(s+1)", "Bs", "C(s+1)".
// "A₁", "B₁" (cosine / sine coefficients) and ordinary words are left alone.
const UNKNOWN_RE = /(?<![A-Za-z])[ABCD](?![A-Za-rt-z₁]|s[A-Za-z])/g;
function Eq({ text }) {
  const out = []; let last = 0, m;
  UNKNOWN_RE.lastIndex = 0;
  while ((m = UNKNOWN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<span key={m.index} data-unk="1" style={{ color: AMBER, fontWeight: 600 }}>{m[0]}</span>);
    last = m.index + 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return <React.Fragment>{out}</React.Fragment>;
}

// stacked fraction
function Frac({ num, den, size, color }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 600, color, lineHeight: 1.15 }}>{num}</span>
      <span className="bar" style={{ alignSelf: 'stretch', height: 2, background: color }} />
      <span style={{ fontFamily: MONO, fontSize: size, fontWeight: 600, color, lineHeight: 1.15 }}>{den}</span>
    </div>
  );
}

// square matrix brackets around children
function Bracket({ children, color }) {
  const side = (l) => ({ width: 5, borderTop: `1.5px solid ${color}`, borderBottom: `1.5px solid ${color}`,
    borderLeft: l ? `1.5px solid ${color}` : 'none', borderRight: l ? 'none' : `1.5px solid ${color}` });
  return (
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <span style={side(true)} />
      <div style={{ padding: '2px 5px' }}>{children}</div>
      <span style={side(false)} />
    </div>
  );
}

// matrix form  [rows]·[unknowns] = [rhs], unknowns in amber; `tags` label the rows (powers of s)
function Matrix({ rows, unk, rhs, tags, tint }) {
  const cell = { fontFamily: MONO, fontSize: 13, color: INK, textAlign: 'center', minWidth: 17, lineHeight: '18px', fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {tags.map((t) => <div key={t} style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE, lineHeight: '18px', height: 18 }}>{t}</div>)}
      </div>
      <Bracket color={tint}>
        {rows.map((r, i) => <div key={i} style={{ display: 'flex', gap: 8 }}>{r.map((v, j) => <span key={j} style={cell}>{v}</span>)}</div>)}
      </Bracket>
      <Bracket color={AMBER}>
        {unk.map((u) => <div key={u} data-unk="1" style={Object.assign({}, cell, { color: AMBER, fontWeight: 600 })}>{u}</div>)}
      </Bracket>
      <span style={{ fontFamily: MONO, fontSize: 14, color: MUTE }}>=</span>
      <Bracket color={tint}>
        {rhs.map((v, i) => <div key={i} style={cell}>{v}</div>)}
      </Bracket>
    </div>
  );
}

// small caps heading of a panel
const zoneHead = (label, color) => (
  <div style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.08em', color: color || MUTE, whiteSpace: 'nowrap' }}>{label}</div>
);
// small label above a block
const smallLabel = (label, color) => (
  <div style={{ fontFamily: MONO, fontSize: FS_MIN, letterSpacing: '0.04em', color: color || MUTE }}>{label}</div>
);
// absolutely placed card
const panel = (extra) => Object.assign({
  position: 'absolute', background: CARD, border: `1px solid ${LINE}`, borderRadius: 10,
  boxShadow: SHADOW, boxSizing: 'border-box', padding: '9px 12px', overflow: 'hidden',
}, extra);
// style of a band / card button
const btnStyle = (active, tint) => ({
  fontFamily: MONO, fontSize: FS_MIN, cursor: 'pointer', borderRadius: 5, padding: '5px 10px',
  background: active ? (tint || INK) : CARD, color: active ? '#fff' : INK,
  border: `1px solid ${active ? (tint || INK) : MUTE}`,
});

// skeleton rail: the steps of the method; `footer` holds the transform pair(s)
const CIRCLED = ['①', '②', '③', '④'];
function Rail({ items, head, active, lit, tints, footer }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.L[1] + 0.6) / 0.6, 0, 1);
  if (on <= 0.01) return null;
  return (
    <div data-gate="rail" style={panel({ left: RAIL_X, top: PANEL_TOP, width: RAIL_W, height: PANEL_H, opacity: on,
      display: 'flex', flexDirection: 'column', gap: 12 })}>
      {zoneHead(head)}
      {items.map((t, i) => {
        const isOn = lit[i], isAct = i === active;
        const col = isAct ? tints[i] : isOn ? INK : UPCOMING;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 14, color: col, lineHeight: '18px', width: 15, flexShrink: 0 }}>
              {isOn && !isAct ? '✓' : CIRCLED[i]}
            </span>
            <span style={{ fontFamily: HEAD, fontSize: 13.5, lineHeight: '18px', color: col,
              fontWeight: isAct ? 600 : 400, textWrap: 'pretty' }}>{t}</span>
          </div>
        );
      })}
      <div style={{ marginTop: 'auto', borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>{footer}</div>
    </div>
  );
}

// applies the tour state for the current playhead unless the learner has taken over
function TourDriver({ apply, grabbed, tourState }) {
  const { time } = useTimeline();
  const TL = useTL();
  useEffect(() => { if (!grabbed) apply(tourState(TL, Math.min(time, TL.REVERT))); }, [time, grabbed, TL]);
  return null;
}

/* ═══ 6 PLOT AXES ═════════════════════════════════════════════════════════ */
// "nice" tick step (1, 2 or 5 times a power of ten) for a span and a target number of intervals
function niceStep(span, target) {
  const raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
}
// tick label with a true minus sign, trimmed to the step's precision
function tickLabel(v, step) {
  const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const s = Math.abs(v).toFixed(dec);
  return (v < -1e-12 ? '−' : '') + s;
}

// FtPlot: f(t) against t with numbered axes (spec V4). f is dimensionless; t in s, ticks every second.
// `extra` adds dashed envelope curves [{ f, color }]; two of them are joined by a light band. Curves are drawn only when `shown`.
function FtPlot({ f, tmax, width, height, shown, color, extra }) {
  const padL = 44, padR = 46, padT = 8, padB = 20;   // px: room for the tick labels
  const N = 240;
  let ymin = 0, ymax = 0;
  const all = [f].concat((extra || []).map((e) => e.f));
  for (let i = 0; i <= N; i++) for (const g of all) { const y = g((i / N) * tmax); if (!isFinite(y)) continue; if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
  if (ymax - ymin < 1e-9) ymax = ymin + 1;
  const step = niceStep(ymax - ymin, PLOT_TICKS);
  const y0 = Math.floor(ymin / step + 1e-9) * step, y1 = Math.ceil(ymax / step - 1e-9) * step;
  const PX = (t) => padL + (t / tmax) * (width - padL - padR);
  const PY = (y) => padT + (1 - (y - y0) / (y1 - y0)) * (height - padT - padB);
  // SVG path of g over [0, tmax]; `back` draws it right to left and joins on (used to close the envelope band)
  const path = (g, back) => {
    let d = '';
    for (let k = 0; k <= N; k++) { const i = back ? N - k : k, t = (i / N) * tmax; d += ((k || back) ? 'L' : 'M') + PX(t).toFixed(1) + ' ' + PY(g(t)).toFixed(1) + ' '; }
    return d;
  };
  const yt = []; for (let v = y0; v <= y1 + step * 1e-6; v += step) yt.push(Math.abs(v) < step * 1e-6 ? 0 : v);
  const tt = []; for (let t = 0; t <= tmax + 1e-9; t += 1) tt.push(t);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" data-plot="ft"
      aria-label={'Plot of f(t) for t from 0 to ' + tmax + ' seconds'} style={{ display: 'block', flexShrink: 0 }}>
      {yt.map((v) => (
        <g key={'y' + v}>
          <line x1={padL} y1={PY(v)} x2={width - padR} y2={PY(v)} stroke={LINE} strokeWidth={v === 0 ? 1.4 : 0.8} />
          <text x={padL - 6} y={PY(v) + 4.5} textAnchor="end" fontFamily={MONO} fontSize={FS_MIN} fill={MUTE}>{tickLabel(v, step)}</text>
        </g>
      ))}
      <line x1={padL} y1={padT} x2={padL} y2={height - padB} stroke={MUTE} strokeWidth="1" />
      <line x1={padL} y1={PY(0)} x2={width - padR} y2={PY(0)} stroke={MUTE} strokeWidth="1" />
      {tt.map((t) => (
        <g key={'t' + t}>
          <line x1={PX(t)} y1={height - padB} x2={PX(t)} y2={height - padB + 4} stroke={MUTE} strokeWidth="1" />
          <text x={PX(t)} y={height - 3} textAnchor="middle" fontFamily={MONO} fontSize={FS_MIN} fill={MUTE}>{t}</text>
        </g>
      ))}
      <text x={width - 2} y={height - 3} textAnchor="end" fontFamily={MONO} fontSize={FS_MIN} fill={MUTE}>t, s</text>
      {shown && extra && extra.length === 2 && (
        <path d={path(extra[0].f) + path(extra[1].f, true) + 'Z'} fill={extra[0].color} opacity="0.10" stroke="none" />
      )}
      {shown && (extra || []).map((e, i) => (
        <path key={i} d={path(e.f)} fill="none" stroke={e.color} strokeWidth="1.6" strokeDasharray="5 3" />
      ))}
      {shown && <path d={path(f)} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
}

/* ═══ 7 CHROME ════════════════════════════════════════════════════════════ */
// running time to the nearest half minute, e.g. "About 2½ min"
function runningTime(total) {
  const halves = Math.round(total / HALF_MIN), whole = Math.floor(halves / 2);
  return 'About ' + (whole || '') + (halves % 2 ? '½' : '') + ' min';
}

// OpeningCard (spec G2): silent summary card; the Start click is the audio user gesture
function OpeningCard({ card }) {
  const { time, duration, playing, setTime, setPlaying, setMuted } = useTimeline();
  if (playing || time >= START_EPS) return null;
  const start = () => { setMuted(false); setTime(0); setPlaying(true); };
  const label = { fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: MUTE };
  return (
    <div data-card="opening" style={{ position: 'absolute', inset: 0, zIndex: 40, background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 820, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: SHADOW,
        padding: '30px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', color: ACCENT }}>{card.series}</div>
        <h1 style={{ margin: 0, fontFamily: HEAD, fontSize: 38, fontWeight: 600, color: INK, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{card.title}</h1>
        <div style={{ fontFamily: HEAD, fontSize: 18, color: INK, lineHeight: 1.45 }}>{card.sentence}</div>
        <div>
          <div style={label}>WHAT HAPPENS</div>
          <ol style={{ margin: '6px 0 0', paddingLeft: 24, fontFamily: HEAD, fontSize: 17, color: INK, lineHeight: 1.5 }}>
            {card.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
        <div>
          <div style={label}>{'YOU’LL BE ABLE TO'}</div>
          <div style={{ marginTop: 6, fontFamily: HEAD, fontSize: 17, color: INK, lineHeight: 1.45 }}>{card.able}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 6 }}>
          <button type="button" onClick={start} autoFocus style={{ fontFamily: HEAD, fontSize: 20, fontWeight: 600, color: '#fff',
            background: ACCENT, border: 'none', borderRadius: 8, padding: '11px 34px', cursor: 'pointer' }}>{'▶ Start'}</button>
          <div style={{ fontFamily: HEAD, fontSize: 16, color: INK }}>
            <span data-running-time="1">{runningTime(duration)}</span>{' · narrated, turn sound on'}
          </div>
          <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 14, color: MUTE }}>{VERSION}</div>
        </div>
      </div>
    </div>
  );
}

// ReplayPill: compact control shown at the end; the stage below stays usable
function ReplayPill() {
  const { time, duration, playing, setTime, setPlaying } = useTimeline();
  if (playing || time < duration - START_EPS) return null;
  return (
    <button type="button" data-gate="replay" onClick={() => { setTime(0); setPlaying(true); }}
      style={{ position: 'absolute', left: 20, top: 14, zIndex: 30, cursor: 'pointer', padding: '7px 14px', borderRadius: 6,
        background: CARD, border: `1px solid ${MUTE}`, fontFamily: MONO, fontSize: 14, color: INK }}>
      {'▶ Replay'}
    </button>
  );
}

// SoundToggle: mutes or unmutes the narration
function SoundToggle() {
  const { muted, setMuted } = useTimeline();
  return (
    <button type="button" data-gate="sound" aria-pressed={!muted} onClick={() => setMuted(!muted)}
      style={{ position: 'absolute', right: 20, top: 14, zIndex: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 14px', borderRadius: 6, background: CARD, border: `1px solid ${MUTE}`,
        fontFamily: MONO, fontSize: 14, color: INK }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: muted ? UPCOMING : ACCENT }} />
      {muted ? 'voice off' : 'voice on'}
    </button>
  );
}

// Header: page heading (spec V6) with the key-point line under it (spec G3)
function Header({ head, sub, keyPoint }) {
  const TL = useTL();
  return (
    <Reveal from={TL.HEAD_ON} dur={0.5} y={-8} style={{ position: 'absolute', left: 150, right: 150, top: 6, textAlign: 'center' }}>
      <div data-gate="header">
        <div style={{ fontFamily: HEAD, fontSize: 20, color: INK, fontWeight: 600, lineHeight: '28px' }}>
          {head}<span style={{ fontFamily: MONO, color: MUTE, fontSize: 14, fontWeight: 400 }}>{' ' + sub}</span>
        </div>
        <div data-keypoint="1" style={{ fontFamily: HEAD, fontSize: 14.5, color: INK, lineHeight: '20px' }}>{keyPoint}</div>
      </div>
    </Reveal>
  );
}

// TitleCard: brief title shown while line 1 begins
function TitleCard({ ui }) {
  const time = useTime(); const TL = useTL();
  const out = clamp((TL.TITLE_OUT + 0.6 - time) / 0.6, 0, 1);
  if (out <= 0) return null;
  const inn = clamp(time / 0.7, 0, 1);
  return (
    <div data-gate="title" style={{ position: 'absolute', left: 0, right: 0, top: 220, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10, opacity: out * inn }}>
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.14em', color: ACCENT }}>{ui.kicker}</div>
      <div style={{ fontFamily: HEAD, fontSize: 44, fontWeight: 600, color: INK, letterSpacing: '-0.02em' }}>{ui.title}</div>
      <div style={{ fontFamily: MONO, fontSize: 16, color: MUTE }}>{ui.sub}</div>
    </div>
  );
}

// FinishStrip: closing line after the last clip
function FinishStrip({ ui }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.FINISH) / 0.6, 0, 1);
  if (on <= 0) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', opacity: on, pointerEvents: 'none' }}>
      <div data-gate="finish" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW,
        padding: '8px 20px', display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span style={{ fontFamily: HEAD, fontSize: 17, fontWeight: 600, color: INK }}>{ui.endTitle}</span>
        <span style={{ fontFamily: MONO, fontSize: 14, color: MUTE }}>{ui.endSub}</span>
      </div>
    </div>
  );
}

// Captions: the on-screen line for the current narration clip
function Captions({ sched, lang }) {
  const time = useTime(); const TL = useTL();
  const i = idxAt(sched, time);
  if (i < 0 || time >= TL.FINISH) return null;
  const appear = clamp((time - sched.starts[i]) / 0.35, 0, 1);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div data-gate="caption" style={{ maxWidth: 1040, margin: '0 20px', background: CARD,
        border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW, padding: '8px 18px', opacity: appear,
        fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' }}>
        <Eq text={lang.caps[i]} />
      </div>
    </div>
  );
}

// ProgressBar: the one playback bar (spec V3) — play / pause, time, seek slider
function ProgressBar() {
  const { time, duration, playing, setTime, setPlaying } = useTimeline();
  const trackRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const pct = duration > 0 ? clamp(time / duration, 0, 1) * 100 : 0;
  const fmt = (t) => { const m = Math.floor(Math.max(0, t) / 60), s = Math.floor(Math.max(0, t) % 60); return m + ':' + String(s).padStart(2, '0'); };
  const seek = useCallback((e) => {
    const r = trackRef.current.getBoundingClientRect();
    setTime(clamp((e.clientX - r.left) / r.width, 0, 1) * duration);
  }, [duration]);
  useEffect(() => {
    if (!drag) return undefined;
    const up2 = () => setDrag(false);
    window.addEventListener('pointermove', seek); window.addEventListener('pointerup', up2);
    return () => { window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up2); };
  }, [drag, seek]);
  const key = (e) => {
    const st = e.shiftKey ? SEEK_STEP_BIG : SEEK_STEP;
    if (e.key === 'ArrowRight') { e.preventDefault(); setTime(clamp(time + st, 0, duration)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setTime(clamp(time - st, 0, duration)); }
    else if (e.key === 'Home') { e.preventDefault(); setTime(0); }
    else if (e.key === 'End') { e.preventDefault(); setTime(duration); }
  };
  const tfield = { fontFamily: MONO, fontSize: 14, color: INK, width: 44, fontVariantNumeric: 'tabular-nums' };
  return (
    <div data-gate="progress" style={{ position: 'absolute', left: 190, right: 190, bottom: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14,
      background: CARD, border: `1px solid ${LINE}`, boxShadow: SHADOW, borderRadius: 10, padding: '6px 16px' }}>
      <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause' : 'Play'}
        style={{ cursor: 'pointer', width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: ACCENT, border: 'none', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {playing
          ? <svg width="10" height="12" aria-hidden="true"><rect x="0" y="0" width="3" height="12" fill="#fff" /><rect x="6" y="0" width="3" height="12" fill="#fff" /></svg>
          : <svg width="11" height="12" aria-hidden="true"><path d="M0 0 L11 6 L0 12 Z" fill="#fff" /></svg>}
      </button>
      <div style={Object.assign({ textAlign: 'right' }, tfield)}>{fmt(time)}</div>
      <div ref={trackRef} tabIndex={0} role="slider" aria-label="Seek, seconds"
        aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)}
        onPointerDown={(e) => { setDrag(true); seek(e); }} onKeyDown={key}
        style={{ flex: 1, height: 18, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'rgba(60,65,80,0.25)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: 0, width: pct + '%', height: 4, background: ACCENT, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: pct + '%', width: 12, height: 12, marginLeft: -6, borderRadius: 6, background: '#fff', border: `2px solid ${ACCENT}` }} />
      </div>
      <div style={Object.assign({ textAlign: 'left' }, tfield)}>{fmt(duration)}</div>
    </div>
  );
}

// Stamp: visible version badge in the footer (spec G5)
function Stamp() {
  return (
    <div data-gate="stamp" data-version-badge="1" style={{ position: 'absolute', left: 20, bottom: 22, fontFamily: MONO, fontSize: 14, color: MUTE }}>
      {'ECE 2003 · ' + VERSION}
    </div>
  );
}

/* ═══ 8 YOUR TURN ═════════════════════════════════════════════════════════ */
// YourTurnCard (spec G6): a new problem over the work zone. No answer boxes:
// the learner works on paper, then Show solution reveals the worked steps.
function YourTurnCard({ yt, shown, onToggle, onClose }) {
  const lab = { fontFamily: MONO, fontSize: FS_MIN, color: MUTE, width: 92, flexShrink: 0 };
  return (
    <div data-gate="work" data-card="yourturn" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, zIndex: 5,
      border: `2px solid ${ACCENT}`, display: 'flex', flexDirection: 'column', gap: 9 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, letterSpacing: '0.1em', color: ACCENT }}>YOUR TURN</div>
        <button type="button" onClick={onClose} style={btnStyle(false)}>{'← back to the worked example'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 19, color: MUTE }}>F(s) =</span>
        <Frac num={yt.num} den={yt.den} size={20} color={TEAL} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ fontFamily: HEAD, fontSize: 15.5, color: INK, flex: 1, textWrap: 'pretty' }}>
          <b>Work it on paper.</b>{' ' + yt.ask}
        </div>
        <button type="button" onClick={onToggle} aria-expanded={shown}
          style={Object.assign(btnStyle(!shown, ACCENT), { fontSize: 15, padding: '8px 16px', flexShrink: 0 })}>
          {shown ? 'Hide solution' : 'Show solution'}
        </button>
      </div>
      {shown && (
        <div data-solution="1" style={{ borderTop: `1px solid ${LINE}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {yt.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={lab}>{s[0]}</span>
              <span style={{ fontFamily: MONO, fontSize: 14, color: INK, textWrap: 'pretty' }}><Eq text={s[1]} /></span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
            <span style={lab}>answer</span>
            <span data-yt-answer="1" style={{ fontFamily: MONO, fontSize: 15.5, fontWeight: 600, color: GREEN }}>{'f(t) = ' + yt.ft}</span>
          </div>
          <div style={{ fontFamily: HEAD, fontSize: 13.5, color: MUTE }}>{'This f(t) is plotted in the f(t) panel on the right.'}</div>
        </div>
      )}
    </div>
  );
}

// useYourTurn: the card opens when the last line starts; any band control or the close button puts it away.
function useYourTurn() {
  const { time, playing } = useTimeline();
  const TL = useTL();
  const [away, setAway] = useState(false);
  const [shown, setShown] = useState(false);
  const reached = time >= TL.YOUR_TURN;
  useEffect(() => { if (playing && !reached) { setAway(false); setShown(false); } }, [playing, reached]);
  return { reached, open: reached && !away, shown: reached && !away && shown,
    toggle: () => setShown((s) => !s), close: () => setAway(true), reopen: () => setAway(false) };
}

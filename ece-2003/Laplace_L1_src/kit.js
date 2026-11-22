const { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } = React;
/* ═══ 1 CONSTANTS ═════════════════════════════════════════════════════════ */
const VERSION = 'v1.0.0'; // page version; agrees with the file name, title, meta tag and header comment
const STAGE_W = 1280, STAGE_H = 720; // stage size, px
const MIN_SCALE = 0.05; // lower bound for the fit scale
const LEAD = 1.00, GAP = 1.20, TAIL = 3.0; // s: before line 1, between lines, after the last line
const FS_MIN = 13; // px: smallest text on the stage (kit rule 77)
const PANEL_TOP = 62, PANEL_H = 424; // px: the upper panels
const BAND_TOP = 494, BAND_H = 110; // px: the bottom band
const RAIL_X = 20, RAIL_W = 176; // px: skeleton rail
const WORK_X = 206, WORK_W = 622; // px: work zone
const SIDE_X = 838, SIDE_W = 422; // px: pairs and definition column
const CAPTION_BOTTOM = 62; // px above the stage bottom
const SEEK_STEP = 1, SEEK_STEP_BIG = 5; // s: arrow-key seek on the progress slider
const KEY_STEP = 0.1, KEY_STEP_BIG = 1; // s: arrow-key seek on the page
const START_EPS = 0.1; // s: playhead counts as "at the start / at the end" within this
const CLIP_RESYNC = 0.3; // s: audio is re-seeked when it drifts this far from the playhead
const CLIP_END_EPS = 0.05; // s: within this of a clip's end the clip is treated as finished
const HALF_MIN = 30; // s: running time is shown to the nearest half minute
const LAND_MOVE = 0.4; // s: a value's move into its pair slot (focus rule R5)
const FOCUS_FS = 24, VALUE_FS = 30, SMALL_FS = 16; // px: focus line, landing value, everything else (focus rule R2)
/* ═══ 2 PALETTE ═══════════════════════════════════════════════════════════ */
// Semantic hues are those of the Design build; lightness is lowered from 0.62
// to 0.50 so coloured text meets 4.5:1 on white (kit rule 75).
const BG = '#FAFAF7', CARD = '#FFFFFF', LETTERBOX = '#F1EFE8';
const INK = '#23262E'; // body text
const MUTE = '#5E6470'; // labels, secondary text (>= 4.5:1)
const UPCOMING = '#858A94'; // rows not yet reached (>= 3:1)
const LINE = '#E6E3DA'; // hairline border
const SHADOW = '0 1px 3px rgba(0,0,0,0.08)';
const ACCENT = 'oklch(0.50 0.14 255)';
const CORAL = 'oklch(0.50 0.11 28)';
const AMBER = 'oklch(0.50 0.11 75)';
const GREEN = 'oklch(0.50 0.11 150)';
const TEAL = 'oklch(0.50 0.11 190)';
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
    if (!playing) {
      lastTs.current = null;
      return undefined;
    }
    let raf = 0;
    const step = (ts) => {
      if (lastTs.current == null)
        lastTs.current = ts;
      const dt = (ts - lastTs.current) / 1000;
      lastTs.current = ts;
      setTime((t) => {
        const next = t + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
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
      if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || (t.getAttribute && t.getAttribute('role') === 'slider')))
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      else if (e.code === 'ArrowLeft')
        setTime((v) => clamp(v - (e.shiftKey ? KEY_STEP_BIG : KEY_STEP), 0, duration));
      else if (e.code === 'ArrowRight')
        setTime((v) => clamp(v + (e.shiftKey ? KEY_STEP_BIG : KEY_STEP), 0, duration));
      else if (e.code === 'Home')
        setTime(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);
  const ctx = useMemo(() => ({ time, duration, playing, setTime, setPlaying, muted, setMuted }), [time, duration, playing, muted]);
  return (React.createElement("div", { ref: wrapRef, style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
      justifyContent: 'center', overflow: 'hidden', background: LETTERBOX } },
    React.createElement("div", { id: "stage", style: { width: STAGE_W, height: STAGE_H, flexShrink: 0, position: 'relative', overflow: 'hidden',
        background: BG, transform: `scale(${scale})`, transformOrigin: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' } },
      React.createElement(TimelineContext.Provider, { value: ctx }, children))));
}
/* ═══ 4 CLIPS + NARRATOR ══════════════════════════════════════════════════ */
// The narration clips are embedded as base64 MP3 in the #clip-data JSON block.
const CLIP_DATA = JSON.parse(document.getElementById('clip-data').textContent);
// decode one embedded clip to a blob URL; null when the clip is not embedded
function clipBlobUrl(name) {
  const data = Object.prototype.hasOwnProperty.call(CLIP_DATA, name) ? CLIP_DATA[name] : null;
  if (!data)
    return null;
  const bin = atob(data.slice(data.indexOf(',') + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++)
    bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
}
// blob URLs for the named clips, plus each clip's measured duration (s) once its metadata has loaded
function useClips(names) {
  const urls = useMemo(() => { const o = {}; names.forEach((n) => { o[n] = clipBlobUrl(n); }); return o; }, [names]);
  const [durs, setDurs] = useState({});
  useEffect(() => {
    let live = true;
    names.forEach((n) => {
      if (!urls[n])
        return;
      const a = document.createElement('audio');
      a.preload = 'metadata';
      a.onloadedmetadata = () => { if (live && isFinite(a.duration))
        setDurs((s) => Object.assign({}, s, { [n]: a.duration })); };
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
  const starts = [];
  let t = LEAD;
  const gap = lang.gap != null ? lang.gap : GAP; // s: a page may hold longer between lines
  for (let i = 0; i < durs.length; i++) {
    starts[i] = t;
    t += durs[i] + gap;
  }
  return { starts, durs, total: t - gap + TAIL };
}
// index of the line the playhead is in (-1 before line 1)
const idxAt = (sched, time) => { let i = -1; for (let k = 0; k < sched.starts.length; k++)
  if (time >= sched.starts[k])
    i = k; return i; };
// named times on the timeline; the last line is the "Your turn" line
function makeTL(sched) {
  const last = sched.starts.length - 1;
  const S = (i) => sched.starts[i], D = (i) => sched.durs[i];
  return {
    starts: sched.starts, durs: sched.durs, total: sched.total, DUR: sched.total, L: sched.starts,
    TITLE_OUT: S(0) + 0.24 * D(0), FS_ON: S(0) + 0.34 * D(0), HEAD_ON: S(0) + 0.6,
    YOUR_TURN: S(last), REVERT: S(last) + D(last),
    FINISH: sched.total - TAIL + 0.4,
  };
}
const TLCtx = createContext(null);
// named timeline times for the current schedule
const useTL = () => useContext(TLCtx);
// banner shown when a clip is missing: narration halts, silence is never played
function ClipHalt({ name }) {
  return (React.createElement("div", { role: "alert", style: { position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'rgba(250,250,247,0.85)' } },
    React.createElement("div", { style: { background: CARD, border: `2px solid ${CORAL}`, borderRadius: 8, padding: '20px 28px', textAlign: 'center', maxWidth: 560 } },
      React.createElement("div", { style: { fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.1em', color: CORAL } }, '⚠ MISSING CLIP — NARRATION HALTED'),
      React.createElement("div", { style: { fontFamily: MONO, fontSize: 16, color: INK, marginTop: 10 } }, name),
      React.createElement("div", { style: { fontFamily: HEAD, fontSize: 14, color: MUTE, marginTop: 8 } }, "This clip is not embedded in the page. Silence is never played."))));
}
// Narrator: plays the clip of the current line in step with the playhead (pre-rendered clips only, no device speech)
function Narrator({ lines, urls }) {
  const { time, playing, setPlaying, muted } = useTimeline();
  const refs = useRef([]);
  const missing = lines.find((l) => !urls[l.clip]);
  useEffect(() => { if (missing && playing)
    setPlaying(false); }, [missing, playing]);
  let idx = -1;
  for (let i = 0; i < lines.length; i++)
    if (time >= lines[i].at)
      idx = i;
  useEffect(() => {
    lines.forEach((l, i) => {
      const a = refs.current[i];
      if (!a)
        return;
      a.muted = muted;
      if (i === idx && playing && !missing) {
        const off = time - l.at;
        // the clip is finishing or has finished: leave it alone (a finished clip is never restarted)
        if (isFinite(a.duration) && off >= a.duration - CLIP_END_EPS)
          return;
        if (a.ended || Math.abs(a.currentTime - off) > CLIP_RESYNC)
          a.currentTime = Math.max(0, off);
        if (a.paused)
          a.play().catch(() => setPlaying(false)); // playback refused (no user gesture): stop the clock too
      }
      else {
        if (!a.paused)
          a.pause();
        if (i > idx && a.currentTime > 0.01)
          a.currentTime = 0; // arm later clips to replay from 0
      }
    });
  });
  return (React.createElement(React.Fragment, null,
    React.createElement("div", { style: { position: 'absolute', width: 0, height: 0, overflow: 'hidden' } }, lines.map((l, i) => (urls[l.clip]
      ? React.createElement("audio", { key: i, ref: (el) => { refs.current[i] = el; }, src: urls[l.clip], preload: "auto", "data-clip": l.clip })
      : null))),
    missing ? React.createElement(ClipHalt, { name: missing.clip }) : null));
}
/* ═══ 5 SMALL PARTS ═══════════════════════════════════════════════════════ */
// timed reveal: children fade and slide in at `from`
function Reveal({ from, dur, y, style, children }) {
  const time = useTime();
  if (time < from)
    return null;
  const e = easeOutCubic(clamp((time - from) / dur, 0, 1));
  return React.createElement("div", { style: Object.assign({ opacity: e, transform: `translateY(${(1 - e) * y}px)` }, style) }, children);
}
// screen-reader-only live summary of the current state
function SrSummary({ text }) {
  return React.createElement("div", { "aria-live": "polite", "aria-atomic": "true", className: "sr-only" }, text);
}
// small caps heading of a panel
const zoneHead = (label, color) => (React.createElement("div", { style: { fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.08em', color: color || MUTE, whiteSpace: 'nowrap' } }, label));
// small label above a block
const smallLabel = (label, color) => (React.createElement("div", { style: { fontFamily: MONO, fontSize: FS_MIN, letterSpacing: '0.04em', color: color || MUTE } }, label));
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
/* ═══ 7 CHROME ════════════════════════════════════════════════════════════ */
// running time to the nearest half minute, e.g. "About 2½ min"
function runningTime(total) {
  const halves = Math.round(total / HALF_MIN), whole = Math.floor(halves / 2);
  return 'About ' + (whole || '') + (halves % 2 ? '½' : '') + ' min';
}
// OpeningCard (kit rule 61): silent summary card; the Start click is the audio user gesture
function OpeningCard({ card }) {
  const { time, duration, playing, setTime, setPlaying, setMuted } = useTimeline();
  if (playing || time >= START_EPS)
    return null;
  const start = () => { setMuted(false); setTime(0); setPlaying(true); };
  const label = { fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', color: MUTE };
  return (React.createElement("div", { "data-card": "opening", style: { position: 'absolute', inset: 0, zIndex: 40, background: BG, display: 'flex',
      alignItems: 'center', justifyContent: 'center' } },
    React.createElement("div", { style: { width: 820, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: SHADOW,
        padding: '30px 40px', display: 'flex', flexDirection: 'column', gap: 14 } },
      React.createElement("div", { style: { fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', color: ACCENT } }, card.series),
      React.createElement("h1", { style: { margin: 0, fontFamily: HEAD, fontSize: 38, fontWeight: 600, color: INK, letterSpacing: '-0.01em', lineHeight: 1.15 } }, card.title),
      React.createElement("div", { style: { fontFamily: HEAD, fontSize: 18, color: INK, lineHeight: 1.45 } }, card.sentence),
      React.createElement("div", null,
        React.createElement("div", { style: label }, "WHAT HAPPENS"),
        React.createElement("ol", { style: { margin: '6px 0 0', paddingLeft: 24, fontFamily: HEAD, fontSize: 17, color: INK, lineHeight: 1.5 } }, card.steps.map((s, i) => React.createElement("li", { key: i }, s)))),
      React.createElement("div", null,
        React.createElement("div", { style: label }, 'YOU’LL BE ABLE TO'),
        React.createElement("div", { style: { marginTop: 6, fontFamily: HEAD, fontSize: 17, color: INK, lineHeight: 1.45 } }, card.able)),
      React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 20, marginTop: 6 } },
        React.createElement("button", { type: "button", onClick: start, autoFocus: true, style: { fontFamily: HEAD, fontSize: 20, fontWeight: 600, color: '#fff',
            background: ACCENT, border: 'none', borderRadius: 8, padding: '11px 34px', cursor: 'pointer' } }, '▶ Start'),
        React.createElement("div", { style: { fontFamily: HEAD, fontSize: 16, color: INK } },
          React.createElement("span", { "data-running-time": "1" }, runningTime(duration)),
          ' · narrated, turn sound on'),
        React.createElement("div", { style: { marginLeft: 'auto', fontFamily: MONO, fontSize: 14, color: MUTE } }, VERSION)))));
}
// ReplayPill: compact control shown at the end; the stage below stays usable
function ReplayPill() {
  const { time, duration, playing, setTime, setPlaying } = useTimeline();
  if (playing || time < duration - START_EPS)
    return null;
  return (React.createElement("button", { type: "button", "data-gate": "replay", onClick: () => { setTime(0); setPlaying(true); }, style: { position: 'absolute', left: 20, top: 14, zIndex: 30, cursor: 'pointer', padding: '7px 14px', borderRadius: 6,
      background: CARD, border: `1px solid ${MUTE}`, fontFamily: MONO, fontSize: 14, color: INK } }, '▶ Replay'));
}
// SoundToggle: mutes or unmutes the narration
function SoundToggle() {
  const { muted, setMuted } = useTimeline();
  return (React.createElement("button", { type: "button", "data-gate": "sound", "aria-pressed": !muted, onClick: () => setMuted(!muted), style: { position: 'absolute', right: 20, top: 14, zIndex: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 14px', borderRadius: 6, background: CARD, border: `1px solid ${MUTE}`,
      fontFamily: MONO, fontSize: 14, color: INK } },
    React.createElement("span", { style: { width: 9, height: 9, borderRadius: '50%', background: muted ? UPCOMING : ACCENT } }),
    muted ? 'voice off' : 'voice on'));
}
// Header: page heading with the key-point line under it (kit rule 62)
function Header({ head, sub, keyPoint }) {
  const TL = useTL();
  return (React.createElement(Reveal, { from: TL.HEAD_ON, dur: 0.5, y: -8, style: { position: 'absolute', left: 150, right: 150, top: 6, textAlign: 'center' } },
    React.createElement("div", { "data-gate": "header" },
      React.createElement("div", { style: { fontFamily: HEAD, fontSize: 20, color: INK, fontWeight: 600, lineHeight: '28px' } },
        head,
        React.createElement("span", { style: { fontFamily: MONO, color: MUTE, fontSize: 14, fontWeight: 400 } }, ' ' + sub)),
      React.createElement("div", { "data-keypoint": "1", style: { fontFamily: HEAD, fontSize: 14.5, color: INK, lineHeight: '20px' } }, keyPoint))));
}
// TitleCard: brief title shown while line 1 begins
function TitleCard({ ui }) {
  const time = useTime();
  const TL = useTL();
  const out = clamp((TL.TITLE_OUT + 0.6 - time) / 0.6, 0, 1);
  if (out <= 0)
    return null;
  const inn = clamp(time / 0.7, 0, 1);
  return (React.createElement("div", { "data-gate": "title", style: { position: 'absolute', left: 0, right: 0, top: 220, display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 10, opacity: out * inn } },
    React.createElement("div", { style: { fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '0.14em', color: ACCENT } }, ui.kicker),
    React.createElement("div", { style: { fontFamily: HEAD, fontSize: 44, fontWeight: 600, color: INK, letterSpacing: '-0.02em' } }, ui.title),
    React.createElement("div", { style: { fontFamily: MONO, fontSize: 16, color: MUTE } }, ui.sub)));
}
// FinishStrip: closing line after the last clip
function FinishStrip({ ui }) {
  const time = useTime();
  const TL = useTL();
  const on = clamp((time - TL.FINISH) / 0.6, 0, 1);
  if (on <= 0)
    return null;
  return (React.createElement("div", { style: { position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', opacity: on, pointerEvents: 'none' } },
    React.createElement("div", { "data-gate": "finish", style: { background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW,
        padding: '8px 20px', display: 'flex', alignItems: 'baseline', gap: 14 } },
      React.createElement("span", { style: { fontFamily: HEAD, fontSize: 17, fontWeight: 600, color: INK } }, ui.endTitle),
      React.createElement("span", { style: { fontFamily: MONO, fontSize: 14, color: MUTE } }, ui.endSub))));
}
// Captions: the on-screen line for the current beat (`text` is a string or a math node)
function Captions({ sched, text }) {
  const time = useTime();
  const TL = useTL();
  const i = idxAt(sched, time);
  if (i < 0 || time >= TL.FINISH)
    return null;
  const appear = clamp((time - sched.starts[i]) / 0.35, 0, 1);
  return (React.createElement("div", { style: { position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', pointerEvents: 'none' } },
    React.createElement("div", { "data-gate": "caption", style: { maxWidth: 1040, margin: '0 20px', background: CARD,
        border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW, padding: '8px 18px', opacity: appear,
        fontFamily: MONO, fontSize: 15, lineHeight: 1.4, color: INK, textWrap: 'pretty' } },
      text)));
}
// ProgressBar: the one playback bar — play / pause, time, seek slider
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
    if (!drag)
      return undefined;
    const up2 = () => setDrag(false);
    window.addEventListener('pointermove', seek);
    window.addEventListener('pointerup', up2);
    return () => { window.removeEventListener('pointermove', seek); window.removeEventListener('pointerup', up2); };
  }, [drag, seek]);
  const key = (e) => {
    const st = e.shiftKey ? SEEK_STEP_BIG : SEEK_STEP;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setTime(clamp(time + st, 0, duration));
    }
    else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setTime(clamp(time - st, 0, duration));
    }
    else if (e.key === 'Home') {
      e.preventDefault();
      setTime(0);
    }
    else if (e.key === 'End') {
      e.preventDefault();
      setTime(duration);
    }
  };
  const tfield = { fontFamily: MONO, fontSize: 14, color: INK, width: 44, fontVariantNumeric: 'tabular-nums' };
  return (React.createElement("div", { "data-gate": "progress", style: { position: 'absolute', left: 190, right: 190, bottom: 12, zIndex: 20, display: 'flex', alignItems: 'center', gap: 14,
      background: CARD, border: `1px solid ${LINE}`, boxShadow: SHADOW, borderRadius: 10, padding: '6px 16px' } },
    React.createElement("button", { type: "button", onClick: () => setPlaying(!playing), "aria-label": playing ? 'Pause' : 'Play', style: { cursor: 'pointer', width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: ACCENT, border: 'none', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center' } }, playing
      ? React.createElement("svg", { width: "10", height: "12", "aria-hidden": "true" },
        React.createElement("rect", { x: "0", y: "0", width: "3", height: "12", fill: "#fff" }),
        React.createElement("rect", { x: "6", y: "0", width: "3", height: "12", fill: "#fff" }))
      : React.createElement("svg", { width: "11", height: "12", "aria-hidden": "true" },
        React.createElement("path", { d: "M0 0 L11 6 L0 12 Z", fill: "#fff" }))),
    React.createElement("div", { style: Object.assign({ textAlign: 'right' }, tfield) }, fmt(time)),
    React.createElement("div", { ref: trackRef, tabIndex: 0, role: "slider", "aria-label": "Seek, seconds", "aria-valuemin": 0, "aria-valuemax": Math.round(duration), "aria-valuenow": Math.round(time), onPointerDown: (e) => { setDrag(true); seek(e); }, onKeyDown: key, style: { flex: 1, height: 18, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', touchAction: 'none' } },
      React.createElement("div", { style: { position: 'absolute', left: 0, right: 0, height: 4, background: 'rgba(60,65,80,0.25)', borderRadius: 2 } }),
      React.createElement("div", { style: { position: 'absolute', left: 0, width: pct + '%', height: 4, background: ACCENT, borderRadius: 2 } }),
      React.createElement("div", { style: { position: 'absolute', left: pct + '%', width: 12, height: 12, marginLeft: -6, borderRadius: 6, background: '#fff', border: `2px solid ${ACCENT}` } })),
    React.createElement("div", { style: Object.assign({ textAlign: 'left' }, tfield) }, fmt(duration))));
}
// Stamp: visible version badge in the footer (kit rule 84)
function Stamp() {
  return (React.createElement("div", { "data-gate": "stamp", "data-version-badge": "1", style: { position: 'absolute', left: 20, bottom: 22, fontFamily: MONO, fontSize: 14, color: MUTE } }, 'ECE 2003 · ' + VERSION));
}
// true when the learner asks for reduced motion (focus rule R7)
function useReducedMotion() {
  const [rm, setRm] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setRm(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return rm;
}
// Landing (focus rule R5): a dashed path from the value in the focus area to its pair slot, with a dot that
// travels along it in LAND_MOVE s. `progress` is 0..1; null draws the finished path (paused / stepping by hand).
// The path runs right to x = viaX (the gutter between the columns), up to y = viaY (the gap under the pairs
// panel), across to the slot and up into its lower edge, so it never crosses text. Positions are in stage px.
function Landing({ fromSel, toSel, progress, viaX, viaY }) {
  const [pts, setPts] = useState(null);
  useEffect(() => {
    const stage = document.getElementById('stage'), a = document.querySelector(fromSel), b = document.querySelector(toSel);
    if (!stage || !a || !b) {
      setPts(null);
      return;
    }
    const s = stage.getBoundingClientRect(), k = STAGE_W / s.width, ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const p = [(ra.right - s.left) * k + 6, (ra.top + ra.height / 2 - s.top) * k, (rb.left + rb.width / 2 - s.left) * k, (rb.bottom - s.top) * k + 4];
    setPts((o) => (o && o.every((v, i) => Math.abs(v - p[i]) < 0.5) ? o : p));
  });
  if (!pts)
    return null;
  const [x0, y0, x1, y1] = pts, f = progress == null ? 1 : clamp(progress, 0, 1);
  const corners = [[x0, y0], [viaX, y0], [viaX, viaY], [x1, viaY], [x1, y1]];
  const lens = corners.slice(1).map((c, i) => Math.abs(c[0] - corners[i][0]) + Math.abs(c[1] - corners[i][1]));
  let left = f * lens.reduce((sum, v) => sum + v, 0), dot = corners[corners.length - 1];
  for (let i = 0; i < lens.length; i++) {
    if (left <= lens[i]) {
      const u = lens[i] > 0 ? left / lens[i] : 0;
      dot = [corners[i][0] + (corners[i + 1][0] - corners[i][0]) * u, corners[i][1] + (corners[i + 1][1] - corners[i][1]) * u];
      break;
    }
    left -= lens[i];
  }
  return (React.createElement("svg", { "data-landing": "1", width: STAGE_W, height: STAGE_H, "aria-hidden": "true", style: { position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none' } },
    React.createElement("path", { d: 'M' + corners.map((c) => c[0] + ' ' + c[1]).join(' L'), fill: "none", stroke: AMBER, strokeWidth: "2", strokeDasharray: "6 5" }),
    React.createElement("circle", { cx: dot[0], cy: dot[1], r: "5", fill: AMBER })));
}
/* ═══ 8 YOUR TURN + FOCUS PARTS ═══════════════════════════════════════════ */
// useYourTurn: the card opens when the last line starts; any band control or the close button puts it away.
function useYourTurn() {
  const { time, playing } = useTimeline();
  const TL = useTL();
  const [away, setAway] = useState(false);
  const [shown, setShown] = useState(false);
  const reached = time >= TL.YOUR_TURN;
  useEffect(() => { if (playing && !reached) {
    setAway(false);
    setShown(false);
  } }, [playing, reached]);
  return { reached, open: reached && !away, shown: reached && !away && shown,
    toggle: () => setShown((s) => !s), close: () => setAway(true), reopen: () => setAway(false) };
}
// kMono: monospace text style
const kMono = (size, color, weight) => ({ fontFamily: MONO, fontSize: size, color, fontWeight: weight || 400 });
// KValue: a value forming in the focus area, from which its landing path starts (R5)
const KValue = ({ k, text }) => React.createElement("span", { "data-landing-from": k, style: { fontFamily: MONO, fontSize: VALUE_FS, fontWeight: 600, color: AMBER, marginLeft: 14, whiteSpace: 'nowrap' } }, '= ' + text);
// KNav: ◀ ▶ one line at a time, the line counter, the Your-turn button and the note
function KNav({ cur, total, goBeat, yt, note, width }) {
  return (React.createElement("div", { style: { width, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 } },
    React.createElement("div", { style: { display: 'flex', gap: 8, alignItems: 'center' } },
      React.createElement("button", { type: "button", onClick: () => goBeat(Math.max(0, cur - 1)), style: Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' }), "aria-label": "previous line" }, '◀'),
      React.createElement("button", { type: "button", onClick: () => goBeat(Math.min(total - 1, cur + 1)), style: Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' }), "aria-label": "next line" }, '▶'),
      React.createElement("span", { "data-step": "1", style: { fontFamily: MONO, fontSize: FS_MIN, color: MUTE } }, 'line ' + (cur + 1) + ' of ' + total),
      yt.reached && !yt.open
        ? React.createElement("button", { type: "button", onClick: yt.reopen, style: Object.assign(btnStyle(true, ACCENT), { marginLeft: 'auto' }) }, "Your turn") : null),
    React.createElement("div", { "data-note": "1", style: { fontFamily: HEAD, fontSize: 13.5, color: INK, textWrap: 'pretty', lineHeight: 1.35 } },
      note)));
}

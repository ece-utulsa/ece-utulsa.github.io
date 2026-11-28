/* ═══ CONTENTS ═══
   1. CONSTANTS   2. STATE   3. PHYSICS   4. FORMATTING   5. SCENE AND WAVEFORMS   6. CHECKLIST, LAB CALLOUT, READOUTS
   7. BREAKER     8. CONTROLS   9. LECTURE (slides, views, demos, readout line, cues)   9c. NARRATION (line states, player, Lab and Experiment Listen)
   10. PHASOR VIEW   11. SLIDE 1: PLANT DAY   12. WORKSHEET   13. LOOP */
'use strict';
/* ═══ 1. CONSTANTS ═══ */
const POLES = 4;                          // poles of the incoming machine
const F_BUS = 60.00;                      // Hz, running system (infinite bus)
const V_LL = 13.8;                        // kV line, bus and machine rating
const V_PH = V_LL / Math.sqrt(3);         // kV per phase, 7.967
const IF_RATED = 5.00;                    // A, field current for 13.80 kV at 60.00 Hz (open circuit, no saturation)
const S_RATED = 25;                       // MVA machine rating
const X_S = V_LL * V_LL / S_RATED;        // Ω, 1.0 pu synchronous reactance = 7.6176 Ω
const I_RATED = S_RATED * 1e3 / (Math.sqrt(3) * V_LL);   // A, 1045.9
const DROOP = 0.04;                       // governor speed droop (4 %)
const S_P = S_RATED / (DROOP * F_BUS);    // MW/Hz, 10.42
const TOL_V = 0.05, TOL_TH = 10, SLIP_MAX = 0.20;   // condition tolerances: voltage fraction, degrees, Hz
const FAST_SLIP = 0.5;                    // Hz, above this the blinking is "fast"
const SEE_HZ = 3;                         // Hz of on-screen blinking above which it is too fast to see
const SMOOTH_PU = 0.20, TRIP_PU = 0.60;   // surge (× rated) limits for a smooth close and for a trip
const SLIP_PULL = 0.5;                    // Hz, beyond this the machine cannot pull into step: trip (lecture value)
const LOW_V = 0.2;                        // V_g below this fraction of V_bus: "no voltage yet"
const LAMP_EMBER = 0.05;                  // between this and LAMP_OFF (fractions of 2V) a lamp shows a dim red ember: not lit, not dark
const LAMP_OFF = 0.20;                    // lamp off below this fraction of 2V; above it brightness ((x − 0.2)/0.8)², continuous from 0
const WAVE_SLOW = 0.01;                   // waveform slow-motion view: 60 Hz shown at 1/100 speed (0.6 cycles per second on screen)
const DT_MAX = 0.1;                       // s, largest frame step
const RO_MS = 250;                        // ms between numeric updates (4 per second)
const CLOSE_MS = 1000;                    // ms the breaker stays shut before a bad close trips
const F_RUN = 60.30;                      // Hz after "Run up to speed" (about 1809 r/min, field off)
const F_MIN = 59.00, F_MAX = 61.00;       // Hz, governor range once running
const V_EXCITE = 12.80;                   // kV after "Excite field"
const RUN_RATE = 24;                      // Hz/s, displayed run-up rate (about 2.5 s to speed; faster than a real machine)
const IF_RATE = 3;                        // A/s, displayed field build-up rate (about 1.5 s; faster than a real machine)
const HOLD_DELAY = 400, HOLD_EVERY = 110; // ms, press-and-hold repeat
const SURGE_FULL = 2.5;                   // × rated at the right end of the surge meter
const DEG = 180 / Math.PI, TWO_PI = 2 * Math.PI, PH120 = TWO_PI / 3;
const MINUS = '−', FIG = ' ';   // typographic minus; figure space (width of a digit)
const SVGNS = 'http://www.w3.org/2000/svg';
const ROT_DISP = 0.25;                    // rev/s on screen for the rotating phasors (60 Hz shown slowed)
const MOTOR_DISP = 0.4;                   // rev/s on screen for the test motor icon
const NSL = 8;                            // lecture slides
const SAY = __SAY__;                      // narration text: {slides: [[line, …] × 8], lab: [3], exp: [6]}
const CLIPS = __CLIPS__;                  // the same shape; one mp3 data URI per line (en-GB-SoniaNeural, −4 %)
const WPM = 153;                          // reading pace used to time a line when the voice is off, words/min
const ANIM_FROM = 0.10, ANIM_SPAN = 0.70; // an animated line (the day on slide 1) moves between 10 % and 80 % of its clip
const WORKED = { fg: 60.12, vg: 13.62, seq: 'ABC', th0: 6, pause: true };   // slide 7: the meter readings of the worked case (time frozen)
const DEMO_GAP_MS = 400;                  // ms after a slide or line change before a line's Show-me demo starts
/* Slide 1 plant (schematic, slide spec section E) */
const LOAD_MW = [60, 45, 38, 35, 40, 70, 130, 200, 255, 230, 170, 120, 105, 120, 160, 215, 260, 290, 295, 260, 200, 140, 95, 70];   // MW at hours 0…23, linear in between, wraps at 24 h
const UNIT_MW = 60;                       // MW, capacity of each unit
const N_UNITS = 5;                        // units G1…G5
const LOOK_H = 0.6;                       // h, look-ahead: a unit is prepared (synchronizing or unloading) this long before its switching event
const DAY_S = 20;                         // s on screen for one 24 h day
const DAY_START = 2;                      // h, time of day when slide 1 opens
const DAY_ZOOM = 5.5;                     // h, time of day shown while slide 2 zooms in: G3 is being synchronized on the morning ramp
const DAY_STEP = 0.25;                    // h, the day clock's − / + buttons
const EPS = 1e-9;                         // comparison slack for hours and MW
const SHEET_KEY = 'paralleling-lab-worksheet-v1';   // the only localStorage key this tool reads or writes
const SHEET_MAX = 4000;                   // longest stored answer (characters)

/* ═══ 2. STATE ═══ */
const START = { fg: 0, iF: 0, seq: 'ABC', th0: 0 };   // Reset in the Lab and slide 7: machine at rest, field off
const S = { fg: 0, iF: 0, seq: 'ABC', th: 0, fgT: null, iFT: null, closed: false, closing: false, joined: false, paused: false, waveSlow: false, tw: 0, cross: false, showPh: false,
            mode: 'lec', slide: 1, line: 0, cue: [], turn: false, slideT: 0, resT: 0, surgeKind: null, busy: false, demoId: 0, vis: new Set(), result: null, res: null, lastClose: null, tag: null, surgePu: 0, dayH: DAY_START, dayRun: false };

/* ═══ 3. PHYSICS ═══ */
/* Shaft speed (r/min) from generator frequency: n = 120 f / P. */
function nMech() { return S.fg * 120 / POLES; }
/* Generator line voltage (kV): proportional to field current and speed (open circuit, no saturation). */
function vGenLL() { return V_LL * (S.iF / IF_RATED) * (S.fg / F_BUS); }
/* Field current (A) that gives line voltage v (kV) at frequency f (Hz; default the present speed). */
function iFor(v, f) { f = f === undefined ? S.fg : f; return f > 1 ? v / V_LL * IF_RATED * F_BUS / f : S.iF; }
/* Wrap an angle (rad) into (−π, π]. */
function wrap(a) { a = (a + Math.PI) % TWO_PI; if (a < 0) a += TWO_PI; return a - Math.PI; }
/* Lamp voltages (kV per phase) at phase difference th, as wired (straight or cross-connected), as phasors.
   Bus phase k at −k·120°; generator phase k at th − k·120° (ABC) or th + k·120° (ACB, two leads swapped). */
function lampKV(th) { return poleKV(th, S.cross ? [0, 2, 1] : [0, 1, 2]); }
/* Voltage across each breaker pole k (kV per phase): |V_bus,k − V_gen,gi[k]|; straight poles gi = [0, 1, 2]. Cross-connected
   lamps sit across bus B – generator C* and bus C – generator B*. Surge and the √3 V check always use the straight poles. */
function poleKV(th, gi) {
  gi = gi || [0, 1, 2];
  const vg = vGenLL() / Math.sqrt(3), sg = S.seq === 'ABC' ? -1 : 1;
  return [0, 1, 2].map(k => {
    const ab = -k * PH120, ag = th + sg * gi[k] * PH120;
    return Math.hypot(V_PH * Math.cos(ab) - vg * Math.cos(ag), V_PH * Math.sin(ab) - vg * Math.sin(ag));
  });
}
/* Lamp brightness 0…1 from its voltage: off below 20 % of 2V, then ((x − 0.2)/0.8)² with x = V_lamp/2V (incandescent-like). */
function bright(v) { const x = v / (2 * V_PH); return x <= LAMP_OFF ? 0 : Math.min(1, ((x - LAMP_OFF) / (1 - LAMP_OFF)) ** 2); }
/* Move the speed and the field toward their targets (Run up, Stop, Excite) over dt seconds, so the meters climb. */
function ramp(dt) {
  if (S.fgT !== null) { const d = S.fgT - S.fg, st = RUN_RATE * dt; if (Math.abs(d) <= st) { S.fg = S.fgT; S.fgT = null; changed(); } else S.fg += Math.sign(d) * st; }
  if (S.iFT !== null) { const d = S.iFT - S.iF, st = IF_RATE * dt; if (Math.abs(d) <= st) { S.iF = S.iFT; S.iFT = null; changed(); } else S.iF += Math.sign(d) * st; }
}

/* ═══ 4. FORMATTING (fixed width: figure spaces pad, so digits never shift) ═══ */
/* Unsigned number, d decimals, padded to w characters. */
function fx(x, d, w) { return Math.abs(x).toFixed(d).padStart(w, FIG); }
/* Signed number with +, − or a figure space next to the digits, d decimals, padded to w + 1 characters. */
function sx(x, d, w) { const a = Math.abs(x).toFixed(d), z = +a === 0; return ((z ? FIG : x < 0 ? MINUS : '+') + a).padStart(w + 1, FIG); }
/* Signed power (MW or MVAR) with + or −, 1 decimal, no padding. */
function sg1(x) { return (x < 0 ? MINUS : '+') + Math.abs(x).toFixed(1); }
/* Time of day h (hours) as HH:MM. */
function hhmm(h) { const m = Math.round(h * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
/* Set an element's text only when it changes. */
function put(id, t) { const e = document.getElementById(id); if (e.textContent !== t) e.textContent = t; }
/* Write text into el, showing "x_ab" as x with subscript ab (text nodes and <sub> only, no markup parsed). */
function richText(el, txt) {
  while (el.firstChild) el.removeChild(el.firstChild);
  for (const part of String(txt).split(/(_[A-Za-z]+)/)) {
    if (part.startsWith('_')) { const sb = document.createElement('sub'); sb.textContent = part.slice(1); el.appendChild(sb); }
    else if (part) el.appendChild(document.createTextNode(part));
  }
}
/* richText, skipped when the text has not changed. */
function putRich(el, txt) { if (el.dataset.raw !== txt) { richText(el, txt); el.dataset.raw = txt; } }

/* ═══ 5. SCENE AND WAVEFORMS ═══ */
const ph = document.getElementById('phases'), PH_Y = [120, 220, 320], LAMP = [];
const LAMP_UP = 60, LAMP_R = 30;          // lamp centre above its phase line and lamp radius (viewBox units)
const BLADE_OPEN = 'L438 ';               // open blade tip x; the tip sits BLADE_RISE above the line, clear of the lamp
const BLADE_RISE = 24;
const RING_GAP = 5;                       // cue ring radius beyond the shape it marks (viewBox units)
/* Create an SVG element in parent. */
function mk(parent, tag, a, txt) { const e = document.createElementNS(SVGNS, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt !== undefined) e.textContent = txt; parent.appendChild(e); return e; }
/* Build the three phase lines, breaker contacts and lamps once. */
function buildScene() {
  ['A', 'B', 'C'].forEach((p, k) => {
    const y = PH_Y[k];
    mk(ph, 'path', { d: `M80 ${y}H330`, stroke: '#d32f2f', 'stroke-width': 4 });
    mk(ph, 'text', { x: 92, y: y - 10, 'font-size': 17, 'font-weight': 700, fill: '#d32f2f' }, p);
    mk(ph, 'circle', { cx: 330, cy: y, r: 6, fill: '#1a2328' }); mk(ph, 'circle', { cx: 450, cy: y, r: 6, fill: '#1a2328' });
    const blade = mk(ph, 'path', { class: 'blade', d: `M330 ${y}${BLADE_OPEN}${y - BLADE_RISE}`, stroke: '#1a2328', 'stroke-width': 5, 'stroke-linecap': 'round' });
    mk(ph, 'path', { d: `M450 ${y}H590L650 ${220 + (y - 220) * 0.55}`, stroke: '#1c5fd6', 'stroke-width': 4, fill: 'none' });   // to the generator terminals
    mk(ph, 'text', { x: 556, y: y - 10, 'font-size': 17, 'font-weight': 700, fill: '#1c5fd6' }, p + '*');
    const ly = y - LAMP_UP;   // lamp centre
    mk(ph, 'path', { d: `M330 ${y}V${ly}H360M420 ${ly}H450V${y}`, stroke: '#55636b', 'stroke-width': 2, fill: 'none' });   // lamp across the pole
    const glow = mk(ph, 'circle', { cx: 390, cy: ly, r: 46, fill: '#f2a900', 'fill-opacity': 0 });
    const body = mk(ph, 'circle', { cx: 390, cy: ly, r: LAMP_R, fill: '#7d868b', stroke: '#1a2328', 'stroke-width': 3 });   // unlit lamp: grey
    mk(ph, 'circle', { class: 'ring', cx: 390, cy: ly, r: LAMP_R + RING_GAP });
    const core = mk(ph, 'circle', { cx: 390, cy: ly, r: LAMP_R - 3, fill: '#ffc400', 'fill-opacity': 0 });
    mk(ph, 'path', { d: `M370 ${ly - 20}l40 40M410 ${ly - 20}l-40 40`, stroke: '#1a2328', 'stroke-width': 2.5 });
    const name = mk(ph, 'text', { x: 322, y: ly + 6, 'text-anchor': 'end', 'font-size': 16, 'font-weight': 800 }, 'Lamp ' + p);
    const lbl = mk(ph, 'text', { x: 460, y: ly + 6, 'font-size': 15, 'font-family': 'Consolas, monospace', 'font-weight': 700 }, '0.00 kV');
    LAMP.push({ glow, core, lbl, blade, y, name, body });
  });
  mk(ph, 'text', { x: 372, y: 18, 'font-size': 15, 'font-weight': 700 }, 'BREAKER + LAMPS');
}
/* Draw lamps (instantaneous, never averaged), breaker blades and the synchroscope pointer. */
function drawScene(lamps) {
  LAMP.forEach((L, k) => {
    const b = S.closed ? 0 : bright(lamps[k]);
    const x = S.closed ? 0 : lamps[k] / (2 * V_PH), ember = b === 0 && x >= LAMP_EMBER;
    L.glow.setAttribute('fill-opacity', (0.7 * b).toFixed(3));
    L.core.setAttribute('fill', ember ? '#a3381c' : '#ffc400');
    L.core.setAttribute('fill-opacity', ember ? (0.35 + 1.5 * (x - LAMP_EMBER)).toFixed(3) : b.toFixed(3));
    L.blade.setAttribute('d', S.closed ? `M330 ${L.y}L450 ${L.y}` : `M330 ${L.y}${BLADE_OPEN}${L.y - BLADE_RISE}`);
  });
  // ACB: underline the label of the darkest lamp so the moving dark spot is easy to follow
  const kMin = lamps.indexOf(Math.min(...lamps)), nm = S.cross ? ['Lamp A', 'Lamp B (B–C*)', 'Lamp C (C–B*)'] : ['Lamp A', 'Lamp B', 'Lamp C'];
  LAMP.forEach((L, k) => { if (L.name.textContent !== nm[k]) L.name.textContent = nm[k]; });
  LAMP.forEach((L, k) => { const u = !S.closed && (S.seq === 'ACB' || S.cross) && k === kMin ? 'underline' : 'none'; if (L.name.getAttribute('text-decoration') !== u) L.name.setAttribute('text-decoration', u); });
  const d = S.closed ? 0 : wrap(S.th) * DEG;
  document.getElementById('ptr').setAttribute('transform', `rotate(${d.toFixed(2)} 110 112)`);
}
/* Breaker tag drawn on the scene: TRIPPED (red), IN STEP (green), JOINED — JOLT or MOTORING (amber), CLOSING…, or none. */
function drawTag() {
  const g = document.getElementById('tag'); while (g.firstChild) g.removeChild(g.firstChild);
  const T = { trip: ['TRIPPED', '#c2412f'], instep: ['IN STEP', '#18744a'], jolt: ['JOINED — JOLT', '#8a5700'], motor: ['JOINED — MOTORING', '#8a5700'], closing: ['CLOSING…', '#1a2328'] }[S.tag];
  if (!T) return;
  mk(g, 'rect', { x: 270, y: 336, width: 240, height: 34, rx: 17, fill: T[1] });
  mk(g, 'text', { x: 390, y: 359, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: '#ffffff' }, T[0]);
}
const WG = document.getElementById('waveG'), W = {};
/* Build the waveform panel once: bus and generator phase-A voltage over three bus cycles. */
function buildWave() {
  mk(WG, 'path', { d: 'M60 30V150M60 90H880', stroke: '#55636b', 'stroke-width': 1.5, fill: 'none' });
  mk(WG, 'text', { x: 52, y: 40, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, '+11.27');
  mk(WG, 'text', { x: 52, y: 94, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, '0 kV');
  mk(WG, 'text', { x: 52, y: 150, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, MINUS + '11.27');
  W.base = mk(WG, 'text', { x: 880, y: 170, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, '');
  W.bus = mk(WG, 'polyline', { points: '', fill: 'none', stroke: '#d32f2f', 'stroke-width': 3 });
  W.gen = mk(WG, 'polyline', { points: '', fill: 'none', stroke: '#1c5fd6', 'stroke-width': 3, 'stroke-dasharray': '10 5' });
  mk(WG, 'text', { x: 64, y: 18, 'font-size': 15, 'font-weight': 800, fill: '#d32f2f' }, 'bus, phase A (solid)');
  mk(WG, 'text', { x: 250, y: 18, 'font-size': 15, 'font-weight': 800, fill: '#1c5fd6' }, 'generator, phase A (dashed)');
}
/* Draw the waves for the present state: v_bus = √2 V sin ωt and v_g = √2 V_g sin(ωt + Δθ) over three bus cycles,
   the bus wave held still (stroboscopic), so v_g slides by Δθ. */
function drawWave() {
  const vg = (S.closed ? V_LL : vGenLL()) / Math.sqrt(3), th = S.closed ? 0 : S.th, pk = Math.SQRT2 * V_PH, N = 240;
  const Y1 = v => 90 - v / pk * 56, b = [], g = [];
  const ph0 = S.waveSlow ? TWO_PI * F_BUS * S.tw : 0;   // slow view: both waves travel, the generator keeps the true Δθ ahead
  for (let i = 0; i <= N; i++) { const a = 3 * TWO_PI * i / N - ph0, x = (60 + 820 * i / N).toFixed(1); b.push(x + ',' + Y1(pk * Math.sin(a)).toFixed(1)); g.push(x + ',' + Y1(Math.SQRT2 * vg * Math.sin(a + th)).toFixed(1)); }
  const bt = S.waveSlow ? 'three bus cycles (50 ms) at 1/100 speed: 1 s on screen = 10 ms' : 'three bus cycles (50 ms), time base locked to the bus wave';
  if (W.base.textContent !== bt) W.base.textContent = bt;
  W.bus.setAttribute('points', b.join(' ')); W.gen.setAttribute('points', g.join(' '));
}

/* ═══ 6. CHECKLIST, LAB CALLOUT, READOUTS ═══ */
/* The four paralleling conditions for the present state. */
function conditions() {
  const vg = vGenLL(), slip = S.fg - F_BUS, dth = wrap(S.th) * DEG;
  return { v: Math.abs(vg - V_LL) / V_LL <= TOL_V, s: S.seq === 'ABC', t: Math.abs(dth) <= TOL_TH + EPS, f: slip > EPS && slip <= SLIP_MAX + EPS, vg, slip, dth };
}
/* The time factor in force: 0 paused, else 1 (lamps and synchroscope always run in real time). */
function tFactor() { return S.paused ? 0 : 1; }
/* True on Lecture slide 1, where the main area shows the plant day and not G3's breaker. */
function onDay() { return S.mode === 'lec' && S.slide === 1; }
/* Lab only: pick the one status line for what the student sees now: [text, kind]. The Lecture has no callout. */
function callout(c) {
  if (S.closing) return ['Breaker closing…', ''];
  if (S.result) return [S.result.callout, S.result.kind];
  if (S.fgT !== null) return [S.fgT > 0 ? 'Running up to speed…' : 'Coasting to rest…', ''];
  if (S.fg < 1) return ['Machine at rest: press Run up.', ''];
  if (S.iFT !== null) return ['Field building up…', ''];
  if (c.vg < LOW_V * V_LL) return ['Generator voltage near zero: press Excite.', ''];
  if (!c.s) return ['Lamps take turns: phase sequence is wrong — swap two leads.', 'bad'];
  if (Math.abs(c.slip) * (tFactor() || 1) > SEE_HZ) return ['Blinking too fast to see — bring f_g closer to f_bus.', ''];
  if (Math.abs(c.slip) > FAST_SLIP) return ['Fast blinking = big frequency difference. Bring f_g closer to f_bus.', ''];
  if (!c.v) return ['Voltages unequal: adjust the field current.', ''];
  if (c.slip < -EPS) return ['Generator slow: it would come on as a motor.', ''];
  return ['Lamps together: sequence is right.', 'good'];
}
let lastTxt = -1e9;
/* Update checklist, Lab callout, meters, sidebar readouts and the live equations: at most 4 times a second (or at once when forced). */
function readouts(force) {
  const now = performance.now(); if (!force && now - lastTxt < RO_MS) return; lastTxt = now;
  const c = conditions(), on = S.closed && S.joined, fgShow = on ? F_BUS : S.fg, vgShow = on ? V_LL : c.vg;
  const set = (id, ok, val) => { const li = document.getElementById(id); li.classList.toggle('ok', ok); li.classList.toggle('no', !ok); li.querySelector('.mark').textContent = ok ? '✓' : '✗'; put(id + 'v', val); };
  set('c1', c.v, fx(c.vg, 2, 5) + '/13.80 kV'); set('c2', c.s, S.seq);
  set('c3', c.t, 'Δθ = ' + sx(c.dth, 1, 5) + '°'); set('c4', c.f, sx(c.slip, 2, 5) + ' Hz');
  const ready = c.v && c.s && c.t && c.f && !S.closed;
  document.getElementById('ready').classList.toggle('on', ready);
  put('readyTxt', S.closed ? 'Closed' : ready ? 'Ready' : 'Not ready');
  if (S.mode === 'lab') { const [txt, kind] = callout(c), co = document.getElementById('callout'); putRich(co, txt); if (co.className !== kind) co.className = kind; }
  put('mVg', fx(vgShow, 2, 5) + ' kV'); put('mFg', fx(fgShow, 2, 5) + ' Hz');
  put('fgO', fx(S.fg, 2, 5) + ' Hz'); put('nO', fx(nMech(), 0, 4) + ' r/min');
  put('vgO', fx(c.vg, 2, 5) + ' kV'); put('ifO', fx(S.iF, 3, 5) + ' A');
  put('seqO', S.seq); put('lampO', S.cross ? 'cross' : 'straight');
  put('govR', fx(S.fg, 2, 5) + ' Hz · ' + fx(nMech(), 0, 4) + ' r/min'); put('fieldR', fx(c.vg, 2, 5) + ' kV'); put('fieldR2', fx(S.iF, 2, 4) + ' A');
  put('leadsR', S.seq === 'ABC' ? 'ABC (as the bus)' : 'ACB (b and c swapped)'); put('lampsR', S.cross ? 'cross-connected' : 'straight across each pole');
  put('q_fg', fx(S.fg, 2, 5)); put('q_slip', sx(c.slip, 2, 5)); put('q_dth', sx(c.dth, 1, 5)); put('q_th2', sx(c.dth, 1, 5));
  put('q_vl', fx(2 * V_PH * Math.abs(Math.sin(c.dth / 2 / DEG)), 2, 5)); put('q_blink', fx(c.slip, 2, 5));
  // time to the next dark moment of lamp A: Δθ reaches 0 (mod 360°) moving at the slip
  const th = wrap(S.th), ss = c.slip, tNext = S.closed ? null : Math.abs(ss) < 0.005 ? null : ss > 0 ? (((-th) % TWO_PI) + TWO_PI) % TWO_PI / (TWO_PI * ss) : ((th % TWO_PI) + TWO_PI) % TWO_PI / (TWO_PI * -ss);
  put('nextDark', S.closed ? 'Breaker closed.' : S.fg < 1 ? 'Machine at rest.' : tNext === null ? 'No slip: the lamps hold their brightness.' : (S.seq === 'ACB' ? 'Lamp A: ' : 'Lamps: ') + 'next dark in ' + fx(tNext, 1, 4) + ' s (one every ' + (1 / Math.abs(ss)).toFixed(1) + ' s).');
  put('lampNote', c.v ? 'Equal magnitudes (V = 7.97 kV per phase): both forms agree.' : 'Unequal magnitudes: 2V sin(Δθ/2) does not apply (greyed).');
  document.getElementById('eqSimple').classList.toggle('dim', !c.v);
  const lamps = lampKV(S.th);
  put('q_vgen', fx(S.closed ? 0 : lamps[0], 2, 5));
  LAMP.forEach((L, k) => { const t = fx(S.closed ? 0 : lamps[k], 2, 5) + ' kV'; if (L.lbl.textContent !== t) L.lbl.textContent = t; });
  // Experiment 6 (your turn): the five steps tick live, in the Lab panel and on the Experiments card; the summary appears after a clean close
  const clean = S.joined && S.tag === 'instep';
  const met = [S.fg >= F_MIN - EPS && S.fgT === null, c.v, c.s && S.fg >= 1, c.f, clean];
  document.querySelectorAll('[data-step]').forEach(li => { const ok = met[+li.dataset.step - 1] || clean; li.classList.toggle('ok', ok); const m = li.querySelector('.mark'), t = ok ? '✓' : '○'; if (m.textContent !== t) m.textContent = t; });
  const sum = document.querySelector('#itTurn .turnSum'); sum.hidden = !clean;
  if (clean) putRich(sum, 'Clean close. P = 10.4 × (' + S.fg.toFixed(2) + ' − 60.00) = ' + sg1(S_P * (S.fg - F_BUS)) + ' MW; raise the governor for more.');
  // readout line under the main area: slides 2-7
  const rlOn = S.mode === 'lec' && S.slide >= 2 && S.slide <= 7;
  document.getElementById('itRl').classList.toggle('on', rlOn); if (rlOn) putRich(document.getElementById('rl'), readoutLine(c));
  put('phTxt', 'Bus a → b → c, generator ' + (S.seq === 'ABC' ? 'a → b → c: same order; the gap vectors (lamp voltages) shrink together.' : 'a → c → b: reversed; the gap vectors never shrink together.') + ' Shown at 1/240 speed.');
  const sl = S.closed ? 0 : c.slip;
  updateCues();
  putRich(document.getElementById('waveTxt'), 'slip f_g − f_bus = ' + sx(sl, 2, 5) + ' Hz; ' + (S.fg < 1 ? 'machine at rest.' : Math.abs(sl) >= 0.005 ? 'the waves drift one cycle every ' + (1 / Math.abs(sl)).toFixed(1) + ' s.' : (S.closed ? 'breaker closed: the two waves coincide.' : 'no drift.')) + (S.waveSlow ? ' Waves at 1/100 speed.' : ''));
}

/* ═══ 7. BREAKER ═══ */
/* Close the breaker: the blades shut for CLOSE_MS and the surge meter jumps; then a bad close trips (blades open,
   TRIPPED) and a good one stays shut (IN STEP, JOINED — JOLT or JOINED — MOTORING). */
function closeBreaker() {
  if (S.closed || S.closing || onDay() || S.fgT !== null || S.iFT !== null) return;
  const c = conditions(), dv = Math.max(...poleKV(S.th)), I = dv * 1e3 / X_S, pu = I / I_RATED;
  const pj = 3 * V_PH * (c.vg / Math.sqrt(3)) * Math.sin(wrap(S.th)) / X_S;    // MW, synchronizing power at the instant of closing
  const trip = !c.s || pu > TRIP_PU || Math.abs(c.slip) > SLIP_PULL;
  let kind, verdict, call;
  if (trip) {
    kind = 'bad'; verdict = 'Large surge — this would damage the machine and trip the breaker.';
    call = !c.s ? 'Wrong sequence: lamps take turns — closing is a short circuit.' : pu <= TRIP_PU ? 'Frequencies too far apart: it cannot pull into step — trip.' : 'Out of phase: surge and torque shock — damage and a trip.';
  } else if (pu <= SMOOTH_PU && c.v) { kind = 'good'; verdict = 'Smooth close: in step.'; call = c.slip > EPS ? 'In step: the generator joins smoothly and picks up a little power.' : c.slip < -EPS ? 'Joined, but slow: it is running as a motor.' : 'In step: joined at no load (equal frequencies).'; }
  else { kind = ''; verdict = 'Joined with a jolt.'; call = c.v ? 'Joined with a jolt: closed a little out of phase.' : 'Unequal voltages: lamps never fully dark — reactive current surge.'; }
  S.closing = true; S.closed = true; S.res = null; S.surgeKind = null; S.tag = 'closing'; S.surgePu = pu; drawTag(); drawSurge(); renderResult();
  setTimeout(() => {
    S.closing = false;
    if (trip) { S.closed = false; S.joined = false; S.tag = 'trip'; }
    else { S.joined = true; S.th = 0; S.tag = kind !== 'good' ? 'jolt' : c.slip < -EPS ? 'motor' : 'instep'; if (S.tag === 'motor') { kind = ''; verdict = 'Joined, but running as a motor.'; } }
    S.result = { kind, callout: call }; S.lastClose = { trip, dth: c.dth, pu, I, slip: c.slip, seq: S.seq, tag: S.tag };
    S.res = { trip, verdict, kind, dv, I, pu, pj }; S.resT = performance.now();
    S.surgeKind = trip ? 'TRIP' : S.tag === 'instep' ? 'smooth' : S.tag === 'motor' ? 'motoring' : c.v ? 'JOLT' : 'JOLT (voltages unequal)';
    drawTag(); drawSurge(); syncButtons(); renderResult(); readouts(true);
  }, CLOSE_MS);
  syncButtons(); readouts(true);
}
/* Surge meter: bar length ∝ surge in multiples of rated current (0 … 2.5). The bar and its label take the colour of the
   verdict, so a close with unequal voltages reads as a jolt (amber) even when the current is below 0.20 × rated. */
function drawSurge() {
  const w = Math.min(1, S.surgePu / SURGE_FULL) * 280, k = S.surgeKind;
  const col = !k ? '#1a2328' : k === 'TRIP' ? '#c2412f' : k === 'smooth' ? '#18744a' : '#8a5700';
  const bar = document.getElementById('surgeBar'), txt = document.getElementById('surgeTxt');
  bar.setAttribute('width', w.toFixed(1)); bar.setAttribute('fill', col); txt.setAttribute('fill', col);
  txt.textContent = S.surgePu > 0 ? (S.surgePu * I_RATED).toFixed(0) + ' A = ' + S.surgePu.toFixed(2) + ' × rated' + (k ? ': ' + k : '') : '';
}
/* Write the verdict of the last close: the surge with its numbers, then P and Q from the present governor and field
   settings (so raising the governor after a good close shows the machine picking up load). */
function renderResult() {
  const box = document.getElementById('result'), R = S.res; while (box.firstChild) box.removeChild(box.firstChild);
  const line = (cls, t) => { const p = document.createElement('p'); if (cls) p.className = cls; richText(p, t); box.appendChild(p); };
  if (!R) { line('note', S.closing ? 'Closing…' : S.closed ? 'Closed.' : 'Breaker open: G3 is not connected.'); return; }
  line('verdict ' + (R.kind === 'bad' ? 'bad' : R.kind === 'good' ? 'good' : 'mid'), R.verdict);
  line('', 'I ≈ |ΔV| / X_S = ' + R.dv.toFixed(2) + ' kV / ' + X_S.toFixed(2) + ' Ω = ' + R.I.toFixed(0) + ' A = ' + R.pu.toFixed(2) + ' × rated.');
  if (S.mode === 'lab') line('', 'Synchronizing power: 3 V_bus V_g sin Δθ / X_S = ' + (R.pj < 0 ? MINUS : '') + Math.abs(R.pj).toFixed(1) + ' MW.');
  if (R.trip || !S.joined) { line('', 'The breaker closed, then tripped open. Press Reset to try again.'); return; }
  const P = S_P * (S.fg - F_BUS), vg = vGenLL(), Q = 3 * V_PH * (vg / Math.sqrt(3) - V_PH) / X_S;
  line('', 'P = s_P (f_nl − f_sys) = 10.4 × (' + S.fg.toFixed(2) + ' − 60.00) = ' + sg1(P) + ' MW (' + (P > 1e-6 ? 'generating' : P < -1e-6 ? 'motoring — a reverse-power relay would trip it' : 'no load') + ').');
  if (Math.abs(vg - V_LL) / V_LL > TOL_V) line('', 'Q ≈ 3 V_bus (V_g − V_bus)/X_S = ' + sg1(Q) + ' MVAR (' + (Q < 0 ? 'absorbs' : 'supplies') + ').');
}
/* Open the breaker (a joined machine is disconnected; frequency follows the governor again). */
function openBreaker() { if (S.closing) return; S.closed = false; S.joined = false; clearResult(); }
/* Forget the last close verdict, tag and surge. */
function clearResult() {
  S.result = null; S.res = null; S.surgeKind = null; if (!S.closed) { S.tag = null; S.surgePu = 0; } drawTag(); drawSurge(); renderResult();
  syncButtons(); readouts(true);
}

/* ═══ 8. CONTROLS ═══ */
const fgS = document.getElementById('fgS'), vgS = document.getElementById('vgS'), dayS = document.getElementById('dayS');
/* A control changed: an open breaker's verdict is cleared so the verdict line follows the new state; a joined machine's P and Q are refreshed. */
function changed() { if (!S.closed && S.result) clearResult(); else if (S.joined) renderResult(); syncButtons(); readouts(true); }
/* Set the state (Reset, slide presets, demos and Experiment set-ups). o: { fg, iF | vg, seq, th0, pause }. Cancels any run-up in progress. */
function setup(o) {
  if (S.closing) return;
  S.closed = false; S.joined = false; S.fgT = null; S.iFT = null; S.fg = o.fg; S.seq = o.seq || 'ABC'; S.th = (o.th0 || 0) / DEG;
  S.iF = o.vg !== undefined ? iFor(o.vg) : o.iF || 0;
  S.paused = !!o.pause;
  clearResult();
}
/* True when the machine is at speed and not being run up or down. */
function running() { return S.fg >= 1 && S.fgT === null; }
/* Governor: change f_g by df (Hz), within 59.00–61.00 Hz once running. */
function gov(df) { if (!running() || S.closing) return; S.fg = Math.min(F_MAX, Math.max(F_MIN, Math.round((S.fg + df) * 100) / 100)); changed(); }
/* Field: change V_g by dv (kV) at the present speed. */
function field(dv) { if (!running() || S.iF === 0 || S.iFT !== null || S.closing) return; S.iF = Math.max(0, iFor(Math.max(0, Math.round((vGenLL() + dv) * 100) / 100))); changed(); }
/* Mirror the state on buttons and sliders. */
function syncButtons() {
  const run = running(), excited = S.iF > 0 && S.iFT === null, day = onDay(), busy = S.closing;
  const pr = (id, on) => document.getElementById(id).setAttribute('aria-pressed', String(on));
  const dis = (id, d) => { document.getElementById(id).disabled = d; };
  pr('phBtn', S.showPh); pr('xbtn', S.cross); pr('pauseBtn', S.paused); pr('waveSlowBtn', S.waveSlow);
  const still = S.mode === 'lec' && S.slide >= 7;   // slides 7 and 8: the scene is frozen or absent; no breaker controls
  put('pauseBtn', S.paused ? '▶ Run' : '❚❚ Pause'); put('dayRun', S.dayRun ? '❚❚ Pause the day' : '▶ Run a day');
  dis('fm2', !run || busy); dis('fp2', !run || busy); dis('vm2', !run || !excited || busy); dis('vp2', !run || !excited || busy);
  fgS.disabled = !run || busy; vgS.disabled = !run || !excited || busy;
  dis('runUp', S.closed || busy); dis('stopBtn', S.closed || busy); dis('excite', !run || S.closed || busy); dis('fieldOff', S.closed || busy);
  dis('swapBtn', S.closed || busy); dis('xbtn', busy);
  fgS.value = S.fg >= 1 ? S.fg : 60; vgS.value = Math.min(15.18, Math.max(12.42, vGenLL()));
  fgS.setAttribute('aria-valuetext', S.fg.toFixed(2) + ' hertz'); vgS.setAttribute('aria-valuetext', vGenLL().toFixed(2) + ' kilovolts');
  dis('closeBtn', S.closed || busy || day || still || S.fgT !== null || S.iFT !== null); dis('openBtn', !S.closed || busy || day || still); dis('resetBtn', busy || still); dis('pauseBtn', still);
  document.querySelectorAll('button[data-show]').forEach(b => { b.disabled = busy || S.busy; });
}
/* Run fn now, then repeat while the button is held (press and hold). Keyboard activation runs fn once. */
function holdButton(id, fn) {
  const b = document.getElementById(id); let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', e => { if (b.disabled || e.button !== 0) return; fn(); stop(); t1 = setTimeout(() => { t2 = setInterval(() => { if (b.disabled) stop(); else fn(); }, HOLD_EVERY); }, HOLD_DELAY); });
  ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach(ev => b.addEventListener(ev, stop));
  b.addEventListener('click', e => { if (e.detail === 0) fn(); });   // keyboard (Enter / Space)
}
holdButton('fm2', () => gov(-0.01)); holdButton('fp2', () => gov(0.01)); holdButton('vm2', () => field(-0.01)); holdButton('vp2', () => field(0.01));
holdButton('dm', () => setDay(S.dayH - DAY_STEP)); holdButton('dp', () => setDay(S.dayH + DAY_STEP));
fgS.addEventListener('input', () => { if (running()) { S.fg = +(+fgS.value).toFixed(2); changed(); } });
vgS.addEventListener('input', () => { if (running() && S.iF > 0 && S.iFT === null) { S.iF = iFor(+vgS.value); changed(); } });
dayS.addEventListener('input', () => setDay(+dayS.value));
document.getElementById('runUp').addEventListener('click', () => { if (S.closed || S.closing) return; S.iF = 0; S.iFT = null; S.fgT = F_RUN; changed(); });
document.getElementById('stopBtn').addEventListener('click', () => { if (S.closed || S.closing) return; S.iF = 0; S.iFT = null; S.fgT = 0; changed(); });
document.getElementById('excite').addEventListener('click', () => { if (running() && !S.closed && !S.closing) { S.iFT = iFor(V_EXCITE); changed(); } });
document.getElementById('fieldOff').addEventListener('click', () => { if (!S.closed && !S.closing) { S.iF = 0; S.iFT = null; changed(); } });
document.getElementById('swapBtn').addEventListener('click', () => { if (S.closing || S.closed) return; S.seq = S.seq === 'ABC' ? 'ACB' : 'ABC'; changed(); });
document.getElementById('xbtn').addEventListener('click', () => { if (S.closing) return; S.cross = !S.cross; changed(); });
document.getElementById('phBtn').addEventListener('click', () => { S.showPh = !S.showPh; applyView(); syncButtons(); });
document.getElementById('closeBtn').addEventListener('click', closeBreaker);
document.getElementById('openBtn').addEventListener('click', openBreaker);
document.getElementById('resetBtn').addEventListener('click', () => { if (S.mode === 'lec') goSlide(S.slide); else setup(START); });
document.getElementById('pauseBtn').addEventListener('click', () => { S.paused = !S.paused; syncButtons(); readouts(true); });
document.getElementById('waveSlowBtn').addEventListener('click', () => { S.waveSlow = !S.waveSlow; syncButtons(); readouts(true); });
document.getElementById('dayRun').addEventListener('click', () => { if (!S.dayRun && S.dayH >= 24 - EPS) S.dayH = 0; S.dayRun = !S.dayRun; if (S.dayRun) S.paused = false; syncButtons(); });
/* Show the Lecture, the Lab or the Experiments worksheet. */
function showPage(id) {
  const exp = id === 'exp';
  stopNarr(); S.mode = id === 'lec' ? 'lec' : 'lab';
  document.getElementById('app').hidden = exp; document.getElementById('page-exp').hidden = !exp;
  document.querySelectorAll('nav.tabs button[data-page]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.page === id)));
  if (S.mode === 'lec') goSlide(S.slide); else { S.demoId++; S.busy = false; S.dayRun = false; applyView(); renderResult(); syncButtons(); readouts(true); }
}
document.querySelectorAll('nav.tabs button[data-page]').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
/* Experiment set-ups: put the Lab in the stated state and show it. */
document.querySelectorAll('button.try').forEach(b => b.addEventListener('click', () => {
  let o; try { o = JSON.parse(b.dataset.try); } catch (e) { return; }
  S.cross = false; S.turn = !!o.turn; setup(o); showPage('lab');
}));
document.getElementById('turnOff').addEventListener('click', () => { S.turn = false; applyView(); });

/* ═══ 9. LECTURE (slides, views, demos) ═══ */
/* Each slide: the stage view, the sidebar groups shown in full, and the preset applied on entry and by Reset. */
const SL = {
  1: { view: 'v1', grp: ['day'], preset: START },
  2: { view: 'v2', grp: ['gov', 'field'], preset: START },
  3: { view: 'v3', grp: ['field'], preset: { fg: 60.1, vg: 0.85 * V_LL, seq: 'ABC', th0: -60 } },
  4: { view: 'v4', grp: ['leads', 'lamps'], preset: { fg: 60.2, vg: 13.8, seq: 'ACB', th0: 0 } },
  5: { view: 'v5', grp: [], preset: { fg: 60.02, vg: 13.8, seq: 'ABC', th0: 60 } },
  6: { view: 'v6', grp: ['gov'], preset: { fg: 60.1, vg: 13.8, seq: 'ABC', th0: 0 } },
  7: { view: 'v7', grp: [], preset: WORKED },   // worked case: the scene frozen at the readings, no controls
  8: { view: 'v8', grp: [], preset: START }      // key equations
};
/* Instruments on the stage for each view. */
const VIEW = { v1: ['day', 'dayro'], v2: ['scene', 'meters', 'rl'], v3: ['scene', 'meters', 'result', 'rl'], v4: ['scene', 'result', 'phasors', 'rl'], v5: ['scene', 'scope', 'result', 'rl'],
               v6: ['scene', 'scope', 'result', 'rl'], v7: ['scene', 'scope', 'meters', 'chk', 'rl'], v8: ['keys'], lab: ['scene', 'wave', 'scope', 'meters', 'chk', 'why', 'result'] };   // the Lab adds 'turn' during Experiment 6
const IT = { day: 'itDay', dayro: 'itDayRo', scene: 'itScene', wave: 'itWave', phasors: 'itPhasors', scope: 'itScope', meters: 'itMeters', chk: 'itChk', why: 'itWhy', result: 'itResult', rl: 'itRl', keys: 'itKeys', turn: 'itTurn' };
const LAB_GRP = ['gov', 'field', 'leads', 'lamps', 'view'];
const SLIDES = document.querySelectorAll('.sl');
/* Show the instruments and sidebar controls of the present slide (Lecture) or all of them (Lab). */
function applyView() {
  const lec = S.mode === 'lec', v = lec ? SL[S.slide].view : 'lab', items = new Set(VIEW[v]); if (!lec && S.showPh) { items.add('phasors'); items.delete('wave'); }   // Lab: phasors take the waveform panel's place
  if (!lec && S.turn) { items.add('turn'); items.delete('why'); }   // Experiment 6: its five steps take the place of the "Why" panel
  document.getElementById('stage').dataset.view = v; S.vis = items;
  for (const k in IT) document.getElementById(IT[k]).classList.toggle('on', items.has(k));
  const full = lec ? SL[S.slide].grp : LAB_GRP;
  document.querySelectorAll('.grp').forEach(g => { const k = g.dataset.g, open = full.includes(k), off = !open && (k === 'day' || k === 'view' || onDay());
    g.classList.toggle('open', open); g.classList.toggle('off', off); g.classList.toggle('min', !open && !off); });
  document.getElementById('app').classList.toggle('lab', !lec);
  document.getElementById('transport').hidden = !lec; document.getElementById('labListen').hidden = lec; document.getElementById('callout').hidden = lec;
  document.getElementById('cap').hidden = !lec && !listenBtn;
  put('sideH', onDay() ? 'Day clock' : 'G3 controls');
}
/* Enter slide n: show it, apply its preset, write its notes. Entering slide 2 zooms from the fleet to G3. */
function goSlide(n) {
  if (S.closing) return;
  const prev = S.slide; S.slide = Math.max(1, Math.min(NSL, n)); S.demoId++; S.busy = false;   // cancels a running demo
  SLIDES.forEach(e => e.classList.toggle('on', +e.dataset.n === S.slide));
  S.cross = false; S.dayRun = false; if (S.slide === 1) S.dayH = DAY_START;
  document.getElementById('itDay').classList.remove('zoom');   // a zoom still running is dropped, so nothing stays scaled
  S.slideT = performance.now(); S.cue = [];
  setup(SL[S.slide].preset); applyView();
  if (S.slide === 2 && prev !== 2 && !playing) zoomToG3();
  put('slPos', S.slide + '/' + NSL);
  fitCaption(); showLine(0, !playing);
  syncButtons(); readouts(true);
}
/* Slide 2 entry: show the fleet at the morning ramp (G3 synchronizing) and zoom into G3's breaker. Skipped when the reader asks for reduced motion. */
function zoomToG3() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.getElementById('itDay'); S.dayH = DAY_ZOOM; drawDay(true);
  el.classList.remove('zoom'); void el.getBoundingClientRect(); el.classList.add('zoom');
}
document.getElementById('itDay').addEventListener('animationend', e => { e.currentTarget.classList.remove('zoom'); readouts(true); });
document.getElementById('slPrev').addEventListener('click', () => { stopNarr(); goSlide(S.slide - 1); });
document.getElementById('slNext').addEventListener('click', () => { stopNarr(); goSlide(S.slide + 1); });
addEventListener('keydown', e => {
  if (S.mode !== 'lec' || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target; if (t && t.closest && t.closest('input, textarea, select')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); stopNarr(); goSlide(S.slide + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); stopNarr(); goSlide(S.slide - 1); }
});
/* Resolve when pred() is true (checked every 30 ms), or with false if the demo was cancelled or timed out. */
function waitUntil(pred, id, ms) {
  const t0 = performance.now();
  return new Promise(res => { const tick = () => { if (S.demoId !== id) return res(false); if (pred()) return res(true); if (performance.now() - t0 > ms) return res(false); setTimeout(tick, 30); }; tick(); });
}
/* Δθ in degrees now. */
function dDeg() { return wrap(S.th) * DEG; }
/* Each Show-me demo: [preset, closing instant, angle (deg) the close is made at]. The breaker closes on the first frame that reaches the
   instant; the angle is then set to the demo's stated value, so the demo closes exactly at 0°, 90° or 180° as its slide says (one frame
   of slip, at most 0.6° here, is not shown as a difference). The +1 Hz demo closes where it is (near phase). Presets as v1.1.0. */
const DEMO = {
  '3': [SL[3].preset, () => Math.abs(dDeg()) < 2, 0],
  '4': [{ fg: 60.1, vg: 13.8, seq: 'ACB', th0: -50 }, () => Math.abs(dDeg()) < 2, 0],
  '5a': [{ fg: 60.02, vg: 13.8, seq: 'ABC', th0: 85 }, () => dDeg() >= 90, 90],
  '5b': [{ fg: 60.02, vg: 13.8, seq: 'ABC', th0: 175 }, () => Math.abs(dDeg()) >= 179.5, 180],
  '6s': [{ fg: 59.95, vg: 13.8, seq: 'ABC', th0: 20 }, () => Math.abs(dDeg()) < 2, 0],
  '6f': [{ fg: 60.1, vg: 13.8, seq: 'ABC', th0: -40 }, () => Math.abs(dDeg()) < 2, 0],
  '6x': [{ fg: 61.0, vg: 13.8, seq: 'ABC', th0: -60 }, () => Math.abs(dDeg()) < 8, null]
};
/* Run a demo: apply its preset, wait for the closing instant, close; the verdict appears on the scene, the surge meter and the result panel. */
async function demo(key) {
  if (S.busy || S.closing) return;
  const D = DEMO[key]; S.cross = false; S.paused = false; setup(D[0]);
  const id = ++S.demoId; S.busy = true; syncButtons(); readouts(true);
  const ok = await waitUntil(D[1], id, 30000);
  if (S.demoId === id) { S.busy = false; if (ok) { if (D[2] !== null) S.th = D[2] / DEG; closeBreaker(); } syncButtons(); readouts(true); }
}
document.querySelectorAll('button[data-show]').forEach(b => b.addEventListener('click', () => { stopNarr(); demo(b.dataset.show); }));
/* The readout line for the slide on screen: the slide's equation with the numbers now on screen substituted. */
function readoutLine(c) {
  const vb = V_PH, vgp = c.vg / Math.sqrt(3), poles = poleKV(S.th), f2 = x => x.toFixed(2);
  const sl = Math.abs(c.slip), every = sl >= 0.005 ? 'one dark moment every ' + (1 / sl).toFixed(1) + ' s' : 'no blinking';
  if (S.slide === 7) return 'readings (frozen): V_g ' + f2(c.vg) + ' kV · ' + S.seq + ' · Δθ ' + sx(c.dth, 1, 5) + '° · f_g ' + f2(S.fg) + ' Hz';
  if (S.slide === 2) return 'n_m = ' + nMech().toFixed(1) + ' r/min → f_g = (' + nMech().toFixed(1) + ')(4)/120 = ' + f2(S.fg) + ' Hz\nI_F = ' + S.iF.toFixed(2) + ' A → V_g = ' + f2(c.vg) + ' kV (bus 13.80 kV)';
  if (S.joined) return 'Breaker closed: G3 is on the bus.';
  switch (S.slide) {
    case 3: return 'darkest lamp = |V_bus − V_g| = ' + f2(vb) + ' − ' + f2(vgp) + ' = ' + f2(Math.abs(vb - vgp)) + ' kV per phase' + (c.v && Math.abs(vb - vgp) < 0.005 ? '' : ': never 0');
    case 4: return 'breaker poles now: A ' + f2(poles[0]) + ', B ' + f2(poles[1]) + ', C ' + f2(poles[2]) + ' kV · ' + (S.seq === 'ACB' ? 'ACB: never all zero together' : 'ABC: all three reach zero together');
    case 5: return 'Δθ = ' + sx(c.dth, 1, 5) + '°:  |ΔV| = 2(' + f2(vb) + ') sin(' + Math.abs(c.dth / 2).toFixed(1) + '°) = ' + f2(2 * vb * Math.abs(Math.sin(c.dth / 2 / DEG))) + ' kV';
    default: return '|f_g − f_bus| = |' + f2(S.fg) + ' − 60.00| = ' + f2(sl) + ' blinks/s: ' + every;
  }
}

/* ═══ 9b. CUES (Lecture only, set by the narration line on screen; the element itself is drawn crisp, no glow) ═══ */
/* The elements a cue key highlights (each gets the class "cue"). */
function cueTargets(key) {
  const el = id => document.getElementById(id);
  switch (key) {
    case 'chart': return [DAY.load, DAY.stair];
    case 'fleet': { const i = fleet(S.dayH).u.findIndex(u => u.s === 'sync' || u.s === 'unload'); return i < 0 ? DAY.units.map(U => U.body) : [DAY.units[i].body, DAY.units[i].blade]; }
    case 'bus': return [el('dBus')];
    case 'infbus': return [DAY.busLbl];
    case 'cond': return [document.querySelector('.sl[data-n="1"] .cond')];
    case 'fg': return [el('mFg'), el('nO')];
    case 'vg': return [el('mVg'), el('vgO')];
    case 'ctl': return [document.querySelector('.grp[data-g="gov"]'), document.querySelector('.grp[data-g="field"]')];
    case 'meters': return [el('itMeters')];
    case 'lamps': return LAMP.map(L => L.body);
    case 'darkest': { const v = lampKV(S.th), k = v.indexOf(Math.min(...v)); return [LAMP[k].body, LAMP[k].lbl, el('rl')]; }
    case 'poles': return [LAMP[1].lbl, LAMP[2].lbl];
    case 'rot': return [PHV.meterC, PHV.motorC];
    case 'surge': return [el('surgeSvg')];
    case 'result': return [el('result')];
    case 'scope': return [el('itScope')];
    case 'c12': return [el('c1'), el('c2')];
    case 'c34': return [el('c3'), el('c4')];
    case 'kL': return [el('kL')];
    case 'kR': return [el('kR')];
    case 'kP': return [el('kL'), el('kR'), el('kB'), el('kP')];
    default: return [el('itChk')];
  }
}
let cueOn = [];
/* Highlight the elements of the present line's cues (S.cue). */
function updateCues() {
  const on = S.mode === 'lec' && !document.getElementById('app').hidden && !document.getElementById('itDay').classList.contains('zoom');
  const els = on ? S.cue.flatMap(cueTargets).filter(Boolean) : [];
  cueOn.forEach(e => { if (!els.includes(e)) e.classList.remove('cue'); }); els.forEach(e => e.classList.add('cue')); cueOn = els;
}

/* ═══ 9c. NARRATION (each line sets its slide state; the player plays one clip per line, or times it as a caption with the voice off) ═══ */
let playing = false, voice = true, nRaf = 0, lineTok = 0, listenBtn = null, fitRaf = 0;
const player = new Audio();
const P3 = SL[3].preset, P4 = SL[4].preset, P5 = SL[5].preset;
const P6 = { fg: 60.2, vg: V_LL, seq: 'ABC', th0: 0 };                 // slide 6 line 1: 0.20 Hz slip, one dark moment every 5 s
const P6_END = { fg: 60.05, vg: V_LL, seq: 'ABC', th0: -40 };          // slide 6 line 5: slightly fast, the pointer turning slowly toward 12 o'clock
/* Put G3 in state o (cancels a waiting demo). */
function at(o) { S.demoId++; S.busy = false; S.cross = false; setup(o); }
/* Run a Show-me demo shortly after the line starts (skipped if the line has changed by then). */
function runDemo(key, anim) { const tok = lineTok; setTimeout(() => { if (tok === lineTok && S.mode === 'lec') demo(key); }, anim ? DEMO_GAP_MS : 0); }
/* Close at once at Δθ = 0 from preset o (a line shown out of order still shows the close it talks about). */
function closeAtZero(o) { at(Object.assign({}, o, { th0: 0, pause: false })); closeBreaker(); }
/* Each line: go(anim) sets the state at the start of the line (anim false: show the end state at once); tick(f) animates it (f 0 → 1). */
const LINES = [
  [ { cue: [], go() { S.dayRun = false; S.dayH = DAY_START; } },
    { cue: ['fleet'], go(a) { S.dayRun = false; S.dayH = a ? DAY_START : 8; }, tick(f) { S.dayH = DAY_START + (8 - DAY_START) * f; } },
    { cue: ['bus'], go(a) { S.dayRun = false; S.dayH = a ? 8 : 24; }, tick(f) { S.dayH = 8 + 16 * f; } },
    { cue: ['infbus'], go() { S.dayRun = false; S.dayH = 24; } },
    { cue: ['cond'], go() { S.dayRun = false; S.dayH = 24; } } ],
  [ { cue: [], go() { at(START); } },
    { cue: ['fg'], go(a) { at(START); if (a) S.fgT = F_BUS; else S.fg = F_BUS; changed(); } },
    { cue: ['vg'], go(a) { at({ fg: F_BUS, iF: 0 }); if (a) S.iFT = iFor(V_LL); else S.iF = iFor(V_LL); changed(); } },
    { cue: ['ctl'], go() { at({ fg: F_BUS, vg: V_LL }); } } ],
  [ { cue: ['lamps'], go() { at(P3); } },
    { cue: ['darkest'], go() { at(P3); } },
    { cue: ['surge'], go(a) { at(P3); runDemo('3', a); } },
    { cue: ['result'], go() { if (!S.res && !S.busy && !S.closing) closeAtZero(P3); } },
    { cue: ['lamps'], go(a) { at(P3); if (a) S.iFT = iFor(V_LL); else S.iF = iFor(V_LL); changed(); } } ],
  [ { cue: ['lamps'], go() { at(P4); } },
    { cue: ['lamps', 'rot'], go() { at(P4); } },
    { cue: ['poles'], go() { at(Object.assign({}, P4, { th0: 0, pause: true })); } },
    { cue: ['surge'], go(a) { at(P4); runDemo('4', a); } },
    { cue: ['lamps', 'rot'], go() { at(Object.assign({}, P4, { seq: 'ABC' })); } } ],
  [ { cue: ['scope'], go() { at(P5); } },
    { cue: ['surge', 'result'], go(a) { at(P5); runDemo('5a', a); } },
    { cue: ['surge', 'result'], go(a) { at(P5); runDemo('5b', a); } },
    { cue: ['scope', 'lamps'], go() { at(Object.assign({}, P5, { th0: 0, pause: true })); } } ],
  [ { cue: ['lamps'], go() { at(P6); } },
    { cue: ['result'], go(a) { at(P6); runDemo('6f', a); } },
    { cue: ['result'], go(a) { at(P6); runDemo('6s', a); } },
    { cue: ['surge', 'result'], go(a) { at(P6); runDemo('6x', a); } },
    { cue: ['scope'], go() { at(P6_END); } } ],
  [ 0, 1, 2, 3, 4 ].map(i => ({ cue: [['meters'], ['c12'], ['c34'], [], []][i], go() { at(WORKED); } })),
  [ { cue: ['kL'], go() {} }, { cue: ['kR'], go() {} }, { cue: ['kP'], go() {} } ]
];
/* Worked case (slide 7): the five rows, computed from the model at the readings. */
function workedRows() {
  const vg = WORKED.vg, vgp = vg / Math.sqrt(3), th = WORKED.th0 / DEG, dv = Math.hypot(V_PH - vgp * Math.cos(th), vgp * Math.sin(th)), I = dv * 1e3 / X_S, slip = WORKED.fg - F_BUS;
  const dvp = (vg - V_LL) / V_LL * 100, f2 = x => x.toFixed(2);
  return [['Readings', 'V_g = ' + f2(vg) + ' kV · sequence ' + WORKED.seq + ' · Δθ = +' + WORKED.th0.toFixed(1) + '° · f_g = ' + f2(WORKED.fg) + ' Hz'],
    ['1, 2', 'ΔV = (' + f2(vg) + ' − 13.80) / 13.80 = ' + (dvp < 0 ? MINUS : '+') + Math.abs(dvp).toFixed(1) + ' %: within ±5 % ✓ · sequence ' + WORKED.seq + ' = bus ABC ✓'],
    ['3, 4', 'Δθ = ' + WORKED.th0.toFixed(1) + '°: within 10° ✓ · slip = ' + f2(WORKED.fg) + ' − 60.00 = +' + f2(slip) + ' Hz: within 0 to 0.20 ✓ → ready'],
    ['Surge', '|ΔV| = |' + f2(V_PH) + '∠0° − ' + f2(vgp) + '∠' + WORKED.th0.toFixed(1) + '°| = ' + f2(dv) + ' kV per phase; I ≈ ' + f2(dv) + ' kV / ' + f2(X_S) + ' Ω = ' + I.toFixed(0) + ' A = ' + f2(I / I_RATED) + ' × rated: smooth'],
    ['After', 'P = s_P × slip = 10.4 × ' + f2(slip) + ' = ' + (S_P * slip).toFixed(1) + ' MW; raise the governor setting for more']];
}
/* Build the worked-case table once. */
function buildWorked() {
  const t = document.getElementById('wk');
  workedRows().forEach(([h, txt], i) => { const tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td'); tr.id = 'wk' + i; th.textContent = h; richText(td, txt); tr.append(th, td); t.appendChild(tr); });
}
/* Light row n of the worked case; rows after it wait (hidden, their space kept). */
function showWorked(n) { for (let i = 0; i < 5; i++) { const r = document.getElementById('wk' + i); r.classList.toggle('lit', i === n); r.classList.toggle('wait', i > n); } }
/* Show line i of the present slide: caption, counter, cues, and its state (anim: animate it, as when playing). */
function showLine(i, still) {
  const n = SAY.slides[S.slide - 1].length; S.line = Math.max(0, Math.min(n - 1, i)); lineTok++;
  const L = LINES[S.slide - 1][S.line];
  put('lineNo', 'line ' + (S.line + 1) + '/' + n); document.getElementById('bar').style.width = still ? '0%' : '0%';
  richText(document.getElementById('cap'), SAY.slides[S.slide - 1][S.line]);
  S.cue = L.cue.slice(); L.go(!still); if (still && L.tick) L.tick(1);
  if (S.slide === 7) showWorked(S.line);
  document.getElementById('kP').classList.toggle('ringed', S.slide === 8 && S.line === 2);
  syncButtons(); readouts(true);
}
/* Stop the narration (and any Lab or Experiment Listen) and reset the buttons. */
function stopNarr() {
  playing = false; cancelAnimationFrame(nRaf); player.onended = null; player.pause();
  put('play', '▶ Play narration');
  if (listenBtn) { listenBtn.textContent = listenBtn.dataset.listen; listenBtn = null; put('labNo', ''); if (S.mode === 'lab') document.getElementById('cap').hidden = true; }
}
/* Switch the voice on or off. */
function setVoice(on) { voice = on; put('voice', on ? 'voice on' : 'voice off'); document.getElementById('voice').setAttribute('aria-pressed', String(on)); }
/* Play one clip (or time its text when the voice is off); tick(t, dur) every frame, done() at the end. If the browser refuses to play,
   the voice is switched off, the "voice could not start" notices show, and the line continues as a timed caption. */
function playClip(clip, text, tick, done) {
  cancelAnimationFrame(nRaf); player.onended = null; player.pause();
  const finish = () => { cancelAnimationFrame(nRaf); player.onended = null; tick(1, 1); done(); };
  if (voice) {
    player.src = clip; player.onended = finish;
    player.play().catch(() => { if (!playing) return; setVoice(false); document.querySelectorAll('.voiceMsg').forEach(m => { m.hidden = false; }); playClip(clip, text, tick, done); });
    const loop = () => { if (player.duration) tick(player.currentTime, player.duration); nRaf = requestAnimationFrame(loop); };
    nRaf = requestAnimationFrame(loop);
  } else {
    const dur = text.split(/\s+/).length / WPM * 60, t0 = performance.now();      // s
    const loop = () => { const t = (performance.now() - t0) / 1000; if (t >= dur) { finish(); return; } tick(t, dur); nRaf = requestAnimationFrame(loop); };
    nRaf = requestAnimationFrame(loop);
  }
}
/* Play the present line, then the following lines and slides to the end of the lecture. */
function playLine() {
  playing = true; put('play', '❚❚ Pause narration');
  const L = LINES[S.slide - 1][S.line];
  playClip(CLIPS.slides[S.slide - 1][S.line], SAY.slides[S.slide - 1][S.line], (t, dur) => {
    document.getElementById('bar').style.width = Math.min(100, t / dur * 100) + '%';
    if (L.tick) L.tick(Math.min(1, Math.max(0, (t / dur - ANIM_FROM) / ANIM_SPAN)));
  }, () => {
    if (!playing) return;
    if (S.line < SAY.slides[S.slide - 1].length - 1) { showLine(S.line + 1, false); playLine(); }
    else if (S.slide < NSL) { goSlide(S.slide + 1); playLine(); }
    else stopNarr();
  });
}
/* Move to line i (or across a slide edge), keeping the narration playing if it was. */
function stepLine(d) {
  const was = playing; stopNarr();
  const n = SAY.slides[S.slide - 1].length, i = S.line + d;
  if (i < 0 && S.slide > 1) { goSlide(S.slide - 1); showLine(SAY.slides[S.slide - 1].length - 1, !was); }
  else if (i >= n && S.slide < NSL) goSlide(S.slide + 1);
  else showLine(i, !was);
  if (was) { if (i >= 0 && i < n) showLine(S.line, false); playLine(); }
}
/* Size the caption box for the longest line of this slide at the present width, so the layout never jumps between lines. */
function fitCaption() {
  const cap = document.getElementById('cap'), m = document.getElementById('capMeasure');
  m.style.width = cap.getBoundingClientRect().width + 'px';
  let h = 0; for (const t of SAY.slides[S.slide - 1]) { richText(m, t); h = Math.max(h, m.getBoundingClientRect().height); }
  cap.style.minHeight = Math.ceil(h) + 'px';
}
/* Play Lab or Experiment lines in order from a Listen button; say(i, n) is told the line spoken, or null at the end. A Lab control does not stop it. */
function listen(btn, clips, texts, say) {
  if (listenBtn === btn) { stopNarr(); say(null); return; }
  stopNarr(); playing = true; listenBtn = btn; btn.textContent = '❚❚ Stop';
  let i = 0;
  const next = () => { if (i >= texts.length) { stopNarr(); say(null); return; } say(i, texts.length); playClip(clips[i], texts[i++], () => {}, next); };
  next();
}
document.getElementById('play').addEventListener('click', () => { if (playing) stopNarr(); else { showLine(S.line, false); playLine(); } });
document.getElementById('prevL').addEventListener('click', () => stepLine(-1));
document.getElementById('nextL').addEventListener('click', () => stepLine(1));
document.getElementById('voice').addEventListener('click', () => { const was = playing && !listenBtn; stopNarr(); setVoice(!voice); document.querySelectorAll('.voiceMsg').forEach(m => { m.hidden = true; }); if (was) { showLine(S.line, false); playLine(); } });
document.getElementById('listenBtn').addEventListener('click', e => { const cap = document.getElementById('cap'); listen(e.currentTarget, CLIPS.lab, SAY.lab, (i, n) => {
  put('labNo', i === null ? '' : (i + 1) + '/' + n + (voice ? '' : ' (no voice)')); cap.hidden = i === null; if (i !== null) richText(cap, SAY.lab[i]); }); });
document.querySelectorAll('button.listen').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.exp; listen(b, [CLIPS.exp[n]], [SAY.exp[n]], () => {}); }));
/* Using a Lecture control pauses the narration (the transport and the tabs excepted). */
['pointerdown', 'keydown'].forEach(ev => document.getElementById('side').addEventListener(ev, e => {
  if (S.mode === 'lec' && playing && !listenBtn && e.target.closest && e.target.closest('.grp, #pin .btns')) stopNarr();
}, true));
addEventListener('resize', () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(() => { if (S.mode === 'lec') fitCaption(); }); });

/* ═══ 10. PHASOR VIEW, ROTATION METER, TEST MOTOR ═══ */
const phG = document.getElementById('phG'), PHV = {};
/* Build the phasor panel once: three dials (bus, generator, both with gap vectors), rotation meter, motor. */
function buildPhasors() {
  const dial = (cx, title) => { mk(phG, 'circle', { cx, cy: 134, r: 92, fill: '#f7f9fb', stroke: '#d6dde0' }); mk(phG, 'path', { d: `M${cx} 134H${cx + 100}`, stroke: '#55636b', 'stroke-dasharray': '4 4' }); mk(phG, 'text', { x: cx, y: 22, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, title); };
  dial(110, 'Bus a-b-c'); dial(330, 'Generator a-b-c'); dial(550, 'Both: lamp gap vectors');
  const arm = (col, w) => { const l = mk(phG, 'line', { x1: 0, y1: 0, x2: 0, y2: 0, stroke: col, 'stroke-width': w, 'stroke-linecap': 'round' }); const t = mk(phG, 'text', { 'font-size': 16, 'font-weight': 800, fill: col }, ''); return { l, t }; };
  PHV.bus = [0, 1, 2].map(() => arm('#d32f2f', 4)); PHV.gen = [0, 1, 2].map(() => arm('#1c5fd6', 4));
  PHV.bus2 = [0, 1, 2].map(() => arm('#d32f2f', 3)); PHV.gen2 = [0, 1, 2].map(() => arm('#1c5fd6', 3)); PHV.gap = [0, 1, 2].map(() => arm('#8a5700', 5));
  PHV.meterC = mk(phG, 'circle', { cx: 770, cy: 62, r: 44, fill: '#eceef4', stroke: '#55636b', 'stroke-width': 2 }); mk(phG, 'circle', { class: 'ring', cx: 770, cy: 62, r: 44 + RING_GAP });
  mk(phG, 'text', { x: 770, y: 126, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'rotation meter');
  PHV.meter = mk(phG, 'text', { x: 770, y: 70, 'text-anchor': 'middle', 'font-size': 21, 'font-weight': 800 }, '');
  PHV.motorC = mk(phG, 'circle', { cx: 770, cy: 186, r: 36, fill: '#eef4fe', stroke: '#1c5fd6', 'stroke-width': 2 }); mk(phG, 'circle', { class: 'ring', cx: 770, cy: 186, r: 36 + RING_GAP });
  PHV.rotor = mk(phG, 'line', { x1: 770, y1: 156, x2: 770, y2: 216, stroke: '#1a2328', 'stroke-width': 7, 'stroke-linecap': 'round' });
  PHV.motor = mk(phG, 'text', { x: 770, y: 246, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, '');
}
let phT = 0, motT = 0;
/* Draw the phasors (bus at ωt − k·120°; generator at ωt + Δθ ∓ k·120°), the gap vectors, the meter and the motor. */
function drawPhasors(dt) {
  if (!S.paused) { phT += dt * ROT_DISP * TWO_PI; motT += dt * MOTOR_DISP * TWO_PI * (S.seq === 'ABC' ? 1 : -1); }
  const vg = vGenLL() / V_LL, th = S.closed ? 0 : S.th, sg = S.seq === 'ABC' ? -1 : 1, R = 80, CY = 134;
  const set = (o, cx, a, m, lbl) => { const x = cx + R * m * Math.cos(a), y = CY - R * m * Math.sin(a); o.l.setAttribute('x1', cx); o.l.setAttribute('y1', CY); o.l.setAttribute('x2', x.toFixed(1)); o.l.setAttribute('y2', y.toFixed(1)); o.t.setAttribute('x', (cx + (R * m + 12) * Math.cos(a) - 4).toFixed(1)); o.t.setAttribute('y', (CY - (R * m + 12) * Math.sin(a) + 5).toFixed(1)); o.t.textContent = lbl; };
  for (let k = 0; k < 3; k++) {
    const ab = phT - k * PH120, ag = phT + th + sg * k * PH120, nm = 'abc'[k];
    set(PHV.bus[k], 110, ab, 1, nm); set(PHV.gen[k], 330, ag, vg, nm);
    set(PHV.bus2[k], 550, ab, 1, ''); set(PHV.gen2[k], 550, ag, vg, '');
    const x1 = 550 + R * Math.cos(ab), y1 = CY - R * Math.sin(ab), x2 = 550 + R * vg * Math.cos(ag), y2 = CY - R * vg * Math.sin(ag), G = PHV.gap[k];
    G.l.setAttribute('x1', x1.toFixed(1)); G.l.setAttribute('y1', y1.toFixed(1)); G.l.setAttribute('x2', x2.toFixed(1)); G.l.setAttribute('y2', y2.toFixed(1));
    G.t.setAttribute('x', ((x1 + x2) / 2 + 6).toFixed(1)); G.t.setAttribute('y', ((y1 + y2) / 2).toFixed(1)); G.t.textContent = 'ABC'[k];
  }
  PHV.meter.textContent = S.seq === 'ABC' ? 'ABC ↺' : 'ACB ↻'; PHV.meter.setAttribute('fill', S.seq === 'ABC' ? '#18744a' : '#c2412f');
  PHV.rotor.setAttribute('transform', `rotate(${(-motT * DEG).toFixed(1)} 770 186)`);
  PHV.motor.textContent = S.seq === 'ABC' ? 'test motor: forward ↺' : 'test motor: BACKWARDS ↻';
  PHV.motor.setAttribute('fill', S.seq === 'ABC' ? '#18744a' : '#c2412f');
}

/* ═══ 11. SLIDE 1: PLANT DAY (schematic reference model, slide spec section E) ═══ */
/* Plant load (MW) at time of day h (hours): hourly values joined by straight lines, wrapping at 24 h. */
function loadMW(h) { h = ((h % 24) + 24) % 24; const i = Math.floor(h), a = LOAD_MW[i], b = LOAD_MW[(i + 1) % 24]; return a + (b - a) * (h - i); }
/* Units needed at time h: clamp(ceil(load / 60 MW), 1, 5). */
function unitsNeeded(h) { return Math.min(N_UNITS, Math.max(1, Math.ceil(loadMW(h) / UNIT_MW - EPS))); }
/* Switching events of the day, in time order: { t (h, in (0, 24]), dir (+1 a unit comes on, −1 one goes off), mw (load at the event), n (units online after it) }. */
function dayEvents() {
  const ev = [];
  for (let i = 0; i < 24; i++) { const a = LOAD_MW[i], b = LOAD_MW[(i + 1) % 24];
    for (let k = 1; k < N_UNITS; k++) { const thr = k * UNIT_MW;
      if ((a - thr) * (b - thr) < 0) ev.push({ t: i + (thr - a) / (b - a), dir: b > a ? 1 : -1, mw: thr, n: b > a ? k + 1 : k });
      else if (b === thr && a > thr) ev.push({ t: i + 1, dir: -1, mw: thr, n: k });        // load falls exactly onto a multiple of 60 MW at the hour
      else if (a === thr && b > thr) ev.push({ t: i, dir: 1, mw: thr, n: k + 1 }); } }     // load rises off a multiple of 60 MW at the hour
  return ev.sort((p, q) => p.t - q.t);
}
const DAY_EV = dayEvents();
/* State of the fleet at time h: load L, units online n, each unit's state ('on', 'sync', 'unload', 'off') and MW, and the events so far today k.
   A unit about to come on waits at 0 MW with its breaker open; a unit about to leave ramps linearly to 0 MW at its event while the others share the rest. */
function fleet(h) {
  const L = loadMW(h), n = unitsNeeded(h), n2 = unitsNeeded(h + LOOK_H), next = DAY_EV.find(e => e.t > h + EPS) || { t: DAY_EV[0].t + 24 };
  const x = n2 < n ? L / n * Math.min(1, Math.max(0, (next.t - h) / LOOK_H)) : 0, u = [];
  for (let i = 1; i <= N_UNITS; i++) {
    if (i <= n) u.push(n2 < n && i === n ? { s: 'unload', mw: x } : { s: 'on', mw: n2 < n ? (L - x) / (n - 1) : L / n });
    else u.push({ s: n2 > n && i === n + 1 ? 'sync' : 'off', mw: 0 });
  }
  return { L, n, u, k: DAY_EV.filter(e => e.dir > 0 ? e.t < h - EPS : e.t <= h + EPS).length };
}
const DG = document.getElementById('dayG'), DAY = { units: [], last: null };
const DX = h => 56 + h * 15.2, DY = mw => 330 - mw * 280 / 300;   // chart: hours → x, MW → y (viewBox units)
const FLEET_Y0 = 76, FLEET_DY = 62;                               // y of G1 and the row pitch in the fleet drawing
const UNIT_COL = { on: ['#0f6e6c', '#e2f1f0'], sync: ['#8a5700', '#fff3d6'], unload: ['#8a5700', '#fff3d6'], off: ['#7d868b', '#eceef4'] };   // [line and text, fill]
/* Build the load chart and the fleet drawing once. */
function buildDay() {
  mk(DG, 'text', { x: 56, y: 24, 'font-size': 17, 'font-weight': 800 }, 'Plant load and online capacity');
  for (let k = 0; k <= N_UNITS; k++) { const y = DY(k * UNIT_MW);
    mk(DG, 'path', { d: `M56 ${y}H${DX(24)}`, stroke: k ? '#9aa6ad' : '#55636b', 'stroke-width': k ? 1 : 1.5, 'stroke-dasharray': k ? '5 4' : 'none' });
    mk(DG, 'text', { x: 50, y: y + 4, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, String(k * UNIT_MW));
    if (k) mk(DG, 'text', { x: DX(24) + 5, y: y + 4, 'font-size': 12.5, fill: '#55636b' }, k + (k > 1 ? ' units' : ' unit')); }
  mk(DG, 'path', { d: `M56 ${DY(300)}V${DY(0)}`, stroke: '#55636b', 'stroke-width': 1.5 });
  mk(DG, 'text', { x: 50, y: 40, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, 'MW');
  for (let h = 0; h <= 24; h += 4) { mk(DG, 'path', { d: `M${DX(h)} ${DY(0)}v5`, stroke: '#55636b' }); mk(DG, 'text', { x: DX(h), y: DY(0) + 19, 'text-anchor': 'middle', 'font-size': 13, fill: '#55636b' }, String(h)); }
  mk(DG, 'text', { x: DX(24), y: 366, 'text-anchor': 'end', 'font-size': 13, fill: '#55636b' }, 'time of day (h)');
  let st = `M${DX(0)} ${DY(unitsNeeded(0) * UNIT_MW)}`; DAY_EV.forEach(e => { st += `H${DX(e.t).toFixed(1)}V${DY(e.n * UNIT_MW)}`; }); st += `H${DX(24)}`;
  DAY.stair = mk(DG, 'path', { class: 'ln stair', d: st, fill: 'none', stroke: '#0f6e6c', 'stroke-width': 2.5 });
  const pts = []; for (let h = 0; h <= 24; h++) pts.push(DX(h) + ',' + DY(loadMW(h)).toFixed(1));
  DAY.load = mk(DG, 'polyline', { class: 'ln', points: pts.join(' '), fill: 'none', stroke: '#1a2328', 'stroke-width': 2.5 });
  DAY_EV.forEach(e => mk(DG, 'circle', { cx: DX(e.t).toFixed(1), cy: DY(e.mw), r: 4.5, fill: '#ffffff', stroke: '#8a5700', 'stroke-width': 2 }));
  mk(DG, 'path', { d: 'M56 382h22', stroke: '#1a2328', 'stroke-width': 2.5 }); mk(DG, 'text', { x: 83, y: 386, 'font-size': 13 }, 'load');
  mk(DG, 'path', { d: 'M126 382h22', stroke: '#0f6e6c', 'stroke-width': 2.5 }); mk(DG, 'text', { x: 153, y: 386, 'font-size': 13 }, 'online capacity');
  mk(DG, 'circle', { cx: 272, cy: 382, r: 4.5, fill: '#ffffff', stroke: '#8a5700', 'stroke-width': 2 }); mk(DG, 'text', { x: 282, y: 386, 'font-size': 13 }, 'switching event');
  DAY.cur = mk(DG, 'path', { d: '', stroke: '#c2412f', 'stroke-width': 2 }); DAY.dot = mk(DG, 'circle', { r: 5, fill: '#c2412f' });
  DAY.clock = mk(DG, 'text', { x: 0, y: 44, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#c2412f' }, '');
  mk(DG, 'rect', { x: 700, y: 46, width: 9, height: 308, fill: '#d32f2f' });
  DAY.busLbl = mk(DG, 'text', { x: 704, y: 34, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, fill: '#d32f2f' }, 'Infinite bus');
  mk(DG, 'text', { x: 756, y: 378, 'text-anchor': 'end', 'font-size': 13.5, fill: '#55636b' }, 'the grid: V and f fixed');
  for (let i = 0; i < N_UNITS; i++) { const y = FLEET_Y0 + i * FLEET_DY;
    const wire = mk(DG, 'path', { d: `M522 ${y}H590M640 ${y}H700`, 'stroke-width': 3, fill: 'none' });
    const c1 = mk(DG, 'circle', { cx: 590, cy: y, r: 4 }), c2 = mk(DG, 'circle', { cx: 640, cy: y, r: 4 });
    const blade = mk(DG, 'path', { class: 'ublade', d: '', 'stroke-width': 3.5, 'stroke-linecap': 'round' });
    const body = mk(DG, 'circle', { cx: 498, cy: y, r: 23, 'stroke-width': 3 }); mk(DG, 'circle', { class: 'ring', cx: 498, cy: y, r: 23 + RING_GAP });
    const name = mk(DG, 'text', { x: 498, y: y + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800 }, 'G' + (i + 1));
    const lbl = mk(DG, 'text', { x: 611, y: y + 24, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, '');
    DAY.units.push({ y, wire, c1, c2, blade, body, name, lbl }); }
}
/* Draw the day at S.dayH: chart cursor, each unit's colour, breaker and label, and the readouts. Redrawn only when the hour changes (or forced). */
function drawDay(force) {
  if (!force && DAY.last === S.dayH) return; DAY.last = S.dayH;
  const h = S.dayH, F = fleet(h), x = DX(h).toFixed(1);
  DAY.cur.setAttribute('d', `M${x} ${DY(300)}V${DY(0)}`); DAY.dot.setAttribute('cx', x); DAY.dot.setAttribute('cy', DY(F.L).toFixed(1));
  DAY.clock.setAttribute('x', Math.min(DX(24) - 18, Math.max(74, +x))); DAY.clock.textContent = hhmm(h);
  F.u.forEach((u, i) => { const U = DAY.units[i], [col, fill] = UNIT_COL[u.s], shut = u.s === 'on' || u.s === 'unload';
    U.wire.setAttribute('stroke', col); U.c1.setAttribute('fill', col); U.c2.setAttribute('fill', col); U.blade.setAttribute('stroke', col);
    U.blade.setAttribute('d', shut ? `M590 ${U.y}H640` : `M590 ${U.y}L634 ${U.y - 17}`);
    U.body.setAttribute('stroke', col); U.body.setAttribute('fill', fill); U.name.setAttribute('fill', col); U.lbl.setAttribute('fill', col);
    U.lbl.textContent = u.s === 'on' ? u.mw.toFixed(1) + ' MW' : u.s === 'sync' ? '↑ synchronize, 0.0 MW' : u.s === 'unload' ? '↓ unloading ' + u.mw.toFixed(1) + ' MW' : 'off'; });
  put('dL', F.L.toFixed(1).padStart(5, FIG)); put('dN', String(F.n)); put('dK', String(F.k).padStart(2, FIG)); put('dKN', String(DAY_EV.length));
  put('dayO', hhmm(h)); put('dayO2', hhmm(h)); dayS.value = h; dayS.setAttribute('aria-valuetext', hhmm(h));
}
/* Move the day clock to h (0–24 h); moving it by hand pauses the day. */
function setDay(h) { S.dayH = Math.min(24, Math.max(0, h)); S.dayRun = false; syncButtons(); readouts(true); }

/* ═══ 12. WORKSHEET ═══ */
let SHEET = {};
const KEYS = [...document.querySelectorAll('[data-k]')].map(e => e.dataset.k);
/* Show the worksheet status (never silent). */
function sheetMsg(t, bad) { const e = document.getElementById('sheetStatus'); e.textContent = t; e.className = bad ? 'bad' : 'good'; }
/* Load and validate the stored record: a plain object of known keys holding short strings. */
function loadSheet() {
  let raw = null;
  try { raw = localStorage.getItem(SHEET_KEY); } catch (e) { sheetMsg('This browser will not store answers here. Use “Export my answers” before you close the page.', true); return; }
  if (raw === null) { sheetMsg('Answers are saved in this browser only.', false); return; }
  let rec; try { rec = JSON.parse(raw); } catch (e) { rec = null; }
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) { sheetMsg('A stored worksheet record was invalid and was not loaded.', true); return; }
  let dropped = 0;
  for (const k of Object.keys(rec)) { if (KEYS.includes(k) && typeof rec[k] === 'string' && rec[k].length <= SHEET_MAX) SHEET[k] = rec[k]; else dropped++; }
  sheetMsg(dropped ? dropped + ' stored entr' + (dropped === 1 ? 'y was' : 'ies were') + ' invalid and not loaded; the rest are restored.' : 'Answers restored from this browser.', dropped > 0);
  document.querySelectorAll('[data-k]').forEach(e => { if (SHEET[e.dataset.k] !== undefined) e.value = SHEET[e.dataset.k]; });
}
/* Save the worksheet; say so if the browser refuses. */
function saveSheet() {
  try { localStorage.setItem(SHEET_KEY, JSON.stringify(SHEET)); sheetMsg('Saved in this browser.', false); }
  catch (e) { sheetMsg('Could not save in this browser. Use “Export my answers” before you close the page.', true); }
}
document.querySelectorAll('[data-k]').forEach(e => e.addEventListener('input', () => { SHEET[e.dataset.k] = String(e.value).slice(0, SHEET_MAX); saveSheet(); }));
document.getElementById('clearBtn').addEventListener('click', () => {
  if (!confirm('Clear every answer on this worksheet?')) return;
  SHEET = {}; document.querySelectorAll('[data-k]').forEach(e => { e.value = ''; });
  try { localStorage.removeItem(SHEET_KEY); sheetMsg('Answers cleared.', false); } catch (e) { sheetMsg('Could not clear the stored copy in this browser.', true); }
});
document.getElementById('exportBtn').addEventListener('click', () => {
  const lines = [document.title, 'Name: ' + (SHEET.name || ''), 'Section: ' + (SHEET.section || ''), 'Date: ' + (SHEET.date || ''), ''];
  document.querySelectorAll('#sheet [data-k]').forEach(e => { if (['name', 'section', 'date'].includes(e.dataset.k)) return;
    const lab = e.getAttribute('aria-label') || (e.closest('li') ? e.closest('li').firstChild.textContent.trim() : e.dataset.k);
    lines.push('[' + e.dataset.k + '] ' + lab, '  ' + (SHEET[e.dataset.k] || '(blank)')); });
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = 'Paralleling_Lab_answers.txt'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000); sheetMsg('Exported to Paralleling_Lab_answers.txt.', false);
});

/* ═══ 13. LOOP ═══ */
let tPrev = performance.now();
/* One frame: advance the phase difference at the slip frequency (real time) and the day clock, then draw what is on screen; numbers 4 times a second. */
function frame(t) {
  const dt = Math.min(DT_MAX, (t - tPrev) / 1000) * tFactor(); tPrev = t;
  ramp(dt);
  if (!S.closed) S.th = wrap(S.th + TWO_PI * (S.fg - F_BUS) * dt);
  S.tw = (S.tw + dt * WAVE_SLOW) % (1 / F_BUS);   // s of waveform time shown in the slow view
  if (S.dayRun) { S.dayH += dt * 24 / DAY_S; if (S.dayH >= 24) { S.dayH = 24; S.dayRun = false; syncButtons(); } }
  if (S.vis.has('day')) drawDay(false);
  if (S.vis.has('scene')) drawScene(lampKV(S.th));
  if (S.vis.has('wave')) drawWave();
  if (S.vis.has('phasors')) drawPhasors(dt);
  readouts(false);
  requestAnimationFrame(frame);
}
/* Checklist value cells get ids so put() can skip unchanged text. */
['c1', 'c2', 'c3', 'c4'].forEach(id => { document.getElementById(id).querySelector('.val').id = id + 'v'; });
buildScene(); buildWave(); buildPhasors(); buildDay(); buildWorked(); loadSheet(); showPage('lec');
requestAnimationFrame(frame);

/* RF Cascade Analyzer — application shell: Lecture navigation (beats, URL hash, rail and dots), presentation mode
   (fullscreen, projector type sizes and theme), clicker and keyboard keys (spec A.8), the Step 1b wave animation
   with pause and reduced motion (A.6.8), and the Lecture/Lab mode switch. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — DOM handles, step count, hash format
   2. App state        — mode, presentation, theme per view, pause
   3. Rendering        — stage, readouts, controls, top bar, rail, device chip
   4. Navigation       — go, next, previous, URL hash
   5. Animation        — Step 1b travelling waves (requestAnimationFrame)
   6. Views            — presentation, theme, mode, help
   7. Keys             — document key handling (clicker keys always navigate)
   8. Start-up         — wiring and first render
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const N_STEPS = STEPS.length;
const HASH_RE = /^#?step=(\d+)&beat=(\d+)$/;
const TEXT_TYPES = ['text', 'number', 'search', 'email', 'url', 'tel', 'password'];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── APP STATE ─────────────────────────────────────────────────
const app = {
  mode: 'lecture',                                  // 'lecture' | 'lab'
  present: false, fsOwned: false,                   // presentation layout on; fullscreen entered by us
  theme: { window: 'dark', present: 'light' },      // spec E-Q1: dark windowed, light Projector in presentation
  paused: false, raf: 0, last: 0, pending: 0,
};
// ── END APP STATE ─────────────────────────────────────────────

// ── RENDERING ─────────────────────────────────────────────────
// Draw the current step's stage at the stage's current size.
function renderStage(){
  const st = $('stage'), W = st.clientWidth, H = st.clientHeight, step = STEPS[L.step - 1];
  if(W <= 0 || H <= 0) return;
  const out = step.stage(W, H);
  if(typeof out === 'string') st.innerHTML = out; else st.replaceChildren(out);
  if(step.after) step.after();
}
// Re-render the stage and the readouts after a state change from a control.
function refresh(){
  renderStage();
  $('readouts').replaceChildren(...STEPS[L.step - 1].readouts());
  renderChip();
}
// Rebuild the controls as well (a beat or a mode inside the step changed), keeping keyboard focus where it was.
function rebuild(){
  const a = document.activeElement, id = a && a.id, sk = a && a.dataset && a.dataset.s;
  $('controls').replaceChildren(...STEPS[L.step - 1].controls());
  refresh();
  const back = id ? $(id) : sk ? document.querySelector('#stage [data-s="' + sk + '"]') : null;
  if(back && back !== document.activeElement) back.focus({ preventScroll: true });
  syncAnim();
}
// Top bar: "Step s of 6 — title", step dots with beat dots, rail state and button states.
function renderNav(){
  const info = STEP_INFO[L.step - 1], nb = STEPS[L.step - 1].beats.length;
  $('stepTitle').textContent = 'Step ' + L.step + ' of ' + N_STEPS + ' — ' + info.title;
  const dots = $('dots'); dots.replaceChildren();
  for(let s = 1; s <= N_STEPS; s++){ const g = h('span', { cls: 'sd' }, h('i', { cls: s === L.step ? 'cur' : '' }));
    if(s === L.step) for(let b = 1; b <= nb; b++) g.append(h('i', { cls: 'beat' + (b === L.beat ? ' cur' : '') }));
    dots.append(g); }
  $('dots').setAttribute('title', 'Step ' + L.step + ', beat ' + L.beat + ' of ' + nb);
  document.querySelectorAll('#rail button').forEach((b, i) => { if(i + 1 === L.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('on', i + 1 === L.step); });
  const lab = app.mode === 'lab';
  $('prevBtn').disabled = lab || (L.step === 1 && L.beat === 1);
  $('nextBtn').disabled = lab || (L.step === N_STEPS && L.beat === STEPS[N_STEPS - 1].beats.length);
}
// The steps rail: one button per step with the lecture slides it serves.
function buildRail(){
  $('rail').replaceChildren(...STEP_INFO.map((s, i) => h('button', { type: 'button', id: 'rail' + (i + 1), attrs: { 'aria-label': 'Step ' + (i + 1) + ': ' + s.title + ', ' + s.slides },
    onclick: () => go(i + 1, 1) }, (i + 1) + ' ' + s.title, h('small', { text: s.slides }))));
}
// The device chip (Steps 2–5): the current two-port's name and a chooser that sets the shared device.
function renderChip(){
  const chip = $('chip'), sel = $('devSel'), show = L.step >= 2 && L.step <= 5;
  chip.classList.toggle('hidden', !show); if(!show) return;
  const kinds = ['teach'].concat(GALLERY, L.dev.kind === 'custom' ? ['custom'] : []), cur = curDev().kind;
  if(sel.options.length !== kinds.length || [...sel.options].some((o, i) => o.value !== kinds[i]))
    sel.replaceChildren(...kinds.map(k => h('option', { value: k, text: GAL_NAME[k] })));
  sel.value = cur;
  $('chipNote').textContent = L.over ? '(this beat)' : '';
}
// Set the shared device from the chip.
function chooseDevice(kind){
  if(kind === 'teach') L.dev = { kind: 'teach', name: GAL_NAME.teach, S: TEACHING() };
  else if(kind !== 'custom') L.dev = galDev(kind);
  L.over = null; rebuild();
}
// ── END RENDERING ─────────────────────────────────────────────

// ── NAVIGATION ────────────────────────────────────────────────
// Go to step s, beat b (clamped), apply that beat's preset state and redraw everything.
function go(s, b){
  s = Math.min(N_STEPS, Math.max(1, s | 0)); const nb = STEPS[s - 1].beats.length; b = Math.min(nb, Math.max(1, b | 0));
  const stepChanged = s !== L.step;
  L.step = s; L.beat = b; STEPS[s - 1].beats[b - 1]();
  if(stepChanged) $('controls').replaceChildren();
  rebuild(); renderNav(); syncHash();
}
// Next beat; after the last beat, beat 1 of the next step; stops at the end of Step 6.
function next(){ if(L.beat < STEPS[L.step - 1].beats.length) go(L.step, L.beat + 1); else if(L.step < N_STEPS) go(L.step + 1, 1); }
// Previous beat; before beat 1, the last beat of the previous step.
function prev(){ if(L.beat > 1) go(L.step, L.beat - 1); else if(L.step > 1) go(L.step - 1, STEPS[L.step - 2].beats.length); }
// Mirror the step and beat in the URL hash (#step=s&beat=k) without adding history entries.
function syncHash(){
  const want = '#step=' + L.step + '&beat=' + L.beat;
  if(location.hash !== want) history.replaceState(null, '', want);
  renderNav();
}
// Step and beat from the URL hash, or null.
function readHash(){ const m = HASH_RE.exec(location.hash); return m ? [+m[1], +m[2]] : null; }
// ── END NAVIGATION ────────────────────────────────────────────

// ── ANIMATION ─────────────────────────────────────────────────
// True when the current view has a running animation (Step 1b, playing, tab visible, Lecture mode).
const animating = () => app.mode === 'lecture' && STEPS[L.step - 1].anim && STEPS[L.step - 1].anim() && !app.paused && !document.hidden;
// Start or stop the animation loop to match the state.
function syncAnim(){
  if(animating()){ if(!app.raf){ app.last = 0; app.raf = requestAnimationFrame(tick); } }
  else if(app.raf){ cancelAnimationFrame(app.raf); app.raf = 0; }
}
// One animation frame: advance the wave clock and move the three wave paths (the rest of the stage is static).
function tick(ts){
  app.raf = 0;
  if(!animating()) return;
  if(app.last) L.tNow += Math.min(0.1, (ts - app.last) / 1000);
  app.last = ts;
  const st = $('stage'), G = geo1b(st.clientWidth, st.clientHeight), P = wavePaths(G, gammaLoad(loadZ(), Z0_LECT), L.tNow);
  const set = (id, d) => { const e = $(id); if(e) e.setAttribute('d', d); };
  set('wInc', P.inc); set('wRef', P.ref); set('wTot', P.tot);
  app.raf = requestAnimationFrame(tick);
}
// Pause or play the animation (key P).
function setPaused(p){
  app.paused = p; const b = $('pauseBtn');
  b.textContent = p ? 'Play' : 'Pause'; b.setAttribute('aria-pressed', String(p)); b.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' animation (P)');
  syncAnim();
}
// ── END ANIMATION ─────────────────────────────────────────────

// ── VIEWS ─────────────────────────────────────────────────────
// Apply the theme of the current view (windowed or presentation).
function applyTheme(){
  const t = app.theme[app.present ? 'present' : 'window'];
  document.body.classList.toggle('light', t === 'light');
  $('themeBtn').textContent = t === 'light' ? 'Dark' : 'Light';
  $('themeBtn').setAttribute('aria-label', 'Switch to ' + (t === 'light' ? 'dark' : 'light (Projector)') + ' theme (T)');
}
// Toggle the theme of the current view (key T).
function toggleTheme(){ const k = app.present ? 'present' : 'window'; app.theme[k] = app.theme[k] === 'light' ? 'dark' : 'light'; applyTheme(); }
// Recompute sizes and redraw after the view changed size or layout.
function relayout(){
  updateSizes(app.present);
  if(app.mode === 'lecture') rebuild(); else renderLab();
}
// Enter or leave presentation mode. Fullscreen is requested; if refused, the layout still applies in the window.
function setPresent(on){
  if(on === app.present) return;
  if(on && app.mode !== 'lecture') setMode('lecture');
  app.present = on; document.body.classList.toggle('present', on);
  $('presentBtn').setAttribute('aria-pressed', String(on));
  if(on && document.documentElement.requestFullscreen && !document.fullscreenElement){
    app.fsOwned = true;
    document.documentElement.requestFullscreen().catch(() => { app.fsOwned = false; });
  }
  if(!on && document.fullscreenElement && app.fsOwned){ app.fsOwned = false; document.exitFullscreen().catch(() => {}); }
  applyTheme(); relayout();
}
// Leaving fullscreen by the browser's own Esc also leaves presentation mode.
function onFullscreenChange(){ if(!document.fullscreenElement && app.fsOwned){ app.fsOwned = false; setPresent(false); } }
// Switch between Lecture and Lab.
function setMode(m){
  if(m === app.mode) return;
  if(m === 'lab' && app.present) setPresent(false);
  app.mode = m;
  $('lecture').classList.toggle('hidden', m !== 'lecture'); $('lab').classList.toggle('hidden', m !== 'lab');
  $('modeLecture').setAttribute('aria-pressed', String(m === 'lecture')); $('modeLab').setAttribute('aria-pressed', String(m === 'lab'));
  $('presentBtn').disabled = m !== 'lecture'; $('pauseBtn').disabled = m !== 'lecture'; $('dots').classList.toggle('hidden', m !== 'lecture');
  if(m === 'lab'){ syncAnim(); renderLab(); $('stepTitle').textContent = 'Lab — cascade and divider'; renderNavButtons(); }
  else { rebuild(); renderNav(); }
}
// Previous/Next stay visible in Lab but do nothing there.
function renderNavButtons(){ $('prevBtn').disabled = true; $('nextBtn').disabled = true; }
// Open or close the keyboard help.
function toggleHelp(){ const d = $('help'); if(d.open) d.close(); else d.showModal(); }
// ── END VIEWS ─────────────────────────────────────────────────

// ── KEYS ──────────────────────────────────────────────────────
// True when focus is in a field that takes typed text (letters and Home/End belong to it).
const typing = t => t && ((t.tagName === 'INPUT' && TEXT_TYPES.includes(t.type)) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
// True when focus is on any control (Space and arrows belong to it).
const onControl = t => t && t !== document.body && (/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(t.tagName) || t.getAttribute('role') === 'button');
/* Document-level keys (spec A.8). PageUp and PageDown always navigate, even on a slider, and never change it.
   Arrows adjust a focused control, otherwise navigate. Backspace is not bound. */
function onKey(e){
  if($('help').open){ if(e.key === '?'){ e.preventDefault(); toggleHelp(); } return; }
  const t = e.target, lecture = app.mode === 'lecture', k = e.key;
  if(lecture && (k === 'PageDown' || k === 'PageUp')){ e.preventDefault(); e.stopPropagation(); if(k === 'PageDown') next(); else prev(); return; }
  if(e.ctrlKey || e.metaKey) return;
  if(e.altKey){ const m = /^Digit([1-6])$/.exec(e.code); if(m && lecture){ e.preventDefault(); go(+m[1], 1); } return; }
  if(lecture && !onControl(t)){
    if(k === 'ArrowRight'){ e.preventDefault(); next(); return; }
    if(k === 'ArrowLeft'){ e.preventDefault(); prev(); return; }
    if(k === ' ' || k === 'Spacebar'){ e.preventDefault(); if(e.shiftKey) prev(); else next(); return; }
  }
  if(typing(t)) return;
  if(lecture && k === 'Home'){ e.preventDefault(); go(1, 1); return; }
  if(lecture && k === 'End'){ e.preventDefault(); go(N_STEPS, STEPS[N_STEPS - 1].beats.length); return; }
  const lk = k.length === 1 ? k.toLowerCase() : k;
  if(lecture && lk === 'n'){ e.preventDefault(); next(); }
  else if(lk === 'f' && lecture){ e.preventDefault(); setPresent(!app.present); }
  else if(k === 'Escape' && app.present){ e.preventDefault(); setPresent(false); }
  else if(lk === 't'){ e.preventDefault(); toggleTheme(); }
  else if(lk === 'p' && lecture){ e.preventDefault(); setPaused(!app.paused); }
  else if(k === '?'){ e.preventDefault(); toggleHelp(); }
  else if(lecture && L.step === 2 && /^[1-4]$/.test(k)){ e.preventDefault(); selectS(S_KEYS[+k - 1]); }
  else if(lecture && L.step === 3 && lk === 'r'){ e.preventDefault(); L.dir = L.dir === 'fwd' ? 'rev' : 'fwd'; rebuild(); }
}
// Stage clicks and keys on S entries of the Step 2 matrix (role=button inside the SVG).
function onStageActivate(e){
  const g = e.target.closest && e.target.closest('[data-s]'); if(!g) return;
  if(e.type === 'keydown'){ if(e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); e.stopPropagation(); }
  if(e.type === 'mouseover' && L.sel === g.dataset.s) return;
  selectS(g.dataset.s);
}
// ── END KEYS ──────────────────────────────────────────────────

// ── START-UP ──────────────────────────────────────────────────
// Wire the shell, read the hash and draw the first view.
function start(){
  buildRail();
  $('chip').append(h('span', { id: 'chipNote', cls: 'note' }));
  $('devSel').addEventListener('change', e => chooseDevice(e.target.value));
  $('prevBtn').addEventListener('click', prev); $('nextBtn').addEventListener('click', next);
  $('pauseBtn').addEventListener('click', () => setPaused(!app.paused));
  $('themeBtn').addEventListener('click', toggleTheme);
  $('presentBtn').addEventListener('click', () => setPresent(!app.present));
  $('helpBtn').addEventListener('click', toggleHelp); $('helpClose').addEventListener('click', toggleHelp);
  $('modeLecture').addEventListener('click', () => setMode('lecture')); $('modeLab').addEventListener('click', () => setMode('lab'));
  ['click', 'keydown', 'mouseover'].forEach(ev => $('stage').addEventListener(ev, onStageActivate));
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('visibilitychange', syncAnim);
  window.addEventListener('hashchange', () => { const hs = readHash(); if(hs && (hs[0] !== L.step || hs[1] !== L.beat)) go(hs[0], hs[1]); });
  let rz = 0; new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); }).observe(document.body);
  buildLab();
  updateSizes(false); applyTheme();
  setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hs = readHash(); go(hs ? hs[0] : 1, hs ? hs[1] : 1);
}
start();
// ── END START-UP ──────────────────────────────────────────────

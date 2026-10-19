/* RF Cascade Analyzer — application shell: the three views as tabs (Reflections, Devices, Cascade), Next/Previous
   (which also step through the device list inside Devices; they keep the Forward/Reverse drive), the URL hash, clicker and keyboard keys, presentation
   mode, the theme, and the View 1 snapshot-wave animation with pause and reduced motion. */
/* ============================================================
   TABLE OF CONTENTS
   1. Constants        — DOM handles, views, hash format
   2. App state        — view, presentation, theme, animation clock
   3. Rendering        — drawing, panel, tabs, device selector
   4. Navigation       — the stop list (views and devices), next, previous, URL hash
   5. Animation        — snapshot wave (requestAnimationFrame)
   6. Views            — presentation, theme, help
   7. Keys             — document key handling (clicker keys always navigate)
   8. Start-up         — wiring and first render
   ============================================================ */

// ── CONSTANTS ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const VIEWS = ['reflections', 'devices', 'cascade'];
const VIEW_NAME = { reflections: 'Reflections', devices: 'Devices', cascade: 'Cascade' };
const VIEW = {
  reflections: { draw: drawReflections, panel: panelReflections, sync: syncReflections, anim: true },
  devices: { draw: drawDevices, panel: panelDevices, sync: syncDevices },
  cascade: { draw: drawCascade, panel: panelCascade, sync: syncCascade },
};
const HASH_RE = /^#?view=(reflections|devices|cascade)(?:&device=(through|atten|amp|iso|custom)(?:&drive=(fwd|rev))?)?(?:&vr=([01]))?$/;
const TEXT_TYPES = ['text', 'number', 'search', 'email', 'url', 'tel', 'password'];
// ── END CONSTANTS ─────────────────────────────────────────────

// ── APP STATE ─────────────────────────────────────────────────
const app = {
  view: 'reflections',
  present: false, fsOwned: false,                   // presentation layout on; fullscreen entered by us
  theme: { window: 'dark', present: 'light' },      // dark windowed, light Projector theme in presentation
  paused: false, raf: 0, last: 0, tNow: 0,          // animation state (s)
};
// ── END APP STATE ─────────────────────────────────────────────

// ── RENDERING ─────────────────────────────────────────────────
/* Drawing scale (CSS px per design unit) and left offset: the drawing fills the stage's width but never grows past ×1
   in a window, or past the presentation factor (×1 at 720 p); a wider stage centres it. */
function drawBox(){ const st = $('stage'), s = Math.min(st.clientWidth / DESIGN_W, app.present ? window.innerHeight / BASE_H : 1);
  return { s, off: (st.clientWidth - DESIGN_W * s) / 2 }; }
// Height of the drawing in design units: the stage's full height at the drawing scale.
function drawH(){ const st = $('stage'); return st.clientWidth > 0 ? st.clientHeight / drawBox().s : 0; }
// Draw the current view (and the Cascade "+" menu over it).
function renderDrawing(){
  const H = drawH(); if(H <= 0) return;
  $('stage').innerHTML = VIEW[app.view].draw(H);
  const b = drawBox(), sv = $('stage').querySelector('svg.vis'); sv.style.width = DESIGN_W * b.s + 'px'; sv.style.left = b.off + 'px';
  if(app.view === 'cascade'){ const m = addMenu(); if(m) $('stage').append(m); }
}
/* Redraw after a state change. full: also rebuild the panel (a button or a mode changed); otherwise only the
   panel's readouts are refreshed, so a slider being dragged keeps focus. Focus on a drawing element is restored. */
function redraw(full){
  const a = document.activeElement, id = a && a.id, dk = a && a.closest && a.closest('#stage [data-blk],#stage [data-add]');
  const key = dk ? (dk.dataset.blk !== undefined ? '[data-blk="' + dk.dataset.blk + '"]' : '[data-add="' + dk.dataset.add + '"]') : null;
  renderDrawing();
  if(full){ $('panel').replaceChildren(...VIEW[app.view].panel()); } else VIEW[app.view].sync();
  const back = key ? $('stage').querySelector(key) : id ? $(id) : null;
  if(back && back !== document.activeElement) back.focus({ preventScroll: true });
  renderTop(); syncAnim();
}
// Top bar and device selector: pressed tab, Previous/Next state, the selected device.
function renderTop(){
  VIEWS.forEach(v => { const b = $('tab_' + v), on = v === app.view; b.setAttribute('aria-selected', String(on)); b.classList.toggle('on', on); b.tabIndex = on ? 0 : -1; });
  const i = stopIndex();
  $('prevBtn').disabled = i === 0; $('nextBtn').disabled = i === STOPS.length - 1;
  $('devbar').classList.toggle('hidden', app.view !== 'devices');
  DEVICES.forEach(d => { const b = $('dev_' + d); b.setAttribute('aria-pressed', String(d === D.dev)); b.classList.toggle('on', d === D.dev); });
  ['fwd', 'rev'].forEach(r => $('drive_' + r).setAttribute('aria-pressed', String(r === D.drive)));
  $('drawCol').setAttribute('aria-label', VIEW_NAME[app.view] + (app.view === 'devices' ? ': ' + DEV_NAME[D.dev] + ', ' + (D.drive === 'fwd' ? 'forward' : 'reverse') : ''));
}
// ── END RENDERING ─────────────────────────────────────────────

// ── NAVIGATION ────────────────────────────────────────────────
// The stops Next/Previous walk: Reflections, each device, Cascade.
const STOPS = [['reflections', null]].concat(DEVICES.map(d => ['devices', d]), [['cascade', null]]);
// Index of the current stop.
const stopIndex = () => STOPS.findIndex(([v, d]) => v === app.view && (d === null || d === D.dev));
// Show view v (and device d and drive r in Devices; vr: show the incident and reflected curves in Reflections, '1' or '0').
function show(v, d, r, vr){
  if(d) D.dev = d; if(r) D.drive = r; if(vr) R.vr = vr === '1';
  const changed = v !== app.view; app.view = v; K.menu = false;
  if(changed) $('panel').replaceChildren();
  redraw(true); syncHash();
}
// Next and Previous stops (stop at the ends).
function next(){ const i = stopIndex(); if(i < STOPS.length - 1) show(...STOPS[i + 1]); }
function prev(){ const i = stopIndex(); if(i > 0) show(...STOPS[i - 1]); }
// Mirror the view (and device) in the URL hash without adding history entries.
function syncHash(){
  const want = '#view=' + app.view + (app.view === 'devices' ? '&device=' + D.dev + '&drive=' + D.drive : '') + (app.view === 'reflections' ? '&vr=' + (R.vr ? 1 : 0) : '');
  if(location.hash !== want) history.replaceState(null, '', want);
}
// [view, device, drive, vr] from the URL hash, or null.
function readHash(){ const m = HASH_RE.exec(location.hash); return m ? [m[1], m[2] || null, m[3] || null, m[4] || null] : null; }
// ── END NAVIGATION ────────────────────────────────────────────

// ── ANIMATION ─────────────────────────────────────────────────
// True when the snapshot wave should move (Reflections, playing, tab visible).
const animating = () => VIEW[app.view].anim && !app.paused && !document.hidden;
// Start or stop the animation loop to match the state.
function syncAnim(){
  if(animating()){ if(!app.raf){ app.last = 0; app.raf = requestAnimationFrame(tick); } }
  else if(app.raf){ cancelAnimationFrame(app.raf); app.raf = 0; }
}
// One frame: advance the clock and move the snapshot wave (the rest of the drawing is static).
function tick(ts){
  app.raf = 0; if(!animating()) return;
  if(app.last) app.tNow += Math.min(0.1, (ts - app.last) / 1000);
  app.last = ts; tickReflections(drawH(), app.tNow);
  app.raf = requestAnimationFrame(tick);
}
// Pause or play (key P).
function setPaused(p){
  app.paused = p; const b = $('pauseBtn');
  b.textContent = p ? 'Play' : 'Pause'; b.setAttribute('aria-pressed', String(p)); b.setAttribute('aria-label', (p ? 'Play' : 'Pause') + ' animation (P)');
  syncAnim();
}
// ── END ANIMATION ─────────────────────────────────────────────

// ── VIEWS ─────────────────────────────────────────────────────
// Apply the theme of the current mode (windowed or presentation).
function applyTheme(){
  const t = app.theme[app.present ? 'present' : 'window'];
  document.body.classList.toggle('light', t === 'light');
  $('themeBtn').textContent = t === 'light' ? 'Dark' : 'Light';
  $('themeBtn').setAttribute('aria-label', 'Switch to ' + (t === 'light' ? 'dark' : 'light (Projector)') + ' theme (T)');
}
// Toggle the theme of the current mode (key T).
function toggleTheme(){ const k = app.present ? 'present' : 'window'; app.theme[k] = app.theme[k] === 'light' ? 'dark' : 'light'; applyTheme(); }
// Recompute sizes and redraw after the window changed size or layout.
function relayout(){ updateSizes(app.present); redraw(false); }
// Enter or leave presentation mode. Fullscreen is requested; if refused, the layout still applies in the window.
function setPresent(on){
  if(on === app.present) return;
  app.present = on; document.body.classList.toggle('present', on);
  $('presentBtn').setAttribute('aria-pressed', String(on));
  if(on && document.documentElement.requestFullscreen && !document.fullscreenElement){
    app.fsOwned = true; document.documentElement.requestFullscreen().catch(() => { app.fsOwned = false; });
  }
  if(!on && document.fullscreenElement && app.fsOwned){ app.fsOwned = false; document.exitFullscreen().catch(() => {}); }
  applyTheme(); relayout();
}
// Leaving fullscreen by the browser's own Esc also leaves presentation mode.
function onFullscreenChange(){ if(!document.fullscreenElement && app.fsOwned){ app.fsOwned = false; setPresent(false); } }
// Open or close the keyboard help.
function toggleHelp(){ const d = $('help'); if(d.open) d.close(); else d.showModal(); }
// ── END VIEWS ─────────────────────────────────────────────────

// ── KEYS ──────────────────────────────────────────────────────
// True when focus is in a field that takes typed text (letters and Home/End belong to it).
const typing = t => t && ((t.tagName === 'INPUT' && TEXT_TYPES.includes(t.type)) || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
// True when focus is on any control (Space and arrows belong to it).
const onControl = t => t && t !== document.body && (/^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(t.tagName) || t.getAttribute('role') === 'button' || t.getAttribute('role') === 'tab');
/* Document-level keys. Next = ArrowRight / PageDown / Space; Previous = ArrowLeft / PageUp / Shift+Space. PageUp and
   PageDown always navigate, even on a slider, and never change it. Arrows and Space work a focused control instead. */
function onKey(e){
  if($('help').open){ if(e.key === '?'){ e.preventDefault(); toggleHelp(); } return; }
  const t = e.target, k = e.key;
  if(k === 'PageDown' || k === 'PageUp'){ e.preventDefault(); e.stopPropagation(); if(k === 'PageDown') next(); else prev(); return; }
  if(e.ctrlKey || e.metaKey) return;
  if(e.altKey){ const m = /^Digit([1-3])$/.exec(e.code); if(m){ e.preventDefault(); show(VIEWS[+m[1] - 1]); } return; }
  if(k === 'Escape' && K.menu !== false){ e.preventDefault(); K.menu = false; redraw(true); return; }
  if(!onControl(t)){
    if(k === 'ArrowRight'){ e.preventDefault(); next(); return; }
    if(k === 'ArrowLeft'){ e.preventDefault(); prev(); return; }
    if(k === ' ' || k === 'Spacebar'){ e.preventDefault(); if(e.shiftKey) prev(); else next(); return; }
  }
  if(typing(t)) return;
  if(k === 'Home'){ e.preventDefault(); show(...STOPS[0]); return; }
  if(k === 'End'){ e.preventDefault(); show(...STOPS[STOPS.length - 1]); return; }
  const lk = k.length === 1 ? k.toLowerCase() : k;
  if(lk === 'f'){ e.preventDefault(); setPresent(!app.present); }
  else if(k === 'Escape' && app.present){ e.preventDefault(); setPresent(false); }
  else if(lk === 't'){ e.preventDefault(); toggleTheme(); }
  else if(lk === 'p'){ e.preventDefault(); setPaused(!app.paused); }
  else if(k === '?'){ e.preventDefault(); toggleHelp(); }
}
// Clicks and Enter/Space on the drawing's buttons (Cascade blocks, ×, +).
function onStageActivate(e){
  if(e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
  if(app.view === 'cascade' && cascadeActivate(e.target)){ e.preventDefault(); e.stopPropagation(); }
}
// Arrow keys move between the tabs (WAI-ARIA tabs pattern).
function onTabKey(e){
  if(e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault(); e.stopPropagation();
  const i = VIEWS.indexOf(app.view), j = (i + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length;
  show(VIEWS[j]); $('tab_' + VIEWS[j]).focus();
}
// ── END KEYS ──────────────────────────────────────────────────

// ── START-UP ──────────────────────────────────────────────────
// Wire the shell, read the hash and draw the first view.
function start(){
  $('tabs').replaceChildren(...VIEWS.map((v, i) => h('button', { type: 'button', id: 'tab_' + v, text: VIEW_NAME[v], attrs: { role: 'tab', 'aria-controls': 'main', 'aria-label': VIEW_NAME[v] + ' (Alt+' + (i + 1) + ')' },
    onclick: () => show(v), onkeydown: onTabKey })));
  $('devbar').replaceChildren(...DEVICES.map(d => h('button', { type: 'button', id: 'dev_' + d, text: DEV_NAME[d], onclick: () => show('devices', d) })),
    h('span', { cls: 'spacer' }), h('div', { cls: 'seg', attrs: { role: 'group', 'aria-label': 'Drive one port at a time' } },
      h('button', { type: 'button', id: 'drive_fwd', text: 'Forward', attrs: { 'aria-label': 'Forward: a1 = 1, a2 = 0' }, onclick: () => show('devices', null, 'fwd') }),
      h('button', { type: 'button', id: 'drive_rev', text: 'Reverse', attrs: { 'aria-label': 'Reverse: a2 = 1, a1 = 0' }, onclick: () => show('devices', null, 'rev') })));
  $('prevBtn').addEventListener('click', prev); $('nextBtn').addEventListener('click', next);
  $('pauseBtn').addEventListener('click', () => setPaused(!app.paused));
  $('themeBtn').addEventListener('click', toggleTheme);
  $('presentBtn').addEventListener('click', () => setPresent(!app.present));
  $('helpBtn').addEventListener('click', toggleHelp); $('helpClose').addEventListener('click', toggleHelp);
  ['click', 'keydown'].forEach(ev => $('stage').addEventListener(ev, onStageActivate));
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('visibilitychange', syncAnim);
  window.addEventListener('hashchange', () => { const hs = readHash(); if(hs) show(...hs); });
  let rz = 0; new ResizeObserver(() => { cancelAnimationFrame(rz); rz = requestAnimationFrame(relayout); }).observe($('stage'));
  updateSizes(false); applyTheme();
  setPaused(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hs = readHash(); show(...(hs || ['reflections', null, null, null]));
}
start();
// ── END START-UP ──────────────────────────────────────────────

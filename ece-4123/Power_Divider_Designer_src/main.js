/* Power Divider Designer — application shell: pages, the update cycle (synthesis → layout → solve → draw), deferred
   resistor refinement, theme, start-up. */
let D = null, pendingTimer = 0, currentPage = 'designer', docsBuilt = false;
const PAGES = ['designer', 'perf', 'params', 'theory', 'exp', 'tests'];
/* Recompute and redraw the visible page. full: also rebuild the sidebar (a button or a mode changed); while a slider is
   dragged (full = false) the sidebar is kept, so the slider keeps focus, and unequal-resistor refinement is deferred. */
function update(full){
  REFINE.defer = true;
  D = derive();
  save();
  if(currentPage === 'designer'){
    if(full) buildSide(D);
    syncSide(D); if(S.view3d) show3d(D); else drawLayout(D); drawOutputs(D);
  } else if(currentPage === 'perf') drawPerf(D);
  else if(currentPage === 'params') drawParams(D);
  $('cmpBtn').setAttribute('aria-pressed', String(!!S.compare)); $('flowBtn').setAttribute('aria-pressed', String(!!S.overlay)); $('v3Btn').setAttribute('aria-pressed', String(!!S.view3d));
  $('layoutWrap').classList.toggle('v3', !!S.view3d); $('cmpBtn').disabled = $('flowBtn').disabled = !!S.view3d;
  clearTimeout(pendingTimer);
  if(REFINE.pending.size) pendingTimer = setTimeout(function step(){ const more = runPending(); if(!more) update(false); else pendingTimer = setTimeout(step, 0); }, 120);
}
// Readouts in the sidebar that change while a slider moves.
function syncSide(Dd){
  const tgt = splitTarget(Dd);
  if($('ratioVal') && tgt.enabled){
    const v = tgt.get(), fr = powerSplit(v);
    $('ratioVal').textContent = ratioText(v) + '  (' + fmt(v, 2) + ' dB)';
    $('ratioPct').textContent = (fr[0] * 100).toFixed(1) + ' / ' + (fr[1] * 100).toFixed(1) + ' %';
    const t = $('ratioText'); if(t && document.activeElement !== t){ t.value = ratioText(v); t.classList.remove('invalid'); }
    const r = $('ratioSlider'); if(r && document.activeElement !== r) r.value = String(v);
  }
  const m = microstrip(S.z0, S.er, S.h, S.f0, S.msModel);
  if($('subInfo')) $('subInfo').textContent = `Z₀ line: W ${m.W.toFixed(3)} mm, ε_eff ${m.eeff.toFixed(3)}, λg ${m.lambdaG.toFixed(2)} mm`;
  const st = Dd.design.stage, pend = st && st.refined === false || (isTree() && Dd.design.tree.junctions.some(j => j.stage.refined === false));
  const w = Dd.lay.warnings.slice(0, 12).map(x => el('div', { class: 'warnline', text: '⚠ ' + x }));
  if(Dd.lay.warnings.length > 12) w.push(el('div', { class: 'warnline', text: '… and ' + (Dd.lay.warnings.length - 12) + ' more (hover the red elements)' }));
  if(pend) w.unshift(el('div', { class: 'hint', text: 'Refining the unequal-split resistors…' }));
  $('warnBox').replaceChildren(...w);
}
function showPage(p){
  if(!PAGES.includes(p)) p = 'designer';
  currentPage = p;
  PAGES.forEach(q => { const on = q === p, b = $('tab_' + q); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; $('pg_' + q).classList.toggle('on', on); });
  if((p === 'theory' || p === 'exp') && !docsBuilt){ buildTheory(); buildExperiments(); docsBuilt = true; }
  if(p === 'tests' && !$('testsBody').dataset.done) runTests();
  if(p === 'designer' || p === 'perf' || p === 'params') requestAnimationFrame(() => update(true));
}
function applyTheme(dark){ document.body.classList.toggle('dark', dark); $('themeBtn').textContent = dark ? 'Light' : 'Dark'; $('themeBtn').setAttribute('aria-label', 'Switch to the ' + (dark ? 'light' : 'dark') + ' theme'); }
// ── START-UP ──
PAGES.forEach(p => $('tab_' + p).addEventListener('click', () => showPage(p)));
$('tabs').addEventListener('keydown', e => { const i = PAGES.indexOf(currentPage);
  if(e.key === 'ArrowRight' || e.key === 'ArrowLeft'){ e.preventDefault(); const n = PAGES[(i + (e.key === 'ArrowRight' ? 1 : PAGES.length - 1)) % PAGES.length]; showPage(n); $('tab_' + n).focus(); } });
$('themeBtn').addEventListener('click', () => applyTheme(!document.body.classList.contains('dark')));
$('cmpBtn').addEventListener('click', () => { S.compare = !S.compare; update(false); });
$('flowBtn').addEventListener('click', () => { S.overlay = !S.overlay; update(false); });
$('v3Btn').addEventListener('click', () => { S.view3d = !S.view3d; update(false); if(S.view3d) $('view3d').focus(); });
wire3d();
let resizeT = 0;
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if(D) update(false); }, 120); });
S.sel = '';
applyTheme(false);
update(true);

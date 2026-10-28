/* Power Divider Designer — application shell: update cycle, deferred resistor refinement, theme, start-up. */
let D = null, pendingTimer = 0;
/* Recompute and redraw. full: also rebuild the sidebar (a button changed); a dragged slider keeps its focus. */
function update(full){
  REFINE.defer = !full;
  D = derive();
  save();
  if(full) buildSide();
  syncReadouts(); drawLayout(D); drawRatioPlot(); drawSheet(D);
  clearTimeout(pendingTimer);
  if(REFINE.pending.size) pendingTimer = setTimeout(function step(){ const more = runPending(); if(!more){ D = derive(); syncReadouts(); drawLayout(D); drawSheet(D); } else pendingTimer = setTimeout(step, 0); }, 150);
}
function syncReadouts(){
  const fr = powerSplit(S.ratioDB), r = 10 ** (S.ratioDB / 10);
  $('ratioVal').textContent = 'P2:P3 = ' + ratioText(S.ratioDB) + '  (' + fmt(S.ratioDB, 2) + ' dB)';
  $('ratioPct').textContent = (fr[0] * 100).toFixed(1) + ' / ' + (fr[1] * 100).toFixed(1) + ' %';
  const t = $('ratioText'); if(t && document.activeElement !== t){ t.value = ratioText(S.ratioDB); t.classList.remove('invalid'); }
  const m = microstrip(S.z0, S.er, S.h, S.f0, S.msModel);
  $('subInfo').textContent = 'εr ' + S.er + ', h ' + S.h + ' mm, f0 ' + (S.f0 / 1e9).toFixed(2) + ' GHz · Z0 line W ' + m.W.toFixed(2) + ' mm';
  const st = D.design.stage, s21 = cabs(mget(D.S0, 1, 0)), s31 = cabs(mget(D.S0, 2, 0));
  $('layoutInfo').textContent = `S21 ${fmt(dB20(s21), 2)} dB · S31 ${fmt(dB20(s31), 2)} dB · R ${st.res.filter(x => x != null).map(x => x.toFixed(1)).join(' / ')} Ω` +
    (st.refined === false ? ' (refining…)' : '');
  const w = D.lay.warnings;
  $('warnBox').replaceChildren(...w.map(x => el('div', { class: 'warnline', text: '⚠ ' + x })));
  void r;
}
function applyTheme(dark){ document.body.classList.toggle('dark', dark); $('themeBtn').textContent = dark ? 'Light' : 'Dark'; $('themeBtn').setAttribute('aria-label', 'Switch to ' + (dark ? 'light' : 'dark') + ' theme'); }
$('themeBtn').addEventListener('click', () => { applyTheme(!document.body.classList.contains('dark')); });
addEventListener('resize', () => { if(D){ drawLayout(D); drawRatioPlot(); } });
applyTheme(false);
update(true);

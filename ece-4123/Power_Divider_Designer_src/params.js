/* Power Divider Designer — Parameters page: one table a student could build from (F6), the substrate block, totals,
   CSV export and a printable page. */
function sheetRows(D){
  const lg = Z => msFactory()(Z).lambdaG, rows = [];
  const name = e => {
    if(e.role === 'arm' || e.role === 'xfmr' || e.role === 'eq'){
      const j = e.id.split('.')[0], where = j === 'x' ? '' : 'J' + (j.slice(1) || 'root') + ' ';
      return where + ({ arm: 'arm', xfmr: 'transformer', eq: 'λ/4 line' }[e.role]) + ' ' + (e.arm + 1) + '·' + (e.k + 1);
    }
    if(e.role === 'stub') return 'output stub ' + (e.id.startsWith('sb') ? (e.id.slice(2, -1) || 'root') + '→' + (+e.id.slice(-1) + 1) : 'P' + (+e.id.slice(-1) + 2)) + (e.model ? '' : ' (not modelled)');
    if(e.role === 'ic') return 'interconnect ' + (e.id.slice(2, -1) || 'root') + '→' + (+e.id.slice(-1) + 1);
    if(e.role === 'out') return 'output line P' + (e.port + 2) + (e.delay > 1e-3 ? ' (delay ' + e.delay.toFixed(2) + ' mm)' : '');
    return null;
  };
  D.lay.els.forEach(e => {
    const nm = name(e); if(!nm) return;
    const Z = e.Z || S.z0, th = 360 * e.path.len / lg(Z);
    rows.push({ id: e.id, el: nm, Z, W: e.W, L: e.path.len, th, shape: e.role === 'arm' || e.role === 'xfmr' || e.role === 'eq' ? shapeSpec(e) : e.role === 'stub' ? 'straight, at the arm width' : 'straight z₀ line' + (e.delay > 1e-3 ? ' + serpentine' : ''),
      res: '', warn: (e.warn || []).join('; ') });
  });
  D.lay.res.forEach(r => rows.push({ id: r.id, el: 'resistor ' + r.id.replace(/^x\./, ''), Z: null, W: null, L: null, th: null, shape: '', res: r.R.toFixed(1) + ' Ω, ' + S.fp, warn: '' }));
  return rows;
}
function drawParams(D){
  const rows = sheetRows(D), m0 = msFactory()(S.z0), bb = D.lay.bbox, rb = D.ref.bbox, tt = D.lay.totals;
  const f = (v, d) => v == null ? '' : v.toFixed(d);
  const body = rows.map(r => `<tr data-id="${r.id}" class="${r.warn ? 'warnrow' : ''}"><td>${r.el}</td><td>${f(r.Z, 1)}</td><td>${f(r.W, 3)}</td><td>${f(r.L, 2)}</td><td>${f(r.th, 1)}</td>` +
    `<td class="l">${r.shape}${r.warn ? '<br><span class="bad">⚠ ' + r.warn + '</span>' : ''}</td><td>${r.res}</td></tr>`).join('');
  $('paramsBody').innerHTML = `
    <div class="sheet-head">
      <div><h2>Design parameters</h2><p class="num">${designLabel(D)} · f₀ = ${(S.f0 / 1e9).toFixed(3)} GHz · Z₀ = ${S.z0} Ω · input ${fmtW(pinW())}</p></div>
      <div class="row"><button id="csvBtn">Export CSV</button><button id="printBtn">Print</button></div>
    </div>
    <div class="blocks">
      <section><h4>Substrate</h4><table class="sheet"><tbody>
        <tr><td>ε<sub>r</sub></td><td>${S.er}</td></tr><tr><td>h</td><td>${S.h} mm</td></tr>
        <tr><td>model</td><td>${MS_MODEL_NAME[S.msModel]}</td></tr>
        <tr><td>ε<sub>eff</sub> (Z₀ line)</td><td>${m0.eeff.toFixed(3)}</td></tr><tr><td>λ<sub>g</sub> (Z₀ line)</td><td>${m0.lambdaG.toFixed(2)} mm</td></tr>
        <tr><td>W (Z₀ line)</td><td>${m0.W.toFixed(3)} mm</td></tr></tbody></table></section>
      <section><h4>Totals</h4><table class="sheet"><tbody>
        <tr><td>footprint</td><td>${bb.w.toFixed(2)} × ${bb.h.toFixed(2)} mm = ${bb.area.toFixed(0)} mm²</td></tr>
        <tr><td>straight layout</td><td>${rb.w.toFixed(2)} × ${rb.h.toFixed(2)} mm = ${rb.area.toFixed(0)} mm² (${fmt((1 - bb.area / rb.area) * 100, 1)} % saved)</td></tr>
        <tr><td>trace length</td><td>${tt.sec.toFixed(1)} mm in the λ/4 sections, ${tt.all.toFixed(1)} mm in all traces</td></tr>
        <tr><td>resistors</td><td>${resistorCount(D.design)} × ${S.fp}</td></tr></tbody></table></section>
    </div>
    <table class="sheet full"><thead><tr><th>Element</th><th>Z (Ω)</th><th>W (mm)</th><th>Length (mm)</th><th>Electrical length (°)</th><th class="l">Shape and radius or meander spec</th><th>Resistor</th></tr></thead>
    <tbody>${body}</tbody></table>
    <p class="hint">Length is the centreline length; electrical length is 360° × length / λ<sub>g</sub> of that width at f₀. Junction bars, pads, launches, bends and coupling are drawn but not in the circuit model.</p>
    <div id="printLayout"></div>`;
  $('csvBtn').addEventListener('click', () => downloadCsv(D, rows));
  $('printBtn').addEventListener('click', () => { printLayoutCopy(); window.print(); });
}
function csvCell(v){ const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function downloadCsv(D, rows){
  const lines = [['Power Divider Designer ' + document.querySelector('meta[name=version]').content], [designLabel(D)],
    ['f0 (GHz)', S.f0 / 1e9], ['Z0 (ohm)', S.z0], ['er', S.er], ['h (mm)', S.h], ['model', MS_MODEL_NAME[S.msModel]], [],
    ['Element', 'Z (ohm)', 'W (mm)', 'Length (mm)', 'Electrical length (deg)', 'Shape', 'Resistor']]
    .concat(rows.map(r => [r.el, r.Z == null ? '' : r.Z.toFixed(2), r.W == null ? '' : r.W.toFixed(4), r.L == null ? '' : r.L.toFixed(3), r.th == null ? '' : r.th.toFixed(2), r.shape, r.res]))
    .concat([[], ['footprint (mm)', D.lay.bbox.w.toFixed(2), D.lay.bbox.h.toFixed(2)], ['trace length (mm)', D.lay.totals.all.toFixed(2)]]);
  const blob = new Blob([lines.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'power_divider_parameters.csv' }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
// A copy of the layout drawing for the printed page.
function printLayoutCopy(){ const src = $('layout'), box = $('printLayout'); if(!src || !box) return; const c = src.cloneNode(true); c.removeAttribute('id'); c.setAttribute('width', '100%'); c.setAttribute('height', '120mm'); box.replaceChildren(c); }

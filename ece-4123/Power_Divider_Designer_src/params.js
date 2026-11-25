/* Power Divider Designer — Parameters page: one table a student could build from (F6), the substrate block, totals,
   CSV export and a printable page. */
/* The name of a layout element on the Parameters sheet (also used by the Designer warnings), or null for an element
   the sheet does not list. */
function sheetName(e){
  if(e.role === 'arm' || e.role === 'xfmr' || e.role === 'eq'){
    const j = e.id.split('.')[0], where = j === 'x' ? '' : 'J' + (j.slice(1) || 'root') + ' ';
    return where + ({ arm: 'arm', xfmr: 'transformer', eq: 'λ/4 line' }[e.role]) + ' ' + (e.arm + 1) + '·' + (e.k + 1);
  }
  if(e.role === 'stub') return 'output stub ' + (e.id.startsWith('sb') ? (e.id.slice(2, -1) || 'root') + '→' + (+e.id.slice(-1) + 1) : 'P' + (+e.id.slice(-1) + 2)) + (e.model ? '' : ' (not modelled)');
  if(e.role === 'ic') return 'interconnect ' + (e.id.slice(2, -1) || 'root') + '→' + (+e.id.slice(-1) + 1);
  if(e.role === 'out') return 'output line P' + (e.port + 2) + (e.delay > 1e-3 ? ' (delay ' + e.delay.toFixed(2) + ' mm)' : '');
  return null;
}
// The rows of the build sheet; ms is one microstrip factory for the whole sheet (CQ-PDD-011).
function sheetRows(D, ms){
  // Guided wavelength (mm) of a line of impedance Z.
  const lg = Z => ms(Z).lambdaG, rows = [];
  D.lay.els.forEach(e => {
    const nm = sheetName(e); if(!nm) return;
    const Z = e.Z || S.z0, th = 360 * e.path.len / lg(Z);
    rows.push({ id: e.id, el: nm, Z, W: e.W, L: e.path.len, th, shape: e.role === 'arm' || e.role === 'xfmr' || e.role === 'eq' ? shapeSpec(e) : e.role === 'stub' ? 'straight, at the arm width' : 'straight z₀ line' + (e.delay > 1e-3 ? ' + serpentine' : ''),
      res: '', warn: (e.warn || []).join('; ') });
  });
  D.lay.res.forEach(r => rows.push({ id: r.id, el: 'resistor ' + r.id.replace(/^x\./, ''), Z: null, W: null, L: null, th: null, shape: '', res: r.R.toFixed(1) + ' Ω, ' + S.fp, warn: '' }));
  return rows;
}
/* Shown precision of each sheet column, shared by the page and the CSV so one quantity reads the same in both
   (DEFECT-PDD-010). */
const SHEET_DP = { Z: 1, W: 3, L: 2, th: 1, fp: 2, trace: 1 };
// Parameters page: build sheet, substrate and totals blocks, CSV and print buttons (DOM built with createElement).
function drawParams(D){
  const ms = msFactory(), rows = sheetRows(D, ms), m0 = ms(S.z0), bb = D.lay.bbox, rb = D.ref.bbox, tt = D.lay.totals;
  // A number to d decimals, or empty.
  const f = (v, d) => v == null ? '' : v.toFixed(d);
  const body = rows.map(r => ({ attrs: { 'data-id': r.id }, cls: r.warn ? 'warnrow' : null, cells: [{ text: r.el }, f(r.Z, SHEET_DP.Z), f(r.W, SHEET_DP.W), f(r.L, SHEET_DP.L), f(r.th, SHEET_DP.th),
    { cls: 'l', t: r.shape + (r.warn ? '<br><span class="bad">⚠ ' + r.warn + '</span>' : '') }, { text: r.res }] }));
  // A key-value table (values wrap).
  const kvt = list => table('sheet kv', null, list.map(([k, v]) => ({ cells: [k, { text: v }] })));
  const csv = el('button', { id: 'csvBtn', text: 'Export CSV', on: { click: () => downloadCsv(D, rows) } });
  const prn = el('button', { id: 'printBtn', text: 'Print', on: { click: () => { printLayoutCopy(); window.print(); } } });
  $('paramsBody').replaceChildren(
    el('div', { class: 'sheet-head' },
      el('div', {}, el('h2', { text: 'Design parameters' }), el('p', { class: 'num', text: designLabel(D) + ' · f₀ = ' + (S.f0 / 1e9).toFixed(3) + ' GHz · Z₀ = ' + S.z0 + ' Ω · input ' + fmtW(pinW()) })),
      el('div', { class: 'row' }, csv, prn)),
    el('div', { class: 'blocks' },
      el('section', {}, el('h4', { text: 'Substrate' }), kvt([['ε<sub>r</sub>', String(S.er)], ['h', S.h + ' mm'], ['model', MS_MODEL_NAME[S.msModel]],
        ['ε<sub>eff</sub> (Z₀ line)', m0.eeff.toFixed(3)], ['λ<sub>g</sub> (Z₀ line)', m0.lambdaG.toFixed(2) + ' mm'], ['W (Z₀ line)', m0.W.toFixed(3) + ' mm']]
        .concat(m0.zCheck != null ? [['Z₀ check (L07)', m0.zCheck.toFixed(1) + ' Ω']] : []))),
      el('section', {}, el('h4', { text: 'Totals' }), kvt([
        ['footprint', bb.w.toFixed(SHEET_DP.fp) + ' × ' + bb.h.toFixed(SHEET_DP.fp) + ' mm = ' + bb.area.toFixed(0) + ' mm²'],
        ['straight layout', rb.w.toFixed(SHEET_DP.fp) + ' × ' + rb.h.toFixed(SHEET_DP.fp) + ' mm = ' + rb.area.toFixed(0) + ' mm² (' + fmt((1 - bb.area / rb.area) * 100, 1) + ' % saved)'],
        ['trace length', tt.sec.toFixed(SHEET_DP.trace) + ' mm in the λ/4 sections, ' + tt.all.toFixed(SHEET_DP.trace) + ' mm in all traces'],
        ['resistors', resistorCount(D.design) + ' × ' + S.fp]]))),
    table('sheet full', ['Element', 'Z (Ω)', 'W (mm)', 'Length (mm)', 'Electrical length (°)', { t: 'Shape and radius or meander spec', cls: 'l' }, 'Resistor'], body),
    el('p', { class: 'hint' }, rich('Length is the centreline length; electrical length is 360° × length / λ<sub>g</sub> of that width at f₀. Junction bars, pads, launches, bends and coupling are drawn but not in the circuit model.')),
    el('div', { id: 'printLayout' }));
}
// One CSV cell, quoted when it holds a quote, comma or new line.
function csvCell(v){ const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
// Download the build sheet as CSV.
function downloadCsv(D, rows){
  const lines = [['Power Divider Designer ' + document.querySelector('meta[name=version]').content], [designLabel(D)],
    ['f0 (GHz)', S.f0 / 1e9], ['Z0 (ohm)', S.z0], ['er', S.er], ['h (mm)', S.h], ['model', MS_MODEL_NAME[S.msModel]], [],
    ['Element', 'Z (ohm)', 'W (mm)', 'Length (mm)', 'Electrical length (deg)', 'Shape', 'Resistor']]
    .concat(rows.map(r => [r.el, r.Z == null ? '' : r.Z.toFixed(SHEET_DP.Z), r.W == null ? '' : r.W.toFixed(SHEET_DP.W), r.L == null ? '' : r.L.toFixed(SHEET_DP.L), r.th == null ? '' : r.th.toFixed(SHEET_DP.th), r.shape, r.res]))
    .concat([[], ['footprint (mm)', D.lay.bbox.w.toFixed(SHEET_DP.fp), D.lay.bbox.h.toFixed(SHEET_DP.fp)], ['trace length (mm)', D.lay.totals.all.toFixed(SHEET_DP.trace)]]);
  const blob = new Blob([lines.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
  const a = el('a', { href: URL.createObjectURL(blob), download: 'power_divider_parameters.csv' }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
// A copy of the layout drawing for the printed page.
function printLayoutCopy(){ const src = $('layout'), box = $('printLayout'); if(!src || !box) return; const c = src.cloneNode(true); c.removeAttribute('id'); c.setAttribute('width', '100%'); c.setAttribute('height', '120mm'); box.replaceChildren(c); }

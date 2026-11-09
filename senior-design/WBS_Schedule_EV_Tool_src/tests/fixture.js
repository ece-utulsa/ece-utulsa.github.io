// The lecture's week-6 team (briefing T1) built through the model functions. Shared by the build checks.
// Returns serialized project JSON. Load model.js and ev.js into the same context first.
function t1Project(){
  const p = newProject('Team Volta'); p.members = ['Ana', 'Ben', 'Cy', 'Dee'];
  let ix = indexTree(p); const sub = n => ix.order.find(e => ix.num.get(e.id) === n).id;
  const rows = [['1.1', 'Requirements and specification', 1, 2, 'finished', 'Ana'], ['1.1', 'Concepts and trade study', 2, 4, 'finished', 'Ben'],
    ['1.2', 'Power budget analysis', 3, 4, 'finished', 'Cy'], ['1.3', 'Circuit simulation', 4, 6, 'finished', 'Dee'],
    ['1.4', 'Schematic capture', 5, 6, 'started', 'Ana'], ['1.4', 'PCB layout', 6, 8, 'not', 'Ben'], ['2.1', 'Test plan draft', 5, 6, 'not', 'Cy'],
    ['3.1', 'Parts list and lead times', 5, 7, 'started', 'Dee'], ['4.1', 'Status reports, weeks 1-6', 1, 6, 'finished', 'Ana'],
    ['4.2', 'WBS and schedule baseline', 1, 2, 'finished', 'Ben']];
  const ids = rows.map(r => { const e = addElement(p, sub(r[0]), r[1], true); Object.assign(e.pkg, { start: r[2], finish: r[3], owner: r[5], deliverable: 'Document' }); return e.id; });
  p.elements.find(e => e.id === ids[4]).pkg.preds = [ids[3]];
  const subs = ['1.4', '1.5', '2.2', '2.3', '3.2', '3.3', '4.3', '2.2'];
  for(let i = 0; i < 30; i++){ const e = addElement(p, sub(subs[i % 8]), 'Task ' + (i + 1), true); Object.assign(e.pkg, { start: 7 + i % 8, finish: 8 + i % 8, owner: p.members[i % 4], deliverable: 'x' }); }
  const ms = addElement(p, sub('1.5'), 'PDR', true, 'milestone'); ms.pkg.start = ms.pkg.finish = 8;
  const ld = addElement(p, sub('3.2'), 'Board order', true, 'lead'); ld.pkg.start = 9; ld.pkg.finish = 11;
  addBaseline(p, 'Initial baseline', '2026-09-01');
  rows.forEach((r, i) => { if(r[4] === 'started') setStatus(p, ids[i], 5, 'started');
    if(r[4] === 'finished'){ setStatus(p, ids[i], r[2], 'started'); setStatus(p, ids[i], Math.min(r[3], 6), 'finished'); } });
  p.currentWeek = 6;
  return serialize(p);
}

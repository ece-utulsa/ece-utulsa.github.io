/* ════════════════════════════════════════════════════════════════════════════════════════════
   example.js — the built-in lecture example: the week-6 team from the Earned Value lectures (main briefing T1,
   change briefing C3). 40 tasks, plan finish week 15, current week 6, baseline 1. The ten named tasks are exactly
   the T1 table; the other 30 are believable Senior Design work packages that all start at week 7 or later.
   No DOM: Test can call lectureExample() directly.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const EXAMPLE_NAME = 'Lecture example: week-6 team';

/* [sub-area, name, type, start, finish, owner, deliverable, predecessor keys, key, status at week 6]
   status: 'f' finished (started at its start week, finished at its finish week), 's' started at week 5, '' not started. */
const EXAMPLE_ROWS = [
  // the ten tasks of the T1 table (all the tasks planned to start by week 6)
  ['1.1', 'Requirements and specification', 'task', 1, 2, 'Ana', 'Requirements document, signed by the customer', [], 'req', 'f'],
  ['1.1', 'Concepts and trade study', 'task', 2, 4, 'Ben', 'Trade-study matrix and chosen concept', [], 'trade', 'f'],
  ['1.2', 'Power budget analysis', 'task', 3, 4, 'Cara', 'Power budget spreadsheet', [], 'power', 'f'],
  ['1.3', 'Circuit simulation', 'task', 4, 6, 'Dev', 'SPICE results and summary memo', [], 'sim', 'f'],
  ['1.4', 'Schematic capture', 'task', 5, 6, 'Ana', 'Reviewed schematic (PDF)', [], 'sch', 's'],
  ['1.4', 'PCB layout', 'task', 6, 8, 'Ben', 'PCB layout and Gerber files', [], 'pcb', ''],
  ['2.1', 'Test plan draft', 'task', 5, 6, 'Cara', 'Test plan, draft 1', [], 'tplan', ''],
  ['3.1', 'Parts list and lead times', 'task', 5, 7, 'Dev', 'Parts list with suppliers and lead times', [], 'parts', 's'],
  ['4.1', 'Status reports, weeks 1–6', 'task', 1, 6, 'Ana', 'Six weekly status reports', [], 'rep1', 'f'],
  ['4.2', 'WBS and schedule baseline', 'task', 1, 2, 'Ben', 'Baselined WBS and schedule', [], 'wbs', 'f'],
  // the other 30 tasks, weeks 7–15
  ['1.2', 'Thermal analysis', 'task', 7, 8, 'Cara', 'Thermal analysis memo', [], '', ''],
  ['1.2', 'Worst-case and tolerance analysis', 'task', 8, 9, 'Dev', 'Worst-case analysis spreadsheet', [], '', ''],
  ['1.3', 'Control loop simulation', 'task', 7, 8, 'Ana', 'Loop stability plots (Bode, step response)', [], '', ''],
  ['1.4', 'Enclosure CAD model', 'task', 7, 8, 'Cara', 'Enclosure CAD model and drawings', [], 'cad', ''],
  ['1.4', 'Firmware architecture', 'task', 7, 8, 'Dev', 'Firmware architecture document', [], 'fwarch', ''],
  ['1.4', 'Firmware drivers', 'task', 9, 10, 'Ana', 'Driver code in the team repository', ['fwarch'], 'fwdrv', ''],
  ['1.4', 'Bill of materials', 'task', 7, 7, 'Ben', 'Bill of materials, revision A', ['sch'], '', ''],
  ['1.5', 'CDR package and rehearsal', 'task', 8, 9, 'Cara', 'CDR slides, rehearsed', [], 'cdrpkg', ''],
  ['1.5', 'Design review action items', 'task', 11, 11, 'Dev', 'Closed action-item list', ['cdr'], '', ''],
  ['2.1', 'Test plan review and sign-off', 'task', 7, 7, 'Ana', 'Signed test plan', ['tplan'], 'tsign', ''],
  ['2.1', 'Test fixtures and procedures', 'task', 8, 9, 'Ben', 'Test fixtures and written procedures', ['tsign'], '', ''],
  ['2.2', 'Bring-up and power test', 'task', 13, 13, 'Cara', 'Bring-up checklist and power readings', ['pcba'], 'bringup', ''],
  ['2.2', 'Firmware unit tests', 'task', 11, 12, 'Dev', 'Unit test report', ['fwdrv'], '', ''],
  ['2.2', 'Functional test of the prototype', 'task', 14, 14, 'Ana', 'Functional test data sheet', ['bringup'], 'func', ''],
  ['2.2', 'Environmental and thermal test', 'task', 14, 15, 'Ben', 'Environmental test data sheet', ['bringup'], '', ''],
  ['2.3', 'Test data analysis', 'task', 15, 15, 'Cara', 'Results compared with requirements', ['func'], '', ''],
  ['2.3', 'Final test report draft', 'task', 15, 15, 'Dev', 'Final test report, draft 1', [], '', ''],
  ['3.1', 'Assembly plan and work instructions', 'task', 8, 9, 'Ana', 'Assembly work instructions', ['parts'], '', ''],
  ['3.2', 'Order PCB and parts', 'task', 9, 9, 'Ben', 'Purchase orders placed', ['pcb'], 'order', ''],
  ['3.2', 'Receive and inspect parts', 'task', 12, 12, 'Cara', 'Receiving inspection log', ['fab'], '', ''],
  ['3.3', 'PCB assembly', 'task', 12, 12, 'Dev', 'Assembled boards', ['fab'], 'pcba', ''],
  ['3.3', 'Enclosure fabrication', 'task', 10, 11, 'Ana', 'Machined enclosure', ['cad'], 'encl', ''],
  ['3.3', 'Final assembly and wiring', 'task', 13, 14, 'Ben', 'Assembled prototype', ['pcba', 'encl'], '', ''],
  ['4.1', 'Status reports, weeks 7–15', 'task', 7, 15, 'Cara', 'Nine weekly status reports', ['rep1'], '', ''],
  ['4.1', 'Midterm presentation', 'task', 8, 8, 'Dev', 'Midterm presentation slides', [], '', ''],
  ['4.1', 'Final presentation and poster', 'task', 14, 15, 'Ana', 'Final presentation and poster', [], '', ''],
  ['4.2', 'Schedule review and update', 'task', 9, 9, 'Ben', 'Updated schedule and earned value', [], '', ''],
  ['4.3', 'Customer requirements review', 'task', 7, 7, 'Cara', 'Meeting minutes', [], '', ''],
  ['4.3', 'Customer design review', 'task', 10, 10, 'Dev', 'Customer comments on the design', [], '', ''],
  ['4.3', 'Customer demo and hand-over', 'task', 15, 15, 'Ben', 'Hand-over checklist, signed', [], '', ''],
  // milestones and lead time (shown on the schedule, not tasks)
  ['1.5', 'PDR', 'milestone', 4, 4, '', 'Preliminary design review held', [], 'pdr', 'f'],
  ['1.5', 'CDR', 'milestone', 10, 10, '', 'Critical design review held', ['cdrpkg'], 'cdr', ''],
  ['1.5', 'Final demo', 'milestone', 15, 15, '', 'Final demonstration', ['func'], '', ''],
  ['3.2', 'PCB fabrication and shipping', 'lead', 10, 11, 'Ben', 'Boards delivered', ['order'], 'fab', ''],
];

/** The lecture example as a project. Status: finished tasks started at their start week and finished at their finish
    week; started tasks were marked started in week 5. */
function lectureExample(){
  const p = newProject(EXAMPLE_NAME);
  p.example = true;
  p.members = ['Ana', 'Ben', 'Cara', 'Dev'];
  const ix = indexTree(p), sub = n => ix.order.find(e => ix.num.get(e.id) === n).id;
  const byKey = {}, made = [];
  for(const r of EXAMPLE_ROWS){
    const [area, name, type, s, f, owner, deliv, , key] = r;
    const e = addElement(p, sub(area), name, true, type);
    Object.assign(e.pkg, { start: s, finish: f, owner, deliverable: deliv });
    if(key) byKey[key] = e.id;
    made.push([e, r]);
  }
  for(const [e, r] of made) e.pkg.preds = r[7].map(k => byKey[k]);
  addBaseline(p, 'Initial baseline, agreed at PDR', '2026-09-04');
  for(const [e, r] of made){
    if(r[9] === 'f'){ setStatus(p, e.id, r[3], 'started'); setStatus(p, e.id, r[4], 'finished'); }
    else if(r[9] === 's') setStatus(p, e.id, 5, 'started');
  }
  p.currentWeek = 6;
  return p;
}

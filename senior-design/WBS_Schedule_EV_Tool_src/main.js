/* ════════════════════════════════════════════════════════════════════════════════════════════
   main.js — the help panel (lecture terms, template, 50/50 rule, equations as MathML), the top bar, tabs,
   the render cycle with focus kept across redraws, and start-up.
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const MATHNS = 'http://www.w3.org/1998/Math/MathML';
/** Tiny MathML builder: m('mi','PV') etc. */
function m(tag, ...kids){
  const el = document.createElementNS(MATHNS, tag);
  for(const k of kids) el.append(typeof k === 'string' ? document.createTextNode(k) : k);
  return el;
}
const mi = t => m('mi', t), mo = t => m('mo', t), mn = t => m('mn', t);
const sub = (a, b) => m('msub', mi(a), mi(b));
const frac = (a, b) => m('mfrac', a, b);
const row = (...k) => m('mrow', ...k);
function eq(...k){ const e = m('math', row(...k)); e.setAttribute('display', 'block'); return h('div', { class: 'eq' }, e); }

function buildHelp(){
  const B = $('helpBody');
  clear(B);
  append(B, [
    h('p', null, 'This tool follows the Senior Design 1 lectures: ', h('b', null, 'Work Breakdown Structure'), ', ', h('b', null, 'Earned Value'), ' and ', h('b', null, 'Earned Value Equations'), '. ',
      'Earned value is counted in ', h('b', null, 'tasks'), ', not hours: there are no time cards.'),
    h('h3', null, 'The weekly routine (about 10 minutes)'),
    h('p', null, 'Week 0 is for planning: build the WBS, schedule it and baseline it. Then move to week 1 (the + button in the top bar).'),
    h('ol', null, h('li', null, 'Set the current week in the top bar.'), h('li', null, 'On ', h('b', null, '4 This week'), ', mark each open task not started, started or finished.'),
      h('li', null, 'Read the four counts and the measures, then print ', h('b', null, '6 Status report'), ' for the weekly status report.'), h('li', null, 'Save the project file.')),
    h('h3', null, 'Senior Design template'),
    h('ul', null, TEMPLATE.map(([a, subs], i) => h('li', null, h('b', null, `${i + 1}.0 ${a}: `), subs.map((x, j) => `${i + 1}.${j + 1} ${x}`).join(', ')))),
    h('p', null, 'Add your work packages under the sub-areas. The lowest level is the ', h('b', null, 'work package'), ', which is one ', h('b', null, 'task'),
      ' in earned value: one owner, planned start and finish weeks, a deliverable and its predecessors. Every task counts the same, so keep tasks similar in size (2 weeks or less). ',
      'Milestones (PDR, CDR, final demo) and lead-time items (a part order) are shown on the schedule but are not tasks.'),
    h('h3', null, 'The 50/50 rule'),
    h('p', null, 'A task earns half when it is started and the other half when it is finished. The four counts, cumulative to the end of week w, from the active baseline:'),
    h('ul', null, h('li', null, h('b', null, 'Sp'), ' tasks planned to start; ', h('b', null, 'Fp'), ' tasks planned to finish;'),
      h('li', null, h('b', null, 'Sa'), ' tasks actually started (or finished); ', h('b', null, 'Fa'), ' tasks actually finished.'),
      h('li', null, h('b', null, 'BAC'), ' is the number of tasks in the baseline; ', h('b', null, 'T'), ' is the planned duration, the latest baseline finish week.')),
    eq(mi('PV'), mo('='), frac(mn('1'), mn('2')), mo('('), sub('S', 'p'), mo('+'), sub('F', 'p'), mo(')'), m('mspace', ''), mi('EV'), mo('='), frac(mn('1'), mn('2')), mo('('), sub('S', 'a'), mo('+'), sub('F', 'a'), mo(')')),
    h('h3', null, 'Measures'),
    eq(mi('SV'), mo('='), mi('EV'), mo('−'), mi('PV')),
    eq(mi('SV%'), mo('='), frac(mi('SV'), mi('PV')), mo('×'), mn('100')),
    eq(mi('SPI'), mo('='), frac(mi('EV'), mi('PV'))),
    eq(mi('% complete'), mo('='), frac(mi('EV'), mi('BAC')), mo('×'), mn('100')),
    eq(mi('SR'), mo('='), frac(sub('S', 'a'), sub('S', 'p')), m('mspace', ''), mi('FR'), mo('='), frac(sub('F', 'a'), sub('F', 'p'))),
    eq(sub('T', 'f'), mo('='), frac(mi('T'), mi('SPI')), m('mspace', ''), mi('tasks to go'), mo('='), mi('BAC'), mo('−'), mi('EV')),
    eq(mi('TSPI'), mo('='), frac(row(mi('BAC'), mo('−'), mi('EV')), row(mi('BAC'), mo('−'), mi('PV')))),
    h('p', null, 'A measure that would divide by zero shows ', h('i', null, 'not yet defined'), ': SPI and SV% when PV = 0, SR when Sp = 0, FR when Fp = 0, Tf when SPI = 0, and TSPI when BAC = PV (', h('i', null, 'plan complete'), '). Week 0 is the planning week: build the WBS and baseline it there; every measure is undefined until week 1.'),
    h('h3', null, 'Signal (start and finish quadrant)'),
    h('ul', null, h('li', null, h('b', null, 'On plan'), ': SR and FR both at least 1.'), h('li', null, h('b', null, 'Watch'), ': one of them below 1.'), h('li', null, h('b', null, 'Re-plan'), ': both below 1.'),
      h('li', null, 'When nothing is planned to finish yet (Fp = 0), progress is judged on getting tasks started: SR ≥ 1 is On plan, SR below 1 is Watch. The signal then says "(on starts)".')),
    h('h3', null, 'Files'),
    h('p', null, 'Your work autosaves in this browser, but browser storage can be cleared. ', h('b', null, 'Save'), ' writes the project file (JSON): that is the copy of record. Send it to your instructor, who opens it with ', h('b', null, 'Open'), '. ',
      h('b', null, 'Export CSV'), ' writes the WBS (to the chosen level), the status history or the weekly earned value table for a spreadsheet.'),
    h('h3', null, 'Keyboard'),
    h('p', null, 'Tab moves between controls. In the WBS tree, ↑ ↓ move between rows, → opens a branch, ← closes it or goes to the parent, Enter selects. Ctrl+S (⌘S) saves the project file.')]);
}

/* ── TOP BAR AND TABS ── */
function renderTop(){
  const ms = series(P, IX, SX)[P.currentWeek], chip = $('sig');
  chip.className = 'chip ' + signalClass(ms.signal);
  chip.textContent = P.currentWeek < 1 ? 'Week 0: planning' : `Week ${P.currentWeek}: ${signalText(ms)}`;
  chip.title = ms.basis === 'starts' ? 'Nothing is planned to finish yet, so progress is judged on starts (SR) alone.' : '';
  $('pname').textContent = P.name;
  const wk = $('wk'); wk.max = P.weeks; if(document.activeElement !== wk) wk.value = P.currentWeek;
  $('wkOf').textContent = `of ${P.weeks}`;
  $('wkDown').disabled = P.currentWeek <= 0; $('wkUp').disabled = P.currentWeek >= P.weeks;
  for(const b of document.querySelectorAll('#tabs [role=tab]')){
    const on = b.dataset.tab === V.tab;
    b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1;
    $('p-' + b.dataset.tab).classList.toggle('on', on);
  }
  showSaved();
}

const RENDER = { wbs: renderWbs, gantt: renderGantt, status: renderStatus, week: renderWeek, ev: renderEv, report: renderReport };

/** Redraw the top bar and the open tab, keeping keyboard focus on the same control. */
function render(){
  const a = document.activeElement, key = a && a.dataset ? a.dataset.key : null;
  renderTop();
  const panel = clear($('p-' + V.tab));
  RENDER[V.tab](panel);
  if(key && key !== 'wk'){ const el = document.querySelector(`[data-key="${CSS.escape(key)}"]`); if(el) el.focus(); }
}

function setTab(t){ V.tab = t; saveView(); render(); }

function wire(){
  $('wk').addEventListener('change', ev => change(() => { P.currentWeek = clampInt(ev.target.value, 0, P.weeks, P.currentWeek); }));
  $('wkDown').addEventListener('click', () => change(() => { P.currentWeek = Math.max(0, P.currentWeek - 1); }));
  $('wkUp').addEventListener('click', () => change(() => { P.currentWeek = Math.min(P.weeks, P.currentWeek + 1); }));
  $('bNew').addEventListener('click', newFile);
  $('bOpen').addEventListener('click', () => { $('file').value = ''; $('file').click(); });
  $('file').addEventListener('change', ev => openFile(ev.target.files[0]));
  $('bSave').addEventListener('click', saveFile);
  const closeMenu = () => { $('csvMenu').open = false; };
  $('cWbs').addEventListener('click', () => { closeMenu(); csvWbs(); });
  $('cStatus').addEventListener('click', () => { closeMenu(); csvStatus(); });
  $('cEv').addEventListener('click', () => { closeMenu(); csvEv(); });
  $('csvMenu').addEventListener('keydown', ev => { if(ev.key === 'Escape'){ closeMenu(); $('csvMenu').querySelector('summary').focus(); } });
  $('bPrint').addEventListener('click', () => window.print());
  $('bHelp').addEventListener('click', () => { $('help').showModal(); $('helpClose').focus(); });
  $('helpClose').addEventListener('click', () => $('help').close());
  const tabs = [...document.querySelectorAll('#tabs [role=tab]')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
    b.addEventListener('keydown', ev => {
      const j = ev.key === 'ArrowRight' ? (i + 1) % tabs.length : ev.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : ev.key === 'Home' ? 0 : ev.key === 'End' ? tabs.length - 1 : -1;
      if(j < 0) return; ev.preventDefault(); setTab(tabs[j].dataset.tab); tabs[j].focus();
    });
  });
  document.addEventListener('keydown', ev => { if((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's'){ ev.preventDefault(); saveFile(); } });
  window.addEventListener('beforeunload', () => { try { localStorage.setItem(LS_PROJECT, serialize(P)); } catch { /* ignore */ } });
}

loadView();
loadStart();
buildHelp();
wire();
render();

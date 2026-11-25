/* Power Divider Designer — Theory and Experiments pages (F8). Numbers that depend on the engine (resistor values,
   bandwidths) are computed when the page is built, so the text always agrees with the tool. */
// Rich-text span for mathematics (rendered by rich()).
const mth = s => `<span class="math">${s}</span>`;
// Usable −15 dB bandwidth (%) of an equal 2-way Wilkinson with M binomial sections, and its resistors.
function wilkRow(M, taperKind){
  const d = synthesize({ topology: 'wilkinson', N: 2, ratioDB: 0, M, taper: taperKind || 'binomial', gm: 0.1, z0: 50 });
  const net = buildNetwork(d, { z0: 50, resOn: true, rMult: 1 }), sw = sweep(net, 0.05, 1.95, 361, 0), bw = bandwidths(sw, -15);
  const s11 = bandwidthOf(sw.u, sw.u.map((u, k) => sdb(sw.S[k], 0, 0)), -20);
  let worst = -Infinity; sw.u.forEach((u, k) => { if(s11 && u >= s11.lo && u <= s11.hi) [[1, 1], [2, 2], [1, 2]].forEach(([i, j]) => { worst = Math.max(worst, sdb(sw.S[k], i, j)); }); });
  return { M, R: d.stage.res, use: bw.usable.bw ? bw.usable.bw.frac * 100 : 0, s11bw: bw.rows[0].bw ? bw.rows[0].bw.frac * 100 : 0, band20: s11 ? s11.frac * 100 : 0, worst };
}
const BEYOND = 'Beyond the lecture notes';             // tag on content the course decks do not cover (ruling PDD-1)
/* A document from blocks (no raw-HTML sink): ['h1'|'h2'|'p'|'eq'|'refs'|'lede', rich text, beyond?] | ['table', head, rows]
   | ['ul', [rich text]]. A block marked beyond carries a visible tag. */
function docBlocks(blocks){
  const art = el('article', { class: 'doc' }), tag = () => el('span', { class: 'beyond', text: BEYOND });
  blocks.forEach(([k, a, b]) => {
    if(k === 'table') art.append(table('sheet doc-t', a, b.map(cells => ({ cells }))));
    else if(k === 'ul') art.append(el('ul', {}, ...a.map(t => el('li', {}, rich(t)))));
    else { const tagName = { h1: 'h1', h2: 'h2', p: 'p', eq: 'div', refs: 'p', lede: 'p' }[k];
      const e = el(tagName, { class: { eq: 'eq', refs: 'refs', lede: 'lede' }[k] || null }, rich(a)); if(b) e.append(' ', tag()); art.append(e); }
  });
  return art;
}
// Theory page, with the tables computed by the engine when the page is built.
function buildTheory(){
  const rows = [1, 2, 3, 4].map(M => wilkRow(M));
  const rtab = rows.map(r => [String(r.M), r.R.map(x => x.toFixed(1)).join(' / '), r.band20.toFixed(1) + ' %', r.M === 1 ? '—' : fmt(r.worst, 1) + ' dB', r.s11bw.toFixed(1) + ' %', r.use.toFixed(1) + ' %']);
  $('theoryBody').replaceChildren(docBlocks([
  ['h1', 'Power dividers'],
  ['lede', 'A power divider takes one input and shares its power among N outputs. This tool designs four kinds — the Wilkinson, the lossless T-junction (branching line), the resistive divider and the corporate tree built from 2-way junctions — and draws each to scale in microstrip. Every curve comes from a circuit solve of the ideal-line model of the drawn design, not from a formula: bends, junction bars, width steps, SMA connectors and, on a single divider, the output stubs are drawn but not modelled (§9).'],
  ['p', 'Blocks tagged <b>' + BEYOND + '</b> go past the course decks; they are here because this is a design tool that bridges the decks to a real layout.'],

  ['h2', '1 · The three-port theorem'],
  ['p', 'A three-port cannot be at once lossless, reciprocal and matched at all three ports (Pozar §7.1). Every divider gives one property up:'],
  ['table', ['Divider', 'Lossless', 'Reciprocal', 'All ports matched', 'Outputs isolated', 'Gives up'], [
    ['Wilkinson', 'for a signal at the input; power entering an output is partly absorbed in R — of what a mismatched output reflects, only the odd-mode part (§4)', 'yes', 'yes', 'yes', 'losslessness (odd mode)'],
    ['Lossless T / branching line', 'yes', 'yes', 'input only', 'no', 'output match'],
    ['Resistive (Y or Δ)', 'no: half the power for N = 2', 'yes', 'yes', 'no (−6.02 dB between outputs)', 'losslessness'],
    ['Circulator (not here)', 'yes', 'no', 'yes', '—', 'reciprocity']]],

  ['h2', '2 · The Wilkinson: even and odd modes'],
  ['p', 'Drive ports 2 and 3 of the equal 2-way together (even mode): the two output nodes sit at the same voltage, no current flows in ' + mth('<i>R</i>') + ', and the plane of symmetry is an open circuit. Each half is a λ/4 line of ' + mth('<i>Z</i>') + ' between port 2 (' + mth('<i>Z</i><sub>0</sub>') + ') and the input seen as ' + mth('2<i>Z</i><sub>0</sub>') + ': it matches when ' + mth('<i>Z</i> = √2 <i>Z</i><sub>0</sub> = 70.7 Ω') + '.'],
  ['p', 'Drive them in antiphase (odd mode): the plane of symmetry is a virtual ground, so the λ/4 line is shorted at the input end and looks open at port 2; the half resistor ' + mth('<i>R</i>/2') + ' to ground is all port 2 sees, and it matches when ' + mth('<i>R</i> = 2<i>Z</i><sub>0</sub> = 100 Ω') + '.'],
  ['eq', mth('<i>S</i><sub>21</sub> = <i>S</i><sub>31</sub> = −j/√2 &nbsp;(−3.01 dB ∠−90°), &nbsp; <i>S</i><sub>11</sub> = <i>S</i><sub>22</sub> = <i>S</i><sub>33</sub> = <i>S</i><sub>23</sub> = 0')],
  ['p', 'For N outputs the arms are ' + mth('√<i>N</i> <i>Z</i><sub>0</sub>') + ' and a star of N resistors ' + mth('<i>R</i> = <i>Z</i><sub>0</sub>') + ' meets at a floating centre — not planar for N > 2 (air bridges).', true],

  ['h2', '3 · Unequal split'],
  ['p', 'Pozar §7.3 writes the split as ' + mth('<i>K</i><sup>2</sup> = <i>P</i><sub>3</sub>/<i>P</i><sub>2</sub>') + '. The ratio control reads P2 : P3, so ' + mth('<i>K</i><sup>2</sup>') + ' = 1/(P2 : P3): the control\'s 2:1 is ' + mth('<i>K</i><sup>2</sup> = 1/2') + ', and its 1:2 is ' + mth('<i>K</i><sup>2</sup> = 2') + '. The arms end, at the resistor plane, on ' + mth('<i>R</i><sub>2</sub> = <i>Z</i><sub>0</sub><i>K</i>') + ' (port 2) and ' + mth('<i>R</i><sub>3</sub> = <i>Z</i><sub>0</sub>/<i>K</i>') + ' (port 3):'],
  ['eq', mth('<i>Z</i><sub>03</sub> = <i>Z</i><sub>0</sub> √((1 + <i>K</i><sup>2</sup>)/<i>K</i><sup>3</sup>), &nbsp; <i>Z</i><sub>02</sub> = <i>K</i><sup>2</sup><i>Z</i><sub>03</sub> = <i>Z</i><sub>0</sub> √(<i>K</i>(1 + <i>K</i><sup>2</sup>)), &nbsp; <i>R</i> = <i>Z</i><sub>0</sub>(<i>K</i> + 1/<i>K</i>)')],
  ['p', 'λ/4 transformers ' + mth('<i>Z</i><sub>04</sub> = <i>Z</i><sub>0</sub>√<i>K</i>') + ' (port 2) and ' + mth('<i>Z</i><sub>05</sub> = <i>Z</i><sub>0</sub>/√<i>K</i>') + ' (port 3) bring both outputs back to ' + mth('<i>Z</i><sub>0</sub>') + '. At the control\'s 2:1 (' + mth('<i>K</i><sup>2</sup> = 1/2') + ') and 50 Ω: arms 51.5 Ω (port 2) and 103.0 Ω (port 3), ' + mth('<i>R</i>') + ' = 106.1 Ω, transformers 42.0 Ω (port 2) and 59.5 Ω (port 3). The weak arm narrows fast (0.65 mm at 2:1 on 1.6 mm FR-4, 0.14 mm at 4:1): beyond about 3:1–4:1 a thinner substrate or another topology is needed. The Designer flags any width below the minimum you set.'],
  ['p', 'Multisection unequal: both arms are the same normalised taper from ' + mth('(1 + <i>K</i><sup>2</sup>)/<i>K</i>') + ' to 1, scaled to their plane impedance, and the output transformers are tapers too; the resistors start from the scaled equal-split values and are refined with the full circuit solver (§5).', true],

  ['h2', '4 · Output mismatch: where the reflected power goes'],
  ['p', 'With matched, isolated outputs the input reflection is set by the loads alone:'],
  ['eq', mth('Γ<sub>in</sub> = <i>S</i><sub>21</sub><sup>2</sup> Γ<sub>2</sub> + <i>S</i><sub>31</sub><sup>2</sup> Γ<sub>3</sub> &nbsp; (equal split: Γ<sub>in</sub> = −(Γ<sub>2</sub> + Γ<sub>3</sub>)/2)')],
  ['p', '<b>A single mismatch is not hidden from the input.</b> Port 3 with |Γ<sub>3</sub>| = 0.5 reflects 0.25 × 50 % = 12.5 % of the input. That wave splits like any wave entering port 3: half (6.25 %) into ' + mth('<i>R</i>') + ', half (6.25 %) back to the source — |Γ<sub>in</sub>| = 0.25. The other output is untouched (50 %), and port 3 delivers 37.5 %. A <b>symmetric</b> mismatch (Γ<sub>2</sub> = Γ<sub>3</sub>) is pure even mode: nothing flows in ' + mth('<i>R</i>') + ', and all the reflected power (25 % at |Γ| = 0.5) returns to the input. The resistor absorbs the odd-mode part: it protects the <i>other</i> output, not the source.'],

  ['h2', '5 · Multisection: bandwidth and the isolation resistors', true],
  ['p', 'A single λ/4 section is narrowband. Cascading M sections with a binomial (maximally flat) or Chebyshev (equal-ripple) taper from ' + mth('<i>N Z</i><sub>0</sub>') + ' at the junction to ' + mth('<i>Z</i><sub>0</sub>') + ' widens the match, and a resistor at every section plane keeps the outputs matched and isolated (Cohn 1968).'],
  ['p', '<b>Method used here.</b> In the even mode one arm sees ' + mth('<i>N Z</i><sub>0</sub>') + ' at the junction end; in the odd mode the junction is a virtual ground and each resistor is a shunt ' + mth('<i>R</i>/2') + ' (2-way bridge) or ' + mth('<i>R</i>') + ' (star). With Γ<sub>e</sub> and Γ<sub>o</sub> seen from an output,'],
  ['eq', mth('<i>S</i><sub>jj</sub> = (Γ<sub>e</sub> + (<i>N</i> − 1)Γ<sub>o</sub>)/<i>N</i>, &nbsp; <i>S</i><sub>ij</sub> = (Γ<sub>e</sub> − Γ<sub>o</sub>)/<i>N</i>')],
  ['p', 'The resistors minimise the largest ' + mth('|<i>S</i><sub>jj</sub>|') + ' or ' + mth('|<i>S</i><sub>ij</sub>|') + ' over the band where ' + mth('|<i>S</i><sub>11</sub>| ≤ −20 dB') + ' (Nelder–Mead on ln <i>R</i>). For an unequal split they are then refined with the full three-port solver over the same band. Check against Cohn\'s closed form for his two-section 2:1-band design (sections 1.6398 and 1.2197 × <i>Z</i><sub>0</sub>): Cohn 98.0 / 241.0 Ω, this method 96.7 / 236 Ω, with the same worst odd-mode ripple (−28.9 dB).'],
  ['p', '<b>Why the −20 dB band.</b> Since Γ<sub>e</sub> has the magnitude of ' + mth('<i>S</i><sub>11</sub>') + ', ' + mth('|<i>S</i><sub>22</sub>|') + ' or ' + mth('|<i>S</i><sub>23</sub>|') + ' is at least ' + mth('|<i>S</i><sub>11</sub>|/2') + ' wherever Γ<sub>o</sub> is small: at the edge of the −15 dB ' + mth('<i>S</i><sub>11</sub>') + ' band that is already −21 dB, so −20 dB output match and isolation can be met only inside the band where ' + mth('<i>S</i><sub>11</sub>') + ' itself is below −20 dB.'],
  ['table', ['Sections (binomial, 50 Ω)', 'R, junction → output (Ω)', 'S11 ≤ −20 dB band', 'worst S22, S33, S23 in it', 'S11 −15 dB band', 'usable −15 dB band'], rtab],

  ['h2', '6 · Lossless T-junction and resistive divider'],
  ['p', 'T-junction (branching line): the output lines ' + mth('<i>Z</i><sub>i</sub> = <i>Z</i><sub>0</sub>/<i>p</i><sub>i</sub>') + ' (' + mth('<i>p</i><sub>i</sub>') + ' the share of power) are in parallel at the junction, so ' + mth('1/<i>Z</i><sub>2</sub> + 1/<i>Z</i><sub>3</sub> = 1/<i>Z</i><sub>0</sub>') + ' and the input is matched — but only while each line ends in its own ' + mth('<i>Z</i><sub>i</sub>') + '. λ/4 transformers ' + mth('√(<i>Z</i><sub>0</sub><i>Z</i><sub>i</sub>)') + ' make the outputs ' + mth('<i>Z</i><sub>0</sub>') + ' loads possible. The outputs stay unmatched (|<i>S</i><sub>22</sub>| = 0.5 for the equal split) and see each other (|<i>S</i><sub>23</sub>| = 0.5).'],
  ['p', 'Resistive divider: N + 1 resistors ' + mth('<i>R</i> = <i>Z</i><sub>0</sub>(<i>N</i> − 1)/(<i>N</i> + 1)') + ' from every port to a centre (Z₀/3 = 16.7 Ω for N = 2), or the equivalent Δ of ' + mth('<i>Z</i><sub>0</sub>(<i>N</i> − 1)') + ' between every pair. Every port is matched and ' + mth('|<i>S</i><sub>ij</sub>| = 1/<i>N</i>') + ': −6.02 dB for N = 2, half the input lost in the resistors, no isolation, and no frequency dependence.'],

  ['h2', '7 · Branching cascades (corporate trees)', true],
  ['p', 'N outputs from 2-way junctions: each junction splits its outputs ⌊n/2⌋ : ⌈n/2⌉ in the ratio of the power wanted below it — N = 3 is 1:2 then 1:1, N = 5 is 2:3, then 1:1 and 1:2 — and any junction\'s ratio can be edited (a tapered array feed sets them from an amplitude taper). The ideal split is ' + mth('10 log<sub>10</sub><i>N</i>') + ' dB per output for an equal split: that is arithmetic, not loss; the loss is what comes on top of it.'],
  ['ul', ['<b>Wilkinson modules</b> keep every port matched and isolated at every level.',
    '<b>Branching lines</b> are lossless and small, but each junction\'s outputs are unmatched: reflections between stages build up, and the outputs are neither matched nor isolated.',
    '<b>Resistive Y modules</b> lose 6.02 dB per stage: an 8-way resistive tree delivers −18.06 dB per output, against −9.03 dB.']],
  ['p', 'For equal phase at the outputs every path from input to output must have the same electrical length. Interconnects are z₀ lines whose real lengths are in the model; where paths differ (non-binary N, mixed modules, an edited ratio adding transformers) the tool adds a serpentine delay line to the shorter output lines. Turn it off, or add a path error, to see the phase imbalance.'],

  ['h2', '8 · Microstrip'],
  ['p', '<b>Course formulas</b> (default; lectures L06–L09): ' + mth('<i>W</i>/<i>h</i>') + ' from ' + mth('<i>Z</i>') + ' and ' + mth('ε<sub>r</sub>') + ' by the Wheeler–Hammerstad synthesis of L09 (the A branch for ' + mth('<i>W</i>/<i>h</i> < 2') + ', the B branch above); the quasi-static effective permittivity by the two-branch formula of L06,'],
  ['eq', mth('ε<sub>eff</sub> = (ε<sub>r</sub> + 1)/2 + (ε<sub>r</sub> − 1)/2 · [(1 + 12<i>h</i>/<i>W</i>)<sup>−1/2</sup> + 0.04(1 − <i>W</i>/<i>h</i>)<sup>2</sup>] &nbsp; for <i>W</i>/<i>h</i> ≤ 1; &nbsp; without the 0.04 term for <i>W</i>/<i>h</i> ≥ 1')],
  ['p', 'and, as the check L09 asks for, the characteristic impedance of the synthesised strip by the L07 formula (shown under the substrate controls and on the Parameters page). No dispersion, zero strip thickness. Each section\'s length is ' + mth('λ<sub>g</sub>/4 = <i>c</i>/(4<i>f</i><sub>0</sub>√ε<sub>eff</sub>)') + ' for its own width, so wider (lower-impedance) lines are slightly shorter.'],
  ['p', '<b>Hammerstad–Jensen + Kirschning–Jansen</b> (the second model): Hammerstad–Jensen (1980) gives ' + mth('<i>Z</i>(<i>W</i>/<i>h</i>)') + ' and ' + mth('ε<sub>eff</sub>') + ' to better than 0.2 %; the width is found by bisection and ' + mth('ε<sub>eff</sub>') + ' is raised to its value at f₀ by the Kirschning–Jansen (1982) dispersion model.', true],
  ['p', '<b>Where quasi-TEM stops.</b> The quasi-TEM picture weakens as frequency rises (L05). The tool warns, beside the outputs, when f₀ is above half of ' + mth('<i>f</i><sub>T</sub> = <i>c</i> tan<sup>−1</sup>ε<sub>r</sub> / (√2 π <i>h</i> √(ε<sub>r</sub> − 1))') + ', the frequency at which the strip couples strongly to the lowest TM surface wave (about 31 GHz for 1.6 mm FR-4; that TM0 wave has no cutoff and exists at every frequency), or when a λg/4 section is shorter than its own width or the substrate height. The numbers are still computed and shown; they are no longer a real board\'s.', true],

  ['h2', '9 · Folding the λ/4 lines', true],
  ['p', 'A λ/4 line can be bent into an arc (the two arms of a 2-way form the classic ring), a mitred bracket or a meander. The electrical length is held by keeping the <b>centreline</b> length at λ<sub>g</sub>/4 (a mitred corner counts to its sharp corner, a round corner along its arc). The footprint readout is the copper bounding box; "saved" compares it with the straight layout at the same port pitch.'],
  ['p', '<b>Limits.</b> Arcs need a radius of at least 3<i>W</i>; meander legs closer than 3<i>h</i> couple — coupling speeds the odd mode and shortens the line electrically; bends add capacitance (an optimum mitre, ' + mth('<i>m</i> = 52 + 65 e<sup>−1.35<i>W</i>/<i>h</i></sup>') + ' % of the diagonal, Douville & James 1978, cancels most of it). <b>None of these is in the circuit model</b>: the curves are those of ideal λ/4 lines, and the warnings show where the drawing would detune a real board. The junction bar, the width steps and the T-junction parasitics are drawn but not modelled either; no Kirschning–Jansen bend or T-junction correction is applied in this version.'],
  ['p', '<b>Outputs and connectors.</b> The two outputs of a 2-way stage leave the output node as separate z₀ lines turning straight outward; where the last section is an arc (or a tight meander or bracket) each arm first continues for a short stub at its own width. In a tree these stubs are in the model (at the arm\'s impedance) and cost a little match; on a single divider they are drawn only. The SMA connectors (edge launch at the board edge, vertical inside an H-tree) are drawn, not modelled: the ports are referred to the trace ends.'],

  ['h2', '10 · How the curves are computed', true],
  ['p', 'Each line is a lossy two-port, ' + mth('<i>Y</i><sub>11</sub> = coth(γℓ)/<i>Z</i>') + ' and ' + mth('<i>Y</i><sub>12</sub> = −1/(<i>Z</i> sinh γℓ)') + ' with ' + mth('γℓ = αℓ + jβℓ') + ', stamped into a nodal admittance matrix with the resistors; the internal nodes are eliminated (Kron reduction) and the port matrix is converted to ' + mth('<b>S</b> = (<i>y</i><sub>0</sub><b>I</b> − <b>Y</b>)(<i>y</i><sub>0</sub><b>I</b> + <b>Y</b>)<sup>−1</sup>') + '. With loads, the node voltages are solved and every power is computed from its own element: reflected, delivered to each load, absorbed in each resistor and lost in each line. Their sum is the energy-balance check (100 % ± 0.1 %).'],
  ['refs', 'References: D. M. Pozar, <i>Microwave Engineering</i>, 4th ed., Wiley, 2012. E. J. Wilkinson, "An N-way hybrid power divider," IRE Trans. MTT 8(1), 1960. S. B. Cohn, "A class of broadband three-port TEM-mode hybrids," IEEE Trans. MTT 16(2), 1968. E. Hammerstad, Ø. Jensen, IEEE MTT-S Digest, 1980. M. Kirschning, R. H. Jansen, Electron. Lett. 18(6), 1982. R. J. P. Douville, D. S. James, IEEE Trans. MTT 26(3), 1978. "Design forms of branching lines for microstrip power dividers" (ResearchGate 224140169). Marki Microwave, "How to make an N-way power splitter". Course lectures L05–L09 (microstrip) and the power-divider decks.'],
  ]));
}
// Experiments: each card loads a setup into the Designer.
function experiments(){
  const rows = [1, 2, 3, 4].map(M => wilkRow(M));
  const bwText = rows.map(r => r.M + ': ' + r.use.toFixed(0) + ' %').join(', ');
  const base = { loads: [], tree: Object.assign(freshState().tree), shapes: new Array(MAX_SEC).fill('straight'), compare: false, overlay: false, resOn: true, rMult: 1, lossOn: false };
  const BEYOND_EXP = ['02', '03', '07', '10', '11', '12', '13'];  // experiments past the decks (ruling PDD-1)
  // An experiment card: tag, title, aim, steps and the setup it loads.
  const X = (tag, title, aim, steps, cfg) => ({ tag, title, aim, steps, beyond: BEYOND_EXP.includes(tag), cfg: Object.assign({}, base, cfg) });
  return [
    X('01', 'The 3 dB split', 'The textbook equal Wilkinson.', 'Wilkinson, N = 2, one section. S21 = S31 = −3.01 dB ∠−90°; on the Performance page S11, S22, S33 and S23 dive off the plot at f₀. Each output carries 0.500 W of the 1 W input.', { topology: 'wilkinson', N: 2, M: 1, ratioDB: 0 }),
    X('02', 'Grow it: more sections, wider band', 'Bandwidth from multisection arms — every port, not only S11.', `Step <b>Sections per arm</b> 1 → 4 and watch a section and a resistor appear in the layout each time. The usable −15 dB bandwidth (narrowest of S11, S22, S33, S23 — the Performance page) goes ${bwText} with a binomial taper. The S11 band alone is wider: the outputs and isolation set the limit.`, { topology: 'wilkinson', N: 2, M: 1 }),
    X('03', 'Four ways: star or tree', 'Direct N-way against a cascade.', 'N = 4 Wilkinson: −6.02 dB per output, arms 100 Ω, a star of 50 Ω resistors at each plane (drawn with an air bridge — it is not planar). Then switch to Tree, N = 4: three planar 2-way junctions. The Performance page compares the tree with the star and the resistive Y.', { topology: 'wilkinson', N: 4, M: 1 }),
    X('04', 'Microstrip versus ratio', 'Unequal split, and why it hits a wall.', 'Unequal 2:1 (P2 : P3, so K² = P3/P2 = 1/2): arms 51.5 and 103.0 Ω (2.91 and 0.65 mm on FR-4), R = 106.1 Ω, transformers 42.0 and 59.5 Ω. Drag the ratio slider to 4:1 and watch the weak arm thin to 0.14 mm — below the 0.15 mm minimum, flagged red. Try RO4003C. The W3 table rows are the 1:2, 1:3 and 1:4 settings of the control.', { topology: 'wilkinson', N: 2, M: 1, ratioDB: 3.0103 }),
    X('05', 'Where does reflected power go?', 'The isolation resistor at work — and its limits.', 'Port 3 is loaded with |Γ| = 0.5. On the Performance page: 6.25 % returns to the source, 6.25 % heats R, port 2 still gets 50 %, port 3 37.5 %. The input is <b>not</b> matched: Γin = −(Γ₂ + Γ₃)/2. Now set P2 |Γ| = 0.5 too (symmetric): R gets nothing and 25 % returns to the source.', { topology: 'wilkinson', N: 2, M: 1, loads: [{ g: 0, deg: 0 }, { g: 0.5, deg: 0 }] }),
    X('06', 'FR-4 versus PTFE', 'The substrate sets the copper.', 'Click the substrate presets. RO3010 (εr 10.2) shortens λ/4 and narrows the lines. RT/duroid 5880 (εr 2.2) makes the lines wider relative to the board (W/h 3.08 against 1.91 on FR-4) and λg longer — but on its thinner 0.787 mm board the 50 Ω line is narrower in millimetres (2.42 against 3.06 mm): width scales with h. The footprint readout follows.', { topology: 'wilkinson', N: 2, M: 2 }),
    X('07', 'The cost of loss', 'No real divider is lossless.', 'Line loss is on at 1 dB/λg. S21 and S31 drop below −3.01 dB; the energy balance on the Performance page shows the line loss beside R and the outputs.', { topology: 'wilkinson', N: 2, M: 2, lossOn: true, lossDb: 1 }),
    X('08', 'Lossless T-junction', 'Lossless and reciprocal: something has to give.', 'T-junction with λ/4 transformers: S11 = 0, but |S22| = |S33| = |S23| = 0.5 (−6.02 dB). Turn the transformers off: the 100 Ω lines end on 50 Ω ports and even the input is mismatched.', { topology: 'tee', N: 2, M: 1, teeXfmr: true }),
    X('09', 'Resistive divider', 'Matched everywhere, at a price.', 'Y form, 16.7 Ω each: every port matched at every frequency, −6.02 dB per output, −6.02 dB between outputs, half the input in the resistors. Δ (50 Ω each) gives the same S-matrix.', { topology: 'resistive', N: 2, resForm: 'Y' }),
    X('10', 'Corporate feed 1:8', 'A tree of Wilkinsons, and of other modules.', 'Tree, N = 8: −9.03 dB per output, all in phase, every port matched. Set <b>Module (all)</b> to Branching line: still lossless, but the outputs are unmatched. Resistive Y: −18.06 dB per output (6.02 dB per stage).', { topology: 'tree', M: 1, tree: Object.assign(freshState().tree, { N: 8 }) }),
    X('11', 'Odd N and equal paths', 'N = 3 and N = 5 from unequal 2-way junctions.', 'Tree, N = 3: the root splits 1:2, then 1:1; each output 0.333 W. The delay line on P2 keeps the paths equal — untick <b>Equal path lengths</b> and read the phase imbalance under the outputs table. Try N = 5 (2:3, then 1:1 and 1:2).', { topology: 'tree', M: 1, tree: Object.assign(freshState().tree, { N: 3 }) }),
    X('12', 'Fold it', 'Footprint against performance.', 'Two sections, all straight, Compare-with-straight on. Set the shape to Arc (the ring), then Meander, then Mitred and read the footprint saving. The S-parameters do not change — bends and coupling are not modelled — but the warnings show where a real board would detune (radius < 3W, gap < 3h).', { topology: 'wilkinson', N: 2, M: 2, er: 3.55, h: 0.508, compare: true }),
    X('13', 'Grow the tree', 'Depth 1 → 3.', 'Tree, depth 1. Press Depth 2, then 3: each level adds a row of junctions, laid out as a binary tree. Switch the layout to H-tree for the planar-array form.', { topology: 'tree', M: 1, tree: Object.assign(freshState().tree, { N: 2 }) }),
  ];
}
// Experiments page: a card per experiment; Load setup replaces the design with the card's configuration.
function buildExperiments(){
  const ex = experiments();
  const cards = ex.map((e, i) => el('div', { class: 'card' }, el('span', { class: 'tag' }, 'Exp ' + e.tag, e.beyond ? el('span', { class: 'beyond', text: BEYOND }) : null),
    el('h3', { text: e.title }), el('p', { class: 'mut', text: e.aim }), el('p', {}, rich(e.steps)),
    el('button', { text: 'Load setup →', on: { click: () => {
      const cfg = ex[i].cfg, f = freshState();
      for(const k in f) S[k] = f[k];
      for(const k in cfg) S[k] = JSON.parse(JSON.stringify(cfg[k]));
      S.sel = ''; showPage('designer'); update(true); } } })));
  $('expBody').replaceChildren(el('article', { class: 'doc' }, el('h1', { text: 'Experiments' }),
    el('p', { class: 'lede', text: 'Each card loads a setup into the Designer (it replaces the current design). The numbers quoted are computed by this tool.' }),
    el('div', { class: 'cards' }, ...cards)));
}

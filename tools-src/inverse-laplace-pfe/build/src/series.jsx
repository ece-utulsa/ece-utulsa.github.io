/* ═══ SERIES — the ECE 2003 Laplace lecture series ════════════════════════════
   TOC
     1  SERIES         the ten lectures in order: file name and title
     2  seriesLinks    previous / next entries for lecture n
     3  SeriesFinish   the end strip with "← Lecture n−1" and "Lecture n+1 →" links */

/* ═══ 1 SERIES ════════════════════════════════════════════════════════════ */
const SERIES = [
  ['Laplace_L1_What_the_Transform_Does_v1.0.1.html', 'What the Laplace Transform Does'],
  ['Laplace_L2_Table_and_Properties_v1.0.1.html', 'The Table and Its Properties'],
  ['Laplace_L3_Circuit_Element_Models_v1.0.1.html', 'From Derivatives to Circuit Models'],
  ['Factoring_the_Denominator_v1.1.1.html', 'Factoring the Denominator'],
  ['Inverse_Laplace_Simple_Poles_v1.2.1.html', 'Inverse Laplace — Simple Poles'],
  ['Inverse_Laplace_Repeated_Poles_v1.2.1.html', 'Inverse Laplace — Repeated Poles'],
  ['Inverse_Laplace_Complex_Poles_v1.2.1.html', 'Inverse Laplace — Complex Poles'],
  ['S-Domain_Circuit_Analysis_v1.1.1.html', 'S-Domain Circuit Analysis'],
  ['Laplace_L9_Mesh_Analysis_s-Domain_v1.0.1.html', 'Mesh Analysis in the s-Domain'],
  ['Laplace_L10_Node_Analysis_s-Domain_v1.0.1.html', 'Node-Voltage Analysis in the s-Domain'],
];

/* ═══ 2 seriesLinks ═══════════════════════════════════════════════════════ */
// previous and next lecture for lecture n (1-based): { href, short, full }; the first has no previous, the last no next
function seriesLinks(n) {
  const entry = (k, prev) => ({ href: SERIES[k - 1][0], prev, short: prev ? '← Lecture ' + k : 'Lecture ' + k + ' →',
    full: (prev ? '← ' : '') + 'Lecture ' + k + ' · ' + SERIES[k - 1][1] + (prev ? '' : ' →') });
  return [n > 1 ? entry(n - 1, true) : null, n < SERIES.length ? entry(n + 1, false) : null].filter(Boolean);
}

/* ═══ 3 SeriesFinish ══════════════════════════════════════════════════════ */
// SeriesFinish: the end strip (as the kit's FinishStrip) with the previous / next lecture links either side
function SeriesFinish({ ui, n }) {
  const time = useTime(); const TL = useTL();
  const on = clamp((time - TL.FINISH) / 0.6, 0, 1);
  if (on <= 0) return null;
  const links = seriesLinks(n), link = (l) => (l ? <a data-series={l.prev ? 'prev' : 'next'} href={l.href} title={l.full} aria-label={l.full}
    style={{ fontFamily: HEAD, fontSize: 15, fontWeight: 600, color: ACCENT, whiteSpace: 'nowrap' }}>{l.short}</a> : null);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: CAPTION_BOTTOM, display: 'flex', justifyContent: 'center', opacity: on, pointerEvents: 'none' }}>
      <div data-gate="finish" style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 8, boxShadow: SHADOW, padding: '8px 20px', display: 'flex', alignItems: 'baseline', gap: 14, pointerEvents: 'auto' }}>
        {link(links.find((l) => l.prev))}
        <span style={{ fontFamily: HEAD, fontSize: 17, fontWeight: 600, color: INK }}>{ui.endTitle}</span>
        <span style={{ fontFamily: MONO, fontSize: 14, color: MUTE }}>{ui.endSub}</span>
        {link(links.find((l) => !l.prev))}
      </div>
    </div>
  );
}

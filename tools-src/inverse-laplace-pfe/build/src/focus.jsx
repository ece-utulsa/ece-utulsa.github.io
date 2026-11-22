/* ═══ FOCUS KIT — shared parts for the one-line-at-a-time work zone (focus rules R1–R7); used by Repeated and Complex Poles ═══ */
const POW3 = '#3C4150';   // colour for s³ when equating coefficients (slate)
// monospace text style
const kMono = (size, color, weight) => ({ fontFamily: MONO, fontSize: size, color, fontWeight: weight || 400 });
// an unknown or coefficient letter in amber
const KUnk = ({ k, color }) => <span data-unk="1" style={{ color: color || AMBER, fontWeight: 600 }}>{k}</span>;
// a value forming in the focus area, from which its landing path starts (R5)
const KValue = ({ k, text }) => <span data-landing-from={k} style={{ fontFamily: MONO, fontSize: VALUE_FS, fontWeight: 600, color: AMBER, marginLeft: 14, whiteSpace: 'nowrap' }}>{'= ' + text}</span>;
// a value in the method colour: the pole value put where s was (R3)
const KAt = ({ v, color }) => <span style={{ color, fontWeight: 600 }}>{v}</span>;

// tokens [text | [text, power]] with the terms of one power of s highlighted in that power's colour (R3)
function KPower({ tokens, power, colors }) {
  return (
    <React.Fragment>
      {tokens.map((tk, i) => (typeof tk === 'string'
        ? <Eq key={i} text={tk} />
        : <span key={i} style={tk[1] === power ? { color: colors[tk[1]], fontWeight: 600, textDecoration: 'underline' } : undefined}>{tk[0]}</span>))}
    </React.Fragment>
  );
}

// matrix for the focus area: `shown` rows are visible, each in its row colour (R3)
function KMatrix({ rows, unk, rhs, tags, shown, colors, rowH }) {
  const h = rowH || 34, cell = { width: 30, textAlign: 'center', display: 'inline-block' };
  const line = (i) => ({ height: h, lineHeight: h + 'px', fontFamily: MONO, fontSize: FOCUS_FS, color: colors[i], fontWeight: 600, visibility: i < shown ? 'visible' : 'hidden', whiteSpace: 'nowrap' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div>{tags.map((t, i) => <div key={t} style={Object.assign(line(i), { fontSize: SMALL_FS, fontWeight: 400 })}>{t}</div>)}</div>
      <Bracket color={INK}>{rows.map((r, i) => <div key={i} style={line(i)}>{r.map((v, j) => <span key={j} style={Object.assign({}, cell, { width: Math.max(30, String(v).length * 15) })}>{v}</span>)}</div>)}</Bracket>
      <Bracket color={AMBER}>{unk.map((u) => <div key={u} data-unk="1" style={{ height: h, lineHeight: h + 'px', fontFamily: MONO, fontSize: FOCUS_FS, color: AMBER, fontWeight: 600, textAlign: 'center', width: 24 }}>{u}</div>)}</Bracket>
      <span style={kMono(FOCUS_FS, INK)}>=</span>
      <Bracket color={INK}>{rhs.map((v, i) => <div key={i} style={Object.assign(line(i), { textAlign: 'center', minWidth: 36 })}>{v}</div>)}</Bracket>
    </div>
  );
}

// F(s) with a factored denominator; `cover` lays the amber cover box over one factor (R3)
function KFs({ num, factors, cover, coverNote }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46 }}>
      <span style={kMono(SMALL_FS, MUTE)}>F(s) =</span>
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={kMono(SMALL_FS, TEAL, 600)}>{num}</span>
        <span style={{ alignSelf: 'stretch', height: 2, background: TEAL }} />
        <span style={Object.assign({ display: 'flex' }, kMono(SMALL_FS, TEAL, 600))}>
          {factors.map((f, i) => (
            <span key={i} style={{ position: 'relative', padding: '1px 2px', whiteSpace: 'nowrap' }}>
              {f}
              {cover === i ? (
                <span data-cover={f} style={{ position: 'absolute', top: -2, bottom: -2, left: '50%', transform: 'translateX(-50%)', minWidth: '100%', padding: '0 5px', boxSizing: 'border-box',
                  background: COVER_FILL, border: `1.5px solid ${COVER_STROKE}`, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: HEAD, fontSize: FS_MIN, fontWeight: 600, color: INK }}>cover</span>
              ) : null}
            </span>
          ))}
        </span>
      </div>
      {cover >= 0 && coverNote ? <span style={{ fontFamily: HEAD, fontSize: SMALL_FS, color: INK }}>{coverNote}</span> : null}
    </div>
  );
}

// work zone shell: heading, F(s), the finished lines as compact rows, and the one focus line with its colour bar (R1, R2)
function KWork({ head, badge, badgeColor, fs, rows, focusId, bar, opacity, children }) {
  return (
    <div data-gate="work" style={panel({ left: WORK_X, top: PANEL_TOP, width: WORK_W, height: PANEL_H, opacity,
      display: 'flex', flexDirection: 'column', gap: 7 })}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {zoneHead(head, ACCENT)}
        {badge ? <span style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em', color: badgeColor,
          border: `1px solid ${badgeColor}`, borderRadius: 4, padding: '1px 7px' }}>{badge}</span> : null}
      </div>
      {fs}
      <div data-done="1" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {rows.map((r) => <div key={r.key} data-done-row={r.key} style={Object.assign(kMono(r.size || SMALL_FS, r.color || MUTE), { whiteSpace: r.wrap ? 'normal' : 'nowrap', lineHeight: '21px' })}>{r.node}</div>)}
      </div>
      <div data-focus={focusId} style={{ marginTop: 3, borderLeft: `5px solid ${bar}`, paddingLeft: 14,
        minHeight: 44, display: 'flex', alignItems: 'center', fontFamily: MONO, fontSize: FOCUS_FS, color: INK, lineHeight: 1.35 }}>
        <span>{children}</span>
      </div>
    </div>
  );
}

// one coefficient-tape slot: "?" until the voice has given the value (R4); outlined while it lands with reduced motion (R7)
function KSlot({ k, value, sub, got, landing, reduced, tint, subColor, dense }) {
  return (
    <div data-slot={k} style={{ flex: 1, border: `2px solid ${got ? tint : LINE}`, borderRadius: 8,
      padding: '3px 4px', textAlign: 'center', background: got ? 'rgba(0,0,0,0.02)' : 'transparent',
      outline: landing && got && reduced ? `3px solid ${tint}` : 'none', outlineOffset: 2 }}>
      <div data-unk="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: tint, fontWeight: 600, lineHeight: 1.2 }}>{k}</div>
      <div data-tape={k} style={{ fontFamily: MONO, fontSize: SMALL_FS, fontWeight: 600, color: got ? INK : MUTE,
        fontVariantNumeric: 'tabular-nums', lineHeight: dense ? '19px' : '24px' }}>{got ? value : '?'}</div>
      <div style={{ fontFamily: MONO, fontSize: FS_MIN, color: subColor || MUTE, lineHeight: 1.2 }}>{sub}</div>
    </div>
  );
}

// ◀ ▶ one line at a time, the line counter, the Your-turn button and the note
function KNav({ cur, total, goBeat, yt, note, width }) {
  return (
    <div style={{ width, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={() => goBeat(Math.max(0, cur - 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="previous line">{'◀'}</button>
        <button type="button" onClick={() => goBeat(Math.min(total - 1, cur + 1))} style={Object.assign(btnStyle(false), { fontSize: 14, padding: '4px 14px' })} aria-label="next line">{'▶'}</button>
        <span data-step="1" style={{ fontFamily: MONO, fontSize: FS_MIN, color: MUTE }}>{'line ' + (cur + 1) + ' of ' + total}</span>
        {yt.reached && !yt.open
          ? <button type="button" onClick={yt.reopen} style={Object.assign(btnStyle(true, ACCENT), { marginLeft: 'auto' })}>Your turn</button> : null}
      </div>
      <div data-note="1" style={{ fontFamily: HEAD, fontSize: 13.5, color: INK, textWrap: 'pretty', lineHeight: 1.35 }}><Eq text={note} /></div>
    </div>
  );
}

// TOUR / EXPLORE tag
const KMode = ({ explore, ui }) => (
  <span data-mode="1" style={{ fontFamily: MONO, fontSize: FS_MIN, fontWeight: 600, letterSpacing: '0.06em',
    color: explore ? ACCENT : MUTE, border: `1px solid ${explore ? ACCENT : MUTE}`, borderRadius: 4, padding: '0 6px' }}>
    {explore ? ui.exploreTag : ui.tourTag}
  </span>
);

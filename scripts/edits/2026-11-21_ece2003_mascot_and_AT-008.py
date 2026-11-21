#!/usr/bin/env python3
"""Deterministic unpack -> edit -> repack for the ECE 2003 mascot / AT-008 pass (Animation Rubric §6.4).

Purpose: reproduce PR "ECE 2003 animations: mascot removed (PED-10), AT-004 retired, AT-008 quick fixes".
Briefings: Queue/2026-11-20_ClaudeCode_briefing_ECE2003-animations_mascot-and-AT-004.md (+ addendum 1).
Usage (from the repo root, on the pre-edit files):
  python3 -I scripts/edits/2026-11-21_ece2003_mascot_and_AT-008.py
Each input is checked against its pre-edit SHA-256, round-tripped unchanged through
scripts/design_bundle.py, edited by exact string replacements (each asserted to match the
stated number of times), repacked, and written in place. Re-running on edited files stops
at the hash check.
"""
import hashlib, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TOOL = os.path.join(ROOT, 'scripts', 'design_bundle.py')
VERSION_M2 = 'v1.1.1'   # first version stamp for Mesh Analysis Part 2 (scene module was "v1.1 fast-cycle")

# page -> (pre-edit SHA-256, scene resource uuid)
PAGES = {
    'ece-2003/Superposition Fall2026.html':
        ('8f16537a9bec8f178ab5b0b3ad07bcf991292e9b288d0d7b6dea592996312d93', '8168243c-29b4-4b2d-8679-31ec4285acff'),
    'ece-2003/Mesh Analysis - Part 1.html':
        ('7727a87d2d3dd95c6a963b7ee8e67f77af500e0e76018b13c911b40e0c459d0c', '9f5f6445-b53f-4705-8358-30ee5eaff2fb'),
    'ece-2003/Mesh Analysis - Part 2.html':
        ('8af0749c9bf8e07d39c420bc498b7a30ed5baddb4113f8770b4273d9e1a1aa41', 'bfb2ee7f-8a96-4754-b638-dc3a3b1609df'),
    'ece-2003/Mesh Analysis - Part 3.html':
        ('ca99916a9d328beb0426017301fb5f353257ad202f852f97dc6ccd1334425c78', '569e2b0e-0405-4394-af93-f2bdcf954cc5'),
}


def sha(path):
    """SHA-256 of a file, hex."""
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def rep(s, old, new, count=1):
    """Replace old with new; assert it occurs exactly `count` times."""
    n = s.count(old)
    assert n == count, 'expected %d x %r, found %d' % (count, old[:70], n)
    return s.replace(old, new)


def resub(s, pat, new, count=1, flags=0):
    """Regex replace; assert exactly `count` matches."""
    out, n = re.subn(pat, new, s, flags=flags)
    assert n == count, 'expected %d x /%s/, found %d' % (count, pat[:70], n)
    return out


# ═══ MASCOT REMOVAL (PED-10; PPR-AT-005-1, -007-4, -008-2, -009-5) ═══
def remove_mascot(js, n_lines):
    """Remove the CX.Guide figure, its driver, its mount, its per-line `act` cues and its CARDS targets."""
    js = resub(js, r'// ── Guide: the series character.*?(?=// ── tag / pill)', '', flags=re.S)
    js = rep(js, 'StartButton,\n        Guide, GuideDriver } = CX;', 'StartButton } = CX;')
    js = rep(js, '      <GuideDriver lines={NARRATION} cards={CARDS} />\n', '')
    js = resub(js, r'",\n    act: \{[^\n]*\} \},', '" },', count=n_lines)
    js = resub(js, r'\nconst CARDS = \{\n(?:  [^\n]*\n)*?\};\n', '\n')
    assert 'Guide' not in js.replace('ColumnGuides', ''), 'guide reference left'
    assert 'act:' not in js and 'CARDS' not in js
    return js


# ═══ AT-008 QUICK FIX (addendum 1) — Mesh Analysis Part 2 only ═══
def at008_kit(js):
    """Kit-level fixes inside the Part 2 bundle: light page chrome, button names, no device speech, loud missing clip."""
    # AT-008-2 (V-M13): light page and playback bar, dark text
    js = rep(js, "background: '#0a0a0a',", "background: '#F2F1EC',   // AT-008-2: light page (V-M13)")
    js = rep(js, "boxShadow: '0 20px 60px rgba(0,0,0,0.4)',", "boxShadow: '0 2px 12px rgba(0,0,0,0.12)',")
    js = rep(js, "background: 'rgba(20,20,20,0.92)',", "background: '#FFFFFF',")
    js = rep(js, "borderTop: '1px solid rgba(255,255,255,0.08)',", "border: '1px solid #C9C6BC',")
    js = rep(js, "color: '#f6f4ef'", "color: '#23262E'", count=3)
    js = rep(js, "color: 'rgba(246,244,239,0.55)'", "color: '#4A4F5A'")
    js = rep(js, "background: 'rgba(255,255,255,0.12)',\n          borderRadius: 2,",
             "background: 'rgba(35,38,46,0.22)',\n          borderRadius: 2,")
    js = rep(js, "background: 'oklch(72% 0.12 250)'", "background: 'oklch(0.55 0.13 255)'")
    js = rep(js, "background: '#fff',\n          borderRadius: 6,\n          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',",
             "background: '#fff',\n          border: '2px solid oklch(0.55 0.13 255)',\n          borderRadius: 6,\n          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',")
    js = rep(js, "background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',\n        border: '1px solid rgba(255,255,255,0.1)',",
             "background: hover ? 'rgba(35,38,46,0.10)' : 'rgba(35,38,46,0.03)',\n        border: '1px solid rgba(35,38,46,0.35)',")
    # AT-008-8 (V-M12b): accessible name on every playback button, not only a tooltip
    js = rep(js, "      onClick={onClick}\n      title={title}\n", "      onClick={onClick}\n      title={title}\n      aria-label={title}\n")
    # AT-008-12 (AP-32): no device-speech path. VO keeps only the play/mute state the clip narrator reads.
    js = resub(js, r"  const hasTTS = 'speechSynthesis' in window;\n  const VO = \{.*?  window\.VO = VO;\n",
               "  // AT-008-12: device speech removed; narration is the embedded clips only.\n"
               "  // VO keeps the voice-over on/off and pause state that ClipNarrator and SoundToggle read.\n"
               "  const VO = {\n"
               "    enabled: true, primed: false, _paused: false,\n"
               "    prime() { VO.primed = true; },\n"
               "    cancel() {},\n"
               "    stop() { VO._paused = true; },   // called when the video pauses\n"
               "    go() { VO._paused = false; },    // called when the video plays\n"
               "  };\n"
               "  window.VO = VO;\n", flags=re.S)
    js = resub(js, r"// ── Narrator: drives narration.*?(?=CX\.ClipNarrator = function)",
               "// ── Narrator: plays the pre-generated MP3 clip of each line, synced to the playhead\n"
               "// (scrub/pause/mute re-sync). Clips carry the data-om-exportable-video-play-* attrs.\n"
               "// AT-008-12: a line without a clip, or a clip that fails to load, stops playback and\n"
               "// shows which clip is missing (no silent gap, no device-speech fallback).\n", flags=re.S)
    js = rep(js, "  const { time, playing } = useTimeline();\n  const refs = React.useRef([]);\n  const [urls, setUrls] = React.useState({});",
             "  const { time, playing, setPlaying } = useTimeline();\n  const refs = React.useRef([]);\n  const [urls, setUrls] = React.useState({});\n"
             "  const [errs, setErrs] = React.useState(() => lines.filter((l) => !l.clip).map((l) => 'line at ' + l.at + ' s has no clip'));")
    js = rep(js, "      if (!l.clip) return;\n      const src = (window.__CLIP_URLS && window.__CLIP_URLS[l.clip]) || (base + l.clip);\n      fetch(src).then((r) => r.blob()).then((b) => {",
             "      if (!l.clip) return;\n      const src = (window.__CLIP_URLS && window.__CLIP_URLS[l.clip]) || (base + l.clip);\n"
             "      fetch(src).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); }).then((b) => {")
    js = rep(js, "        setUrls((s) => ({ ...s, [i]: u }));\n      }).catch(() => {});",
             "        setUrls((s) => ({ ...s, [i]: u }));\n      }).catch(() => { if (live) setErrs((s) => s.concat(l.clip + ' did not load')); });")
    js = rep(js, "  let idx = -1;\n  for (let i = 0; i < lines.length; i++) if (time >= lines[i].at) idx = i;\n  const muted",
             "  React.useEffect(() => { if (errs.length && playing) setPlaying(false); }, [errs.length, playing]);\n"
             "  let idx = -1;\n  for (let i = 0; i < lines.length; i++) if (time >= lines[i].at) idx = i;\n  const muted")
    js = rep(js, "  return React.createElement('div', { style: { position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' } },\n    lines.map(",
             "  const guard = errs.length ? React.createElement('div', { role: 'alert', style: { position: 'absolute', inset: 0, zIndex: 60,\n"
             "      display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(250,250,247,0.92)' } },\n"
             "    React.createElement('div', { style: { background: '#fff', border: '2px solid #B3261E', borderRadius: 8, padding: '20px 28px',\n"
             "        maxWidth: 560, textAlign: 'center', fontFamily: CX.HEAD, fontSize: 18, color: CX.INK, lineHeight: 1.5 } },\n"
             "      'Narration audio is missing, so playback has stopped: ' + errs.join('; ') + '.')) : null;\n"
             "  return React.createElement(React.Fragment, null, guard, React.createElement('div', { style: { position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' } },\n    lines.map(")
    js = rep(js, "      onLoadedMetadata: (e) => { const d = e.target.duration; if (isFinite(d)) setDurs((s) => (s[i] === d ? s : { ...s, [i]: d })); },\n    }) : null));\n};",
             "      onLoadedMetadata: (e) => { const d = e.target.duration; if (isFinite(d)) setDurs((s) => (s[i] === d ? s : { ...s, [i]: d })); },\n    }) : null)));\n};")
    js = resub(js, r"CX\.Narrator = function \(\{ lines, base = './', lead = 0\.5 \}\) \{\n.*?\n\};\n",
               "CX.Narrator = function ({ lines, base = './' }) {\n  return React.createElement(CX.ClipNarrator, { lines, base });\n};\n", flags=re.S)
    assert 'speechSynthesis' not in js and 'SpeechNarrator' not in js
    return js


def at008_scene(js):
    """Scene-level on-screen fixes for Mesh Analysis Part 2 (PPR-AT-008-3..-7, AT-008-3..-7, -9, -10)."""
    # AT-008-10: version stamp in the module header
    js = rep(js, "// Worked Example 1 (Case 1 — binding)",
             "// Version " + VERSION_M2 + " (2026-11-21). Author of this revision: Claude Code — mascot removed (PED-10),\n"
             "//   AT-008 quick-fix list (light chrome, contrast, text sizes, units, sign rule, no dimming in l9).\n"
             "// Worked Example 1 (Case 1 — binding)")
    # text colours with >= 4.5:1 on the light surfaces (AT-008-3, V-M6); the L 0.62 phase hues stay for strokes and fills
    js = rep(js, "const AMB = 'oklch(0.5 0.11 60)';   // mesh-B accent (matches Part 1)",
             "const AMB = 'oklch(0.5 0.11 60)';   // mesh-B accent (matches Part 1)\n"
             "const CORAL_TXT = 'oklch(0.48 0.13 28)';   // AT-008-3: coral for TEXT (the L 0.62 kit coral is under 4.5:1)\n"
             "const GREEN_TXT = 'oklch(0.45 0.10 150)';  // AT-008-3: green for TEXT\n"
             "const AMBER_TXT = 'oklch(0.48 0.10 75)';   // AT-008-3: amber for TEXT\n"
             "const SMALL_FS = 11;                        // AT-008-5: smallest text size on the stage (px)")
    # PPR-AT-008-7 / AT-008-3: the Example 2 circuit stays undimmed while line 9 narrates its shared branch
    js = rep(js, "const FOCUS = [null, 'we1', 'we1', 'we1', 'case2', 'super', 'super', 'super', 'duality2'];",
             "const FOCUS = [null, 'we1', 'we1', 'we1', 'case2', 'super', 'super', 'super', 'super'];   // PPR-AT-008-7: no dimming in l9")
    # AT-008-3: inactive rail steps readable (no 0.4 opacity, no FAINT text); AT-008-5: CASE n label size
    js = rep(js, "          const op = isDone || isActive ? 1 : 0.4;", "          const op = 1;   // AT-008-3: inactive steps differ by weight and fill, not by fading")
    js = rep(js, "border: isDone || isActive ? 'none' : `1.5px solid ${FAINT}`,", "border: isDone || isActive ? 'none' : `1.5px solid ${MUTE}`,")
    js = rep(js, "color: isDone || isActive ? '#fff' : FAINT,", "color: isDone || isActive ? '#fff' : MUTE,")
    js = rep(js, "<div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: MUTE, marginBottom: 2 }}>CASE {s.n}</div>",
             "<div style={{ fontFamily: MONO, fontSize: SMALL_FS, letterSpacing: '0.1em', color: MUTE, marginBottom: 2 }}>CASE {s.n}</div>")
    # opener: coral text token
    js = rep(js, "<text x=\"120\" y=\"28\" fontFamily={MONO} fontSize=\"17\" fontWeight=\"700\" fill={CORAL}>?</text>",
             "<text x=\"120\" y=\"28\" fontFamily={MONO} fontSize=\"17\" fontWeight=\"700\" fill={CORAL_TXT}>?</text>")
    js = rep(js, "<span style={{ color: CORAL, fontWeight: 700 }}>{blocked}</span>", "<span style={{ color: CORAL_TXT, fontWeight: 700 }}>{blocked}</span>")
    # PPR-AT-008-6 units (Example 1)
    js = rep(js, "<div style={{ position: 'absolute', left: gMA[0] - 8, top: G.TOPY - 28, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2k</div>",
             "<div style={{ position: 'absolute', left: gMA[0] - 30, top: G.TOPY - 28, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2 kΩ</div>")
    js = rep(js, "<div style={{ position: 'absolute', left: G.TMx + 16, top: gMY - 8, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2k</div>",
             "<div style={{ position: 'absolute', left: G.TMx + 16, top: gMY - 8, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2 kΩ</div>")
    # identity-row panel: room for kΩ chips; "0" readable (AT-008-3); I_B subscript size (AT-008-4)
    js = rep(js, "const R0 = 250, R1 = 306, C0 = 900, C1 = 1030, VEC = 1104, EQ = 1138, RHS = 1188;",
             "const R0 = 250, R1 = 306, C0 = 900, C1 = 1030, CR = C1 + 48, VEC = 1114, EQ = 1148, RHS = 1198;   // CR: right matrix bracket")
    js = rep(js, "{matBracket(C1 + 40, bTop, bBot, false, 'r')}", "{matBracket(CR, bTop, bBot, false, 'r')}")
    js = rep(js, "width={C1 + 40 - (C0 - 96) + 6}", "width={CR - (C0 - 96) + 6}")
    js = rep(js, "<Chip cx={C0} cy={R0} text=\"2k + 2k\" fs={fs} />", "<Chip cx={C0} cy={R0} text=\"2 kΩ + 2 kΩ\" fs={fs} />")
    js = rep(js, "<Chip cx={C1} cy={R0} text=\"−[2k]\" fs={fs} />", "<Chip cx={C1} cy={R0} text=\"−[2 kΩ]\" fs={fs} />")
    js = rep(js, "fontFamily: MONO, fontSize: fs, fontWeight: 500, color: FAINT }}>0</div>", "fontFamily: MONO, fontSize: fs, fontWeight: 500, color: MUTE }}>0</div>")
    js = rep(js, "<text x=\"2\" y=\"20\" fontFamily={MONO} fontSize=\"12\" fontWeight=\"700\" fill={AMB}>I<tspan baselineShift=\"sub\" fontSize=\"8\">B</tspan></text>",
             "<text x=\"2\" y=\"20\" fontFamily={MONO} fontSize=\"13\" fontWeight=\"700\" fill={AMB}>I<tspan baselineShift=\"sub\" fontSize={SMALL_FS}>B</tspan></text>")
    js = rep(js, "<svg width=\"90\" height=\"90\" viewBox=\"0 0 90 90\">", "<svg width=\"104\" height=\"90\" viewBox=\"0 0 104 90\">")
    js = rep(js, "<text x=\"60\" y=\"30\" fontFamily={MONO} fontSize=\"12\" fontWeight=\"700\" fill={INK}>3mA</text>",
             "<text x=\"67\" y=\"30\" fontFamily={MONO} fontSize=\"12\" fontWeight=\"700\" fill={INK}>3 mA</text>")
    js = rep(js, "<span style={{ color: CORAL, fontWeight: 700, fontFamily: MONO }}>I<sub>B</sub> = −3 mA</span>",
             "<span style={{ color: CORAL_TXT, fontWeight: 700, fontFamily: MONO }}>I<sub>B</sub> = −3 mA</span>")
    # Case 2 card: subscripts >= 11 px (AT-008-5), I_s as a true subscript (AT-008-9), sign rule stated (PPR-AT-008-3)
    js = rep(js, "fill={ACCENT}>I<tspan baselineShift=\"sub\" fontSize=\"10\">A</tspan></text>", "fill={ACCENT}>I<tspan baselineShift=\"sub\" fontSize={SMALL_FS}>A</tspan></text>")
    js = rep(js, "fill={AMB}>I<tspan baselineShift=\"sub\" fontSize=\"10\">B</tspan></text>", "fill={AMB}>I<tspan baselineShift=\"sub\" fontSize={SMALL_FS}>B</tspan></text>")
    js = rep(js, "<text x=\"196\" y=\"96\" fontFamily={MONO} fontSize=\"13\" fill={INK}>I_s</text>",
             "<text x=\"200\" y=\"96\" fontFamily={MONO} fontSize=\"14\" fill={INK}>I<tspan baselineShift=\"sub\" fontSize={SMALL_FS}>s</tspan></text>")
    js = rep(js, "the shared source fixes the <b>difference</b> of the two mesh currents — a constraint equation.</div>",
             "the shared source fixes the <b>difference</b> of the two mesh currents — a constraint equation.</div>\n"
             "        <div style={{ fontFamily: HEAD, fontSize: 15, color: INK, marginTop: 8 }}>Sign: the mesh current whose clockwise direction the source arrow follows takes <b>+</b>. Here the arrow points down, the way I<sub>A</sub> circulates.</div>")
    # Example 2: units (PPR-AT-008-6), "2 mA" label at full contrast (AT-008-3), stale comment
    js = rep(js, "  // shared branch: 2mA current source (up)\n", "  // shared branch: 2 mA current source (down)\n")
    js = rep(js, "<div style={{ position: 'absolute', left: gMA[0] - 8, top: G.TOPY - 28, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>1k</div>",
             "<div style={{ position: 'absolute', left: gMA[0] - 30, top: G.TOPY - 28, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>1 kΩ</div>")
    js = rep(js, "<div style={{ position: 'absolute', left: gMB[0] - 8, top: G.TOPY - 28, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>1k</div>",
             "<div style={{ position: 'absolute', left: gMB[0] - 30, top: G.TOPY - 28, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>1 kΩ</div>")
    js = rep(js, "<div style={{ position: 'absolute', left: G.TRx + 20, top: gMY - 8, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2k</div>",
             "<div style={{ position: 'absolute', left: G.TRx + 42, top: gMY - 8, fontFamily: MONO, fontSize: 13, color: MUTE, fontWeight: 600 }}>2 kΩ</div>")   # outside the supermesh outline
    js = rep(js, "fontSize: 13, color: INK, fontWeight: 600, opacity: time > T6 + 3 ? 0.5 : 1 }}>2 mA</div>",
             "fontSize: 13, color: INK, fontWeight: 600 }}>2 mA</div>")
    # AT-008-7: loop labels give way to the payoff values at line 9 (no overlay)
    js = rep(js, "{arrE > 0 && <div style={{ position: 'absolute', left: gMA[0] - 30, top: gMA[1] - 12, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 17, fontWeight: 700, color: ACCENT, opacity: arrE }}><span>I<sub>A</sub></span></div>}\n"
                 "      {arrE > 0 && <div style={{ position: 'absolute', left: gMB[0] - 30, top: gMB[1] - 12, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 17, fontWeight: 700, color: AMB, opacity: arrE }}><span>I<sub>B</sub></span></div>}\n"
                 "      <div style={{ position: 'absolute', left: G.TLx - 76, top: gMY - 8, fontFamily: MONO, fontSize: 15, color: INK, fontWeight: 600 }}>10 V</div>",
             "{arrE > 0 && time < T9 && <div style={{ position: 'absolute', left: gMA[0] - 30, top: gMA[1] - 12, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 17, fontWeight: 700, color: ACCENT, opacity: arrE }}><span>I<sub>A</sub></span></div>}\n"
             "      {arrE > 0 && time < T9 && <div style={{ position: 'absolute', left: gMB[0] - 30, top: gMB[1] - 12, width: 60, textAlign: 'center', fontFamily: MONO, fontSize: 17, fontWeight: 700, color: AMB, opacity: arrE }}><span>I<sub>B</sub></span></div>}\n"
             "      <div style={{ position: 'absolute', left: G.TLx - 76, top: gMY - 8, fontFamily: MONO, fontSize: 15, color: INK, fontWeight: 600 }}>10 V</div>")
    # AT-008-6: "?" marks clear of the shared-branch wire; coral text token
    js = rep(js, "<text x={G.TMx - 6} y={gMY - 34} fontFamily={MONO} fontSize=\"22\" fontWeight=\"700\" fill={CORAL}>?</text>",
             "<text x={G.TMx + 12} y={gMY - 34} fontFamily={MONO} fontSize=\"22\" fontWeight=\"700\" fill={CORAL_TXT}>?</text>")
    js = rep(js, "fontFamily={MONO} fontSize=\"13\" fontWeight=\"600\" fill={CORAL}>KVL through source needs its V …</text>",
             "fontFamily={MONO} fontSize=\"13\" fontWeight=\"600\" fill={CORAL_TXT}>KVL through source needs its V …</text>")
    js = rep(js, "{trapOn > 0 && <div style={{ position: 'absolute', left: G.TMx - 8, top: gMY - 74, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: AMBER, opacity: trapOn * annoOut }}>?</div>}",
             "{trapOn > 0 && <div style={{ position: 'absolute', left: G.TMx + 14, top: gMY - 74, fontFamily: MONO, fontSize: 18, fontWeight: 700, color: AMBER_TXT, opacity: trapOn * annoOut }}>?</div>}")
    # PPR-AT-008-5: clockwise arrowheads on the supermesh outline
    js = rep(js, "strokeWidth=\"2.4\" strokeDasharray=\"7 5\" opacity={boundOn} />}",
             "strokeWidth=\"2.4\" strokeDasharray=\"7 5\" opacity={boundOn} />}\n"
             "        {boundOn > 0 && (<g opacity={boundOn} fill={AMBER_TXT}>{/* PPR-AT-008-5: CW direction on the outline */}\n"
             "          <polygon points={`${G.TLx + 46},${by0} ${G.TLx + 34},${by0 - 6} ${G.TLx + 34},${by0 + 6}`} />\n"
             "          <polygon points={`${bx1},${G.TOPY + 46} ${bx1 - 6},${G.TOPY + 34} ${bx1 + 6},${G.TOPY + 34}`} />\n"
             "          <polygon points={`${G.TRx - 46},${by1} ${G.TRx - 34},${by1 - 6} ${G.TRx - 34},${by1 + 6}`} />\n"
             "          <polygon points={`${bx0},${G.BOTY - 46} ${bx0 - 6},${G.BOTY - 34} ${bx0 + 6},${G.BOTY - 34}`} />\n"
             "        </g>)}")
    # AT-008-6: boundary-walk arrows moved below the top wire and inside the right edge (clear of the resistor labels)
    js = rep(js, "<line x1={gMA[0] - 20} y1={G.TOPY - 14} x2={gMA[0] + 20} y2={G.TOPY - 14} stroke={ACCENT} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${gMA[0] + 24},${G.TOPY - 14} ${gMA[0] + 16},${G.TOPY - 18} ${gMA[0] + 16},${G.TOPY - 10}`} fill={ACCENT} />",
             "<line x1={gMA[0] - 20} y1={G.TOPY + 16} x2={gMA[0] + 20} y2={G.TOPY + 16} stroke={ACCENT} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${gMA[0] + 24},${G.TOPY + 16} ${gMA[0] + 16},${G.TOPY + 12} ${gMA[0] + 16},${G.TOPY + 20}`} fill={ACCENT} />")
    js = rep(js, "<line x1={gMB[0] - 20} y1={G.TOPY - 14} x2={gMB[0] + 20} y2={G.TOPY - 14} stroke={AMB} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${gMB[0] + 24},${G.TOPY - 14} ${gMB[0] + 16},${G.TOPY - 18} ${gMB[0] + 16},${G.TOPY - 10}`} fill={AMB} />",
             "<line x1={gMB[0] - 20} y1={G.TOPY + 16} x2={gMB[0] + 20} y2={G.TOPY + 16} stroke={AMB} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${gMB[0] + 24},${G.TOPY + 16} ${gMB[0] + 16},${G.TOPY + 12} ${gMB[0] + 16},${G.TOPY + 20}`} fill={AMB} />")
    js = rep(js, "<line x1={G.TRx + 14} y1={gMY - 20} x2={G.TRx + 14} y2={gMY + 20} stroke={AMB} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${G.TRx + 14},${gMY + 24} ${G.TRx + 10},${gMY + 16} ${G.TRx + 18},${gMY + 16}`} fill={AMB} />",
             "<line x1={G.TRx - 16} y1={gMY - 20} x2={G.TRx - 16} y2={gMY + 20} stroke={AMB} strokeWidth=\"2.2\" strokeLinecap=\"round\" /><polygon points={`${G.TRx - 16},${gMY + 24} ${G.TRx - 20},${gMY + 16} ${G.TRx - 12},${gMY + 16}`} fill={AMB} />")
    # boundary-KVL caption in kΩ (PPR-AT-008-6)
    js = rep(js, "I<sub>A</sub>[1k] + I<sub>B</sub>[1k + 2k] = <span style={{ color: ACCENT }}>10 V</span>",
             "I<sub>A</sub>[1 kΩ] + I<sub>B</sub>[1 kΩ + 2 kΩ] = <span style={{ color: ACCENT }}>10 V</span>")
    # AT-008-7 / PPR-AT-008-6 / -7: payoff replaces the loop labels, with units; shared branch highlighted while l9 names it
    js = rep(js, "        <div style={{ position: 'absolute', left: gMA[0] - 40, top: gMA[1] - 10, width: 80, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: ACCENT }}><span>I<sub>A</sub>=4</span></div>\n"
                 "        <div style={{ position: 'absolute', left: gMB[0] - 40, top: gMB[1] - 10, width: 80, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: AMB }}><span>I<sub>B</sub>=2</span></div>\n",
             "        <div style={{ position: 'absolute', left: gMA[0] - 40, top: gMA[1] - 20, width: 80, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: ACCENT, lineHeight: 1.25 }}><span>I<sub>A</sub> =</span><br />4 mA</div>\n"
             "        <div style={{ position: 'absolute', left: gMB[0] - 40, top: gMB[1] - 20, width: 80, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: AMB, lineHeight: 1.25 }}><span>I<sub>B</sub> =</span><br />2 mA</div>\n"
             "        <svg width=\"1280\" height=\"720\" style={{ position: 'absolute', inset: 0, opacity: clamp((time - T9) / 0.5, 0, 1) }}>\n"
             "          <line x1={G.TMx} y1={G.TOPY + 6} x2={G.TMx} y2={gMY - 22} stroke={ACCENT} strokeWidth=\"10\" strokeLinecap=\"round\" opacity=\"0.25\" />\n"
             "          <line x1={G.TMx} y1={gMY + 22} x2={G.TMx} y2={G.BOTY - 6} stroke={ACCENT} strokeWidth=\"10\" strokeLinecap=\"round\" opacity=\"0.25\" />\n"
             "        </svg>\n"
             "        <div style={{ position: 'absolute', left: G.TMx - 160, top: G.BOTY + 14, width: 320, textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 700, color: ACCENT, opacity: clamp((time - T9) / 0.5, 0, 1) }}>shared branch: I<sub>A</sub> − I<sub>B</sub> = 2 mA ↓</div>\n")
    # supermesh matrix: room for kΩ chips (PPR-AT-008-6)
    js = rep(js, "const S2COL = [900, 1044], S2ROW = [372, 430], S2VEC = 1122, S2EQ = 1156, S2RHS = 1204;",
             "const S2COL = [880, 1020], S2ROW = [372, 430], S2CR = S2COL[1] + 76, S2VEC = 1126, S2EQ = 1170, S2RHS = 1218;   // S2CR: right matrix bracket")
    js = rep(js, "{ id: 'k10', r: 1, c: 0, text: '[1k]', chip: true, order: 2 },", "{ id: 'k10', r: 1, c: 0, text: '[1 kΩ]', chip: true, order: 2 },")
    js = rep(js, "{ id: 'k11', r: 1, c: 1, text: '[1k + 2k]', chip: true, order: 3 },", "{ id: 'k11', r: 1, c: 1, text: '[1 kΩ + 2 kΩ]', chip: true, order: 3 },")
    js = rep(js, "{matBracket(S2COL[1] + 52, bTop, bBot, false, 'r')}", "{matBracket(S2CR, bTop, bBot, false, 'r')}")
    js = rep(js, "width={S2COL[1] + 52 - (S2COL[0] - 70) + 6}", "width={S2CR - (S2COL[0] - 70) + 6}")
    # duality closer: right of the circuit so the payoff stays visible (AT-008-7); boundary vs shared case (PPR-AT-008-4); text colours (AT-008-3)
    js = rep(js, "      color: good ? GREEN : CORAL, background: good ? 'rgba(70,140,90,0.07)' : 'rgba(190,90,70,0.07)', borderRadius: 6 }}>{txt}</div>",
             "      color: good ? GREEN_TXT : CORAL_TXT, background: good ? 'rgba(70,140,90,0.07)' : 'rgba(190,90,70,0.07)', borderRadius: 6 }}>{txt}</div>")
    js = rep(js, "<div style={{ position: 'absolute', left: 0, right: 0, top: 250, display: 'flex', justifyContent: 'center', opacity: e }}>\n"
                 "      <div style={{ width: 560, background: CARD,",
             "<div style={{ position: 'absolute', left: 812, top: 236, opacity: e }}>\n"
             "      <div style={{ width: 440, boxSizing: 'border-box', background: CARD,")
    js = rep(js, "<div style={{ width: 96, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Mesh</div>{cell('easy', true)}{cell('hard', false)}",
             "<div style={{ width: 96, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Mesh</div>{cell('easy', true)}{cell(<span style={{ fontSize: 13 }}>boundary: easy<br />shared: supermesh</span>, false)}")
    js = rep(js, "    <div style={{ flex: 1, padding: '14px 12px', textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 600,\n",
             "    <div style={{ flex: 1, padding: '14px 6px', textAlign: 'center', fontFamily: MONO, fontSize: 15, fontWeight: 600,\n")
    js = rep(js, "<div style={{ width: 96 }} />{hdr('VOLTAGE SRC')}{hdr('CURRENT SRC')}", "<div style={{ width: 70 }} />{hdr('VOLTAGE SRC')}{hdr('CURRENT SRC')}")
    js = rep(js, "<div style={{ width: 96, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Nodal</div>",
             "<div style={{ width: 70, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Nodal</div>")
    js = rep(js, "<div style={{ width: 96, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Mesh</div>",
             "<div style={{ width: 70, fontFamily: HEAD, fontSize: 14, fontWeight: 600, color: INK }}>Mesh</div>")
    assert 'FAINT }}' not in js and "fontSize: 10," not in js and 'fontSize="10"' not in js and 'fontSize="8"' not in js
    return js


def at008_template(t):
    """AT-008-2 page background, AT-008-10/11 title + version meta, preconnect hints removed."""
    t = rep(t, "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n",
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<title>Mesh Analysis — Part 2 · " + VERSION_M2 + "</title>\n<meta name=\"version\" content=\"" + VERSION_M2 + "\">\n")
    t = rep(t, "  <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n  <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin=\"\">\n", "")
    t = rep(t, "html, body { margin: 0; height: 100%; background: #0a0a0a; }", "html, body { margin: 0; height: 100%; background: #F2F1EC; }")
    return t


def at008_outer(s):
    """Outer wrapper title and version meta (shown while the bundle unpacks)."""
    s = rep(s, "<title>Bundled Page</title>",
            "<title>Mesh Analysis — Part 2 · " + VERSION_M2 + "</title>\n  <meta name=\"version\" content=\"" + VERSION_M2 + "\">")
    return s


def main():
    """Verify inputs, edit each page through design_bundle.py, write in place."""
    for rel, (want, uid) in PAGES.items():
        path = os.path.join(ROOT, rel)
        got = sha(path)
        if got != want:
            sys.exit('%s: SHA-256 %s is not the pre-edit %s (already edited?)' % (rel, got[:12], want[:12]))
        subprocess.run([sys.executable, '-I', TOOL, 'roundtrip', path], check=True)
        with tempfile.TemporaryDirectory() as d:
            subprocess.run([sys.executable, '-I', TOOL, 'unpack', path, d], check=True)
            jp = os.path.join(d, 'res', uid + '.js')
            js = open(jp, encoding='utf-8').read()
            n_lines = len(re.findall(r"clip: '[^']+\.mp3'", js))
            js = remove_mascot(js, n_lines)
            if 'Part 2' in rel:
                js = at008_kit(at008_scene(js))
                tp = os.path.join(d, 'template.html')
                tmpl = at008_template(open(tp, encoding='utf-8').read())
                open(tp, 'w', encoding='utf-8').write(tmpl)
            open(jp, 'w', encoding='utf-8').write(js)
            out = os.path.join(d, 'out.html')
            subprocess.run([sys.executable, '-I', TOOL, 'repack', path, d, out], check=True)
            s = open(out, encoding='utf-8').read()
            if 'Part 2' in rel:
                s = at008_outer(s)
            open(path, 'w', encoding='utf-8', newline='').write(s)
        print('%s  %d B  %s' % (rel, os.path.getsize(path), sha(path)))


if __name__ == '__main__':
    main()

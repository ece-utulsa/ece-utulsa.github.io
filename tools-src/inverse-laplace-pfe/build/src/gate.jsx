/* ═══ TEST BUILD ONLY — overlap gate and timeline hook (never shipped) ═══ */
// OverlapGate: at each settled beat, every pair of [data-gate] boxes must not overlap.
function OverlapGate({ sched }) {
  const { time, setTime, setPlaying } = useTimeline();
  const TL = useTL();
  const live = useRef(null);
  live.current = { time, setTime, setPlaying, sched, TL };
  useEffect(() => {
    const wait = () => new Promise((r) => setTimeout(r, 90));
    const gate = async () => {
      const s = live.current.sched;
      const beats = s.starts.map((b, i) => ({ label: 'line ' + (i + 1) + ' hold', t: b + 0.85 * s.durs[i] }));
      beats.push({ label: 'finish', t: s.total - 0.4 });
      live.current.setPlaying(false);
      const fails = [];
      for (const b of beats) {
        live.current.setTime(b.t); await wait(); await wait();
        const els = Array.from(document.querySelectorAll('[data-gate]'));
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
          const a = els[i], c = els[j];
          if (a.contains(c) || c.contains(a)) continue;
          if (a.dataset.gate === c.dataset.gate) continue;   // the Your-turn card deliberately covers the work zone
          const ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
          if (!ra.width || !rc.width) continue;
          const ox = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left);
          const oy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
          if (ox > 0.5 && oy > 0.5) fails.push(b.label + ': ' + a.dataset.gate + ' x ' + c.dataset.gate + ' (' + Math.round(ox) + 'x' + Math.round(oy) + 'px)');
        }
      }
      const tagged = Array.from(new Set(Array.from(document.querySelectorAll('[data-gate]')).map((e) => e.dataset.gate))).sort();
      return { pass: fails.length === 0, beats: beats.length, fails, tagged };
    };
    window.__PFE_TEST = {
      gate,
      setTime: (t) => live.current.setTime(t),
      setPlaying: (p) => live.current.setPlaying(p),
      getTime: () => live.current.time,
      sched: () => live.current.sched,
      TL: () => live.current.TL,
      beats: () => (typeof BEATS === 'undefined' ? [] : BEATS.map((b, i) => ({ id: b.id, line: b.line, start: beatStart(live.current.TL, i) }))),
    };
    return () => { delete window.__PFE_TEST; };
  }, []);
  return null;
}

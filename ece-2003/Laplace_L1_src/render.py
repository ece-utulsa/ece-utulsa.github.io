#!/usr/bin/env python3
"""Render narration with edge-tts (Python API, to capture word timings); same voice, rate, format and gates as render_voice.py."""
import asyncio, json, os, re, subprocess, sys
import edge_tts
WPM_MIN, WPM_MAX, RETRIES = 100, 280, 3
def words(t): return len([w for w in re.split(r"[\s\-–—]+", t) if re.search(r"\w", w)])
def duration(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]).decode().strip())
async def render(text, voice, rate, path):
    c = edge_tts.Communicate(text, voice, rate=rate, proxy=os.environ.get("HTTPS_PROXY"), boundary="WordBoundary")
    wb = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio": f.write(ch["data"])
            elif ch["type"] == "WordBoundary": wb.append([ch["text"], round(ch["offset"]/1e7, 3), round(ch["duration"]/1e7, 3)])
    return wb
def main():
    sc = json.load(open(sys.argv[1])); out = sys.argv[2]; only = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else None
    packp = os.path.join(out, "pack.json"); old = {c["name"]: c for c in json.load(open(packp))["clips"]} if os.path.exists(packp) else {}
    clips, fails = [], []
    for ln in sc["lines"]:
        name, spoken = ln["name"], ln["spoken"].strip(); path = os.path.join(out, name)
        if re.search(r"\((PENDING|TODO|NOTE)", spoken, re.I): sys.exit("bracketed note in " + name)
        need = (only is None or name in only or not os.path.exists(path)); tries = 0; wb = old.get(name, {}).get("words", [])
        while True:
            if need: wb = asyncio.run(render(spoken, sc["voice"], sc["rate"], path)); tries += 1
            d = duration(path); wpm = words(spoken)/d*60; ok = d > 0.3 and WPM_MIN <= wpm <= WPM_MAX
            if ok or tries >= RETRIES or not need: break
        if not ok: fails.append(name)
        clips.append({"name": name, "spoken": spoken, "dur": round(d, 3), "wpm": round(wpm), "bytes": os.path.getsize(path), "words": wb})
        print(f"{name:24s} {d:6.2f} s {wpm:4.0f} wpm {os.path.getsize(path):6d} B {'ok' if ok else 'GATE FAIL'}")
    json.dump({"clips": clips}, open(packp, "w"), indent=1, ensure_ascii=False)
    print("total", round(sum(c["dur"] for c in clips), 2), "s", sum(c["bytes"] for c in clips), "B")
    if fails: sys.exit("GATE FAILURES " + ",".join(fails))
main()

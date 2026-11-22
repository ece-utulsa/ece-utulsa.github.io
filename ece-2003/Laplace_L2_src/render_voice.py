#!/usr/bin/env python3
"""Render narration clips with edge-tts (kit v2 rules 90-97): en-GB-SoniaNeural, -4 %, MP3 24 kHz 48 kbit/s mono.
Usage: render_voice.py script.json outdir prefix [--only N,N]. Writes <prefix>_line<N>.mp3 and words.json."""
import asyncio, json, os, re, subprocess, sys
import edge_tts
VOICE, RATE = 'en-GB-SoniaNeural', '-4%'
WPM_MIN, WPM_MAX, TRIES = 100, 280, 3
os.environ.setdefault('SSL_CERT_FILE', os.path.expanduser('~/.ccr/ca-bundle.crt'))
PROXY = os.environ.get('HTTPS_PROXY')
def dur(p):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
async def one(text, path):
    c = edge_tts.Communicate(text, VOICE, rate=RATE, proxy=PROXY, boundary='WordBoundary')
    words = []
    with open(path, 'wb') as f:
        async for ch in c.stream():
            if ch['type'] == 'audio': f.write(ch['data'])
            elif ch['type'] == 'WordBoundary': words.append([ch['text'], ch['offset'] / 1e7])
    return words
def main():
    script, out, prefix = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3]
    only = set(int(x) for x in sys.argv[5].split(',')) if len(sys.argv) > 5 else None
    wp = os.path.join(out, 'words.json')
    allw = json.load(open(wp)) if os.path.exists(wp) else {}
    for i, line in enumerate(script, 1):
        if only and i not in only: continue
        sp = line['spoken']
        if re.search(r'[\[\(]', sp): sys.exit('bracketed note in line %d' % i)
        path = os.path.join(out, '%s_line%d.mp3' % (prefix, i))
        n = len(re.split(r'[\s\-—–]+', sp.strip()))
        for k in range(TRIES):
            words = asyncio.run(one(sp, path)); d = dur(path); wpm = n / d * 60
            if WPM_MIN <= wpm <= WPM_MAX: break
        else: sys.exit('wpm gate failed three times, line %d' % i)
        allw[str(i)] = {'dur': d, 'wpm': round(wpm, 1), 'words': words}
        print(i, round(d, 3), round(wpm, 1))
    json.dump(allw, open(wp, 'w'), ensure_ascii=False)
main()

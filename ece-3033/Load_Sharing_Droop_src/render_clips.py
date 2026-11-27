#!/usr/bin/env python3
"""Render the narration clips of narration.json into clips/ (one mp3 per line).

Usage: python3 render_clips.py [name ...]     (no names: every clip that is missing)
Voice en-GB-SoniaNeural at rate −4 % (edge-tts), then ffmpeg to mono 24 kHz 32 kbit/s MP3 with no metadata.
This step needs the network and is not byte-reproducible; the rendered clips are committed, and build.py only reads them.
Clip names: s<slide>_<line>, lab_<n>, exp_<n>.
"""
import asyncio
import json
import os
import subprocess
import sys

import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE, RATE = 'en-GB-SoniaNeural', '-4%'


def lines():
    """Every clip name with its text."""
    say = json.load(open(os.path.join(HERE, 'narration.json'), encoding='utf-8'))
    out = {}
    for s, slide in enumerate(say['slides']):
        for i, text in enumerate(slide):
            out['s%d_%d' % (s + 1, i + 1)] = text
    for key in ('lab', 'exp'):
        for i, text in enumerate(say[key]):
            out['%s_%d' % (key, i + 1)] = text
    return out


async def render(name, text):
    """Speak one line and store it as clips/<name>.mp3."""
    raw = os.path.join(HERE, 'clips', name + '.raw.mp3')
    await edge_tts.Communicate(text, VOICE, rate=RATE, proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')).save(raw)   # through the session's proxy when there is one
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-ac', '1', '-ar', '24000', '-b:a', '32k', '-map_metadata', '-1',
                    '-fflags', '+bitexact', '-flags:a', '+bitexact', '-id3v2_version', '0', '-write_xing', '0', os.path.join(HERE, 'clips', name + '.mp3')], check=True)
    os.remove(raw)


async def main():
    """Render the named clips, or every missing one."""
    todo = lines()
    names = sys.argv[1:] or [n for n in todo if not os.path.exists(os.path.join(HERE, 'clips', n + '.mp3'))]
    for n in names:
        await render(n, todo[n])
        print('rendered', n)


if __name__ == '__main__':
    asyncio.run(main())

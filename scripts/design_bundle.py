#!/usr/bin/env python3
"""Unpack / repack a Design (__bundler) HTML bundle for in-place source edits.

Purpose: edit lesson-animation bundles without re-exporting them (Animation Rubric §6.4).
Usage:
  design_bundle.py unpack BUNDLE.html OUTDIR      # writes OUTDIR/template.html, OUTDIR/res/<uuid>.<ext>, OUTDIR/meta.json
  design_bundle.py repack BUNDLE.html OUTDIR OUT.html   # rebuilds OUT.html from BUNDLE.html with OUTDIR edits applied
  design_bundle.py roundtrip BUNDLE.html          # unpack+repack unchanged, assert byte-identical
Files that are not __bundler bundles (plain inline scripts) are edited directly; this tool is not needed for them.
Only resources whose decoded text changed are re-encoded; unchanged entries keep their original bytes,
so an unchanged repack is byte-identical. Changed gzip entries are recompressed with mtime 0.
The template is a JSON string; it is re-serialised only if its decoded text changed, using the
same escaping as the original (json.dumps with '</' and '/' escapes checked by roundtrip).
"""
import sys, os, re, json, gzip, base64, hashlib, tempfile, io

TAG = '<script type="__bundler/%s">'
END = '</script>'

def _span(s, name):
    """Return (start, end) of the body of the named __bundler script."""
    st = s.index(TAG % name) + len(TAG % name)
    return st, s.index(END, st)

def _dec(entry):
    """Decode one manifest entry to bytes."""
    raw = base64.b64decode(entry['data'])
    return gzip.decompress(raw) if entry.get('compressed') else raw

def _ext(mime):
    """File extension for a mime type (for readable unpack names)."""
    return {'text/javascript': 'js', 'application/javascript': 'js', 'text/css': 'css', 'text/html': 'html',
            'application/json': 'json', 'image/svg+xml': 'svg'}.get(mime, 'bin')

def _tmpl_dumps(text, orig_body):
    """Serialise the template text as the bundler does (verified against the original)."""
    out = json.dumps(text, ensure_ascii=False).replace('</', '<\\u002F')
    lead = orig_body[:len(orig_body) - len(orig_body.lstrip())]
    trail = orig_body[len(orig_body.rstrip()):]
    return lead + out + trail

def unpack(bundle, outdir):
    """Write template and every manifest resource as decoded files."""
    s = open(bundle, encoding='utf-8').read()
    os.makedirs(os.path.join(outdir, 'res'), exist_ok=True)
    a, b = _span(s, 'manifest'); man = json.loads(s[a:b])
    meta = {}
    for uid, e in man.items():
        name = '%s.%s' % (uid, _ext(e.get('mime', '')))
        open(os.path.join(outdir, 'res', name), 'wb').write(_dec(e))
        meta[uid] = {'file': name, 'mime': e.get('mime'), 'compressed': e.get('compressed', False)}
    a, b = _span(s, 'template'); tmpl = json.loads(s[a:b])
    open(os.path.join(outdir, 'template.html'), 'w', encoding='utf-8').write(tmpl)
    json.dump(meta, open(os.path.join(outdir, 'meta.json'), 'w'), indent=1)

def repack(bundle, outdir, out):
    """Rebuild the bundle, re-encoding only entries whose decoded content changed."""
    s = open(bundle, encoding='utf-8').read()
    meta = json.load(open(os.path.join(outdir, 'meta.json')))
    a, b = _span(s, 'manifest'); body = s[a:b]
    man = json.loads(body); changed = []
    for uid, e in man.items():
        new = open(os.path.join(outdir, 'res', meta[uid]['file']), 'rb').read()
        if new == _dec(e): continue
        raw = gzip.compress(new, mtime=0) if e.get('compressed') else new
        old_data = e['data']; new_data = base64.b64encode(raw).decode()
        assert body.count(old_data) == 1, uid
        body = body.replace(old_data, new_data); changed.append(uid)
    s = s[:a] + body + s[b:]
    a, b = _span(s, 'template'); tb = s[a:b]
    t_new = open(os.path.join(outdir, 'template.html'), encoding='utf-8').read()
    if t_new != json.loads(tb):
        assert _tmpl_dumps(json.loads(tb), tb) == tb, 'template escaping differs from bundler; cannot re-serialise safely'
        s = s[:a] + _tmpl_dumps(t_new, tb) + s[b:]; changed.append('template')
    open(out, 'w', encoding='utf-8', newline='').write(s)
    return changed

def roundtrip(bundle):
    """Unpack and repack unchanged; assert the result is byte-identical."""
    with tempfile.TemporaryDirectory() as d:
        unpack(bundle, d); o = os.path.join(d, 'out.html'); ch = repack(bundle, d, o)
        h1 = hashlib.sha256(open(bundle, 'rb').read()).hexdigest(); h2 = hashlib.sha256(open(o, 'rb').read()).hexdigest()
        assert not ch and h1 == h2, (ch, h1, h2)
        # also prove the re-encoders are faithful: template re-serialises byte-identically,
        # and every gzip entry re-compressed from its decoded bytes decodes to the same bytes
        s = open(bundle, encoding='utf-8').read(); a, b = _span(s, 'template'); tb = s[a:b]
        assert _tmpl_dumps(json.loads(tb), tb) == tb, 'template re-serialisation differs'
        a, b = _span(s, 'manifest')
        for uid, e in json.loads(s[a:b]).items():
            raw = _dec(e)
            if e.get('compressed'): assert gzip.decompress(gzip.compress(raw, mtime=0)) == raw, uid
        print('roundtrip OK', h1, os.path.basename(bundle))

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'unpack': unpack(sys.argv[2], sys.argv[3])
    elif cmd == 'repack': print('changed:', repack(sys.argv[2], sys.argv[3], sys.argv[4]))
    elif cmd == 'roundtrip': roundtrip(sys.argv[2])
    else: sys.exit(__doc__)

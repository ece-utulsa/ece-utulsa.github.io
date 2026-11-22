# Inverse Laplace PFE v1.1.0 — build sources (NOT part of the site, never merge to main)

Kept here because addendum 1 (A1) keeps the JSX out of the tool PR. The shipped files are
`ece-2003/Inverse_Laplace_{Simple,Repeated,Complex}_Poles_v1.1.0.html` on branch
`claude/ece2003-inverse-laplace-v1.1.0`.

Layout the scripts expect (S = any scratch folder):

    S/u1, S/u2, S/u3     unpacked live bundles (Simple, Repeated, Complex)
    S/build/             this folder's `build/` contents
    S/clips_new/         optional: pfe1_clips_v1.1.0.js, pfe2_…, pfe3_… (merged over the old clips by name)

Steps:

    python3 scripts/design_bundle.py unpack "ece-2003/Inverse Laplace - Simple Poles Fall2026.html"  S/u1
    python3 scripts/design_bundle.py unpack "ece-2003/Invers Laplace - Repeated Poles Fall2026.html" S/u2
    python3 scripts/design_bundle.py unpack "ece-2003/Inverse Laplace - Complex Poles Fall2026.html" S/u3
    # in each S/uN: copy the res/*.js file that starts "// Embedded audio" to S/uN/audio.js
    cd S/build
    node build.mjs            # ship build  -> out/
    node build.mjs --test     # test build  -> out_test/ (adds src/gate.jsx: OverlapGate + timeline hook)
    node check.mjs            # layout, font, contrast, overlap, numbers, plot (test build, 100 % and 125 %)
    node e2e.mjs              # real-time play of the ship build, offline (about 3.5 min)

The old bundles are on main until the publish step, and in git history at `91ac09f` after it.
`build.mjs` uses the TypeScript compiler at /opt/node22/lib/node_modules/typescript for the JSX transform
and takes React 18.3.1, ReactDOM 18.3.1 and the IBM Plex woff2 subsets from the unpacked bundles.

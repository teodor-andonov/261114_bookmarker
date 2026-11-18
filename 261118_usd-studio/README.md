# USD Studio · Testlab

Browser-only JavaScript CAD using NVIDIA USD BRep's SMLib via @classcad/smlibwasm 0.6.2. No Replicad, OpenCascade, Rhino, backend, or model storage. CodeMirror and Three.js are presentation dependencies.

Option A: JS is the sole editable model; USDA is derived and read-only. Use trusted model scripts only: a Web Worker isolates execution from UI but is not a security sandbox. No automatic USDA-to-code conversion or USDA importing in the UI.

```js
const defaultParams = { width: 80, depth: 60, height: 20 };
const main = (sm, p) => sm.Box(p.width, p.depth, p.height);
```

Return Part, Shell or an array of these. Direct API: https://smlibpy.classcad.ch/docs/javascript/ . Native toUsd writes BrepArray and optional display mesh; no hand-authored fake BRep. USD readers require the NVIDIA schema to interpret exact topology. Three.js previews are tessellations; edge overlay samples actual BRep edges (skipping parametric seams). Multi-object preview uses automatic colors; custom materials/names follow the kernel exporter rather than an app-managed metadata system.

Worker scopes free transient kernel objects. It reopens generated USDA with strict/check and compares object counts and solid volume before enabling export. That is a same-library round-trip check, not independent OpenUSD validation. Tests cover box, drilled/filleted plate, union, separated objects and optional mesh output. Sliders modify source literals and camera remains stable during rebuilds.

Commands: Ctrl/Cmd+K, Run Ctrl/Cmd+Enter, Save Ctrl/Cmd+S. Local file picker or download fallback. No direct USDA editing or importing.

Development: npm install; npm test; npm run build. Runtime verification and independent schema validation are required before claiming full interoperability. Kernel package MIT/Apache-2.0/OFL-1.1; preserve upstream notices when distributing.

## 0.1.1-alpha.1 — worker startup and diagnostics

Worker sends ready only after dynamic WASM import has resolved; the UI queues builds until then. Explicit stage messages, user script console output, native warning handler and initialization exceptions feed the copyable Engine Output panel. Startup has a 45 s watchdog and each modelling stage a 60 s watchdog. Stop terminates the worker; Run restarts it. Browser CI serves the compiled app under the GitHub Pages subpath and requires actual WASM initialization, geometry generation, log messages, USDA output and restart. Run locally with `npm run build && npx playwright install chromium && npm run test:browser`.

## 0.1.2-alpha.1 — CAD preview and architectural demos

Preview uses non-indexed triangle corners with SMLib's exact surface normals instead of averaging normals across shared vertices. Chord tolerance 0.01 model units; real BRep edge curves are sampled for display with depth offset. The four new original architectural studies are Fluid twist tower (loft), Ribbon pavilion (three sweeps), Parametric strata tower (variable plates), and Bifurcating canopy ribs (spatial spline sweeps). Each uses direct kernel API and undergoes native USDA round-trip tests. The export geometry remains unaffected by preview changes.

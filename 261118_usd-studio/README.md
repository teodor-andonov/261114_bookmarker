# USD Studio · Testlab

Browser-only JavaScript CAD using NVIDIA USD BRep's SMLib via @classcad/smlibwasm 0.6.2. No Replicad, OpenCascade, Rhino, backend, or model storage. CodeMirror and Three.js are presentation dependencies.

Option A: JS is the sole editable model; USDA is derived and read-only. Use trusted model scripts only: a Web Worker isolates execution from UI but is not a security sandbox. No automatic USDA-to-code conversion or USDA importing in the UI.

```js
const defaultParams = { width: 80, depth: 60, height: 20 };
const main = (sm, p) => sm.Box(p.width, p.depth, p.height);
```

Return Part, Shell or an array of these. Direct API: https://smlibpy.classcad.ch/docs/javascript/ . Native toUsd writes BrepArray and optional display mesh; no hand-authored fake BRep. USD readers require the NVIDIA schema to interpret exact topology. Three.js previews are tessellations; edge overlay uses tessellated crease edges, not exact CAD curve drawing. Multi-object preview uses automatic colors; custom materials/names follow the kernel exporter rather than an app-managed metadata system.

Worker scopes free transient kernel objects. It reopens generated USDA with strict/check and compares object counts and solid volume before enabling export. That is a same-library round-trip check, not independent OpenUSD validation. Tests cover box, drilled/filleted plate, union, separated objects and optional mesh output. Sliders modify source literals and camera remains stable during rebuilds.

Commands: Ctrl/Cmd+K, Run Ctrl/Cmd+Enter, Save Ctrl/Cmd+S. Local file picker or download fallback. No direct USDA editing or importing. No loft/sweep example in this initial version.

Development: npm install; npm test; npm run build. Runtime verification and independent schema validation are required before claiming full interoperability. Kernel package MIT/Apache-2.0/OFL-1.1; preserve upstream notices when distributing.

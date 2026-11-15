# Replicad Studio — Testlab prototype

Standalone browser-only parametric modelling workspace built with vanilla JavaScript, CodeMirror 6, Replicad/OpenCascade WebAssembly, rhino3dm WebAssembly and Three.js.

## Scope

- Open a local `.js` model, edit highlighted JavaScript code with CodeMirror, and press Run to regenerate.
- Use Replicad's function-style `defaultParams` convention; number, boolean and string properties become UI controls.
- Changing parameter controls rebuilds automatically after a small debounce. Editing code only rebuilds on Run.
- Save / Save as model source to the file system. If the File System Access API isn't available, use normal file import and browser download.
- Download STL (mesh), STEP (exact OpenCascade B-rep), or `.3dm` containing exact Rhino B-reps **for strictly verified axis-aligned box solids and complete sphere solids**. The viewport always shows a tessellation of the exact model.
- Run completely in-browser and cache app assets for offline reuse once downloaded. No server compute, user account, model database or persisted model source.
- **General** OCCT-to-Rhino B-rep conversion remains **unimplemented**. rhino3dm's public JS API does not provide arbitrary OCCT B-rep trim-topology authoring. The 3DM exporter recognises supported primitives by inspecting the real OpenCascade faces and edges and constructs equivalent *exact* Rhino B-reps; it fails clearly for fillets, booleans, trimmed NURBS, and other unsupported solids. No mesh-based substitute. Use STEP for those shapes and import it into Rhino.

## Model contract

```js
const defaultParams = { width: 60, depth: 40, height: 30 };

const main = (replicad, params) => {
  return replicad.makeBaseBox(params.width, params.depth, params.height);
};
```

Return a Replicad Shape or an array of Shapes / `{shape, name}` entries. Import statements and `export default` syntax inside model source are **not** supported in this first version. Only open trusted JavaScript files: code runs locally in a dedicated Web Worker.

Parameter edits are held in memory until you save. The Save action serializes the current values into a plain `const defaultParams = {...};` declaration. More complex computed parameter declarations require manual source edits.

## Development

```bash
npm install
npm run dev
npm run build
```

The build output is `build/`. Testlab's Pages workflow builds it and publishes that folder. No Node.js process is required for the deployed app.

## Verification

- Testlab's GitHub Actions workflow runs `npm install`, `npm run build`, and `.github/scripts/build_site.py`.
- Browser smoke test to perform: load initial box; adjust slider while orbiting to confirm camera stays put; edit highlighted JS code and Run; Fit; open/save local JS; download STEP and `.3dm`; import both into Rhino and check they are genuine valid closed Breps; test a filleted solid fails 3DM export (no false geometry); revisit after first full load offline.
- The restricted 3DM exporter is implemented but **not browser/Rhino smoke-tested in this environment**. Do not claim full support for arbitrary Replicad B-reps.

## Next technical research

Next: a full OpenCascade B-rep to openNURBS translator that runs in browser/WASM, including NURBS control nets/weights/knots, trimming curves in parameter-space, topology sharing, edge orientations, seam handling, assembly structure and numerical tolerances. Test on booleans and filleted solids, not only boxes/spheres.

## Camera and editor

Camera framing happens once when a new model file is loaded, or when Fit is pressed. Rebuilding from source or parameter edits replaces the geometry but leaves the camera position and orbit target unchanged. CodeMirror provides JavaScript syntax highlighting, line numbers, bracket matching and native undo; the model source is still a normal JS file.

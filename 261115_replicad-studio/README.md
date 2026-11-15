# Replicad Studio — Testlab prototype

Standalone browser-only parametric modelling workspace built with vanilla JavaScript, Replicad/OpenCascade WebAssembly and Three.js.

## Scope

- Open a local `.js` model, edit code, and press Run to regenerate.
- Use Replicad's function-style `defaultParams` convention; number, boolean and string properties become UI controls.
- Changing parameter controls rebuilds automatically after a small debounce. Editing code only rebuilds on Run.
- Save / Save as model source to the file system. If the File System Access API isn't available, use normal file import and browser download.
- Download STL (mesh) or STEP (exact OpenCascade B-rep). The viewport always shows a tessellation of the exact model.
- Run completely in-browser and cache app assets for offline reuse once downloaded. No server compute, user account, model database or persisted model source.
- Precise `.3dm` B-rep export remains **unimplemented**. Do not implement a mesh-to-3DM substitute: an arbitrary OpenCascade B-rep requires a face/edge/trim/topology conversion to openNURBS. The rhino3dm.js library can *write* B-reps but is not an OCCT-to-openNURBS translator. STEP can be imported into Rhino meanwhile.

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
- Browser smoke test to perform: load initial shape; adjust slider; edit code and Run; orbit and Fit; open/save local JS; download STEP; import STEP into Rhino and check exact B-rep; revisit after first full load offline.
- Exact 3DM export must not be advertised as implemented until a valid non-mesh B-rep conversion can be demonstrated and checked in Rhino.

## Next technical research

Investigate a reliable OpenCascade B-rep to openNURBS translator that runs in browser/WASM, including surface conversion, trims in parameter-space, topology sharing, edge orientations, seam handling, assembly structure and numerical tolerances. Test on booleans and filleted solids, not only boxes/spheres.

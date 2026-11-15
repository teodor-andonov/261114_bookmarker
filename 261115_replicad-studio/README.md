# Replicad Studio — Testlab prototype

Standalone browser-only parametric modelling workspace built with vanilla JavaScript, CodeMirror 6, Replicad/OpenCascade WebAssembly, rhino3dm WebAssembly and Three.js.

## Scope

- Open a local `.js` model, edit highlighted JavaScript code with CodeMirror, and press Run to regenerate. New loads a fresh starter file. Load demo opens a picker for two bundled examples: a parametric box and a Boolean cut / fillet / union test with an exposed unionParts toggle.
- Use Replicad's function-style `defaultParams` convention; number, boolean and string properties become UI controls.
- Changing parameter controls directly edits the matching literal inside the visible `defaultParams` source (preserving other code and comments), then rebuilds automatically after a short debounce. Editing code by typing still requires Run. The source in the editor is always the model's saved state.
- Save / Save as model source to the file system. If the File System Access API isn't available, use normal file import and browser download.
- Download STL (mesh), STEP (exact OpenCascade B-rep), or `.3dm` containing exact Rhino B-reps **for strictly verified axis-aligned box solids and complete sphere solids**. The viewport always shows a tessellation of the exact model.
- Run completely in-browser and cache app assets for offline reuse once downloaded. No server compute, user account, model database or persisted model source.
- **General** OCCT-to-Rhino B-rep conversion remains **unimplemented in the live exporter**. The existing production writer uses rhino3dm 8.35 and recognises only supported exact primitives, not fillets, booleans or other trimmed solids. Import STEP into Rhino for those. **New:** rhino3dm 9.2 beta *does* expose JS Brep face/edge/trim topology builders; an isolated 3DM NURBS round-trip is now verified by CI (see below). No mesh substitute is used.

## Model contract

```js
const defaultParams = { width: 60, depth: 40, height: 30 };

const main = (replicad, params) => {
  return replicad.makeBaseBox(params.width, params.depth, params.height);
};
```

Return a Replicad Shape or an array of Shapes / `{shape, name}` entries. Import statements and `export default` syntax inside model source are **not** supported in this first version. Only open trusted JavaScript files: code runs locally in a dedicated Web Worker.

Parameter sliders and number fields update the literal value in `defaultParams` *immediately*. Changes show as unsaved edits in CodeMirror and can be undone with the editor's standard undo. Save writes the current editor source verbatim, so reopening the file restores those values. For editing through UI controls, the named parameter must be defined as a direct number, string or boolean literal; expressions, shorthand properties, and computed declarations require manual editing. No model state is persisted in browser storage.

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

The build output is `build/`. Testlab's Pages workflow builds it and publishes that folder. No Node.js process is required for the deployed app.

## Verification

- Testlab's GitHub Actions workflow runs `npm install`, `npm test`, `npm run build`, and `.github/scripts/build_site.py`.
- Browser smoke test to perform: load initial box; adjust slider and confirm that CodeMirror's defaultParams source changes immediately while the camera stays put; load the Boolean/fillet demo; verify it defaults to a fused solid and disable Union parts to inspect the two intersecting bodies; edit source manually and Run; Fit; Open/Save local JS; download STEP and `.3dm`; import both into Rhino and check exact Breps; confirm filleted demo rejects unsupported 3DM export; revisit offline after loading assets.
- The restricted 3DM exporter is implemented but **not browser/Rhino smoke-tested in this environment**. Do not claim full support for arbitrary Replicad B-reps.

## Exact 3DM research — rhino3dm 9.2 beta (15 Nov 2026)

**Selected route:** Replicad's existing OCCT WebAssembly -> JavaScript topology conversion -> McNeel's openNURBS-based `rhino3dm` 9.2 beta WebAssembly -> native Rhino Brep in `.3dm`. No Python, Rhino installation, external service, or custom openNURBS C++ bridge by default.

**Verified in GitHub Actions (Node 22):**
- Installed `rhino3dm-beta` as a **development-only npm alias** pinned to `rhino3dm@9.2.0-beta.0`. The existing production `rhino3dm@8.35.0` exporter is deliberately unchanged.
- Both independent WASM libraries initialize together. The beta directly exposes `Brep.addSurface`, `Brep.addEdgeCurve`, `Brep.addTrimCurve`, `brep.faces.add`, `brep.edges.add`, `brep.loops.add`, `brep.vertices.add`, `brep.trims.add`, `brep.isValidTopology`, `brep.isValidGeometry` and `brep.isSolid`.
- **Actual first geometry round-trip:** sample one planar Replicad/OpenCascade box face, reconstruct its exact bounded bilinear NURBS surface in Rhino geometry, create a one-face Brep with four trim edges, save a `.3dm`, reopen it with rhino3dm beta, verify the imported Brep and topology. Automated by `tests/3dm-write.test.mjs`, run in normal `npm test`.
- OCCT bindings have `BRep_Tool.CurveOnSurface(E, F, ...)` returning the face's 2D trim curve with parameter limits, plus `GeomConvert` / `Geom2dConvert` and BSpline pole/knot/weight readers. Signatures inspected from the *installed* `replicad_single.d.ts`.

**Not yet proved:** a joined **closed** polysurface converted from an arbitrary OCCT model. A single valid Brep *face* is not a solid. The conversion must preserve shared vertices/edges, ordered trim loops and UV curves, face reversal, seams, singularities, tolerances, and ideally validate `isSolid`, topology, geometry and save/reload.

**Specific OCCT constraint:** `GeomConvert.SurfaceToBSplineSurface` rejects unbounded analytic planes/cylinders. When translating an individual bounded face, first respect its actual `UVBounds`. Rectangular surface trimming is not exposed in Replicad's current custom OCCT build; either generate exact bounded analytic NURBS patches from the face parameters or extend that custom build with the needed trim operation. Do not replace the surfaces with sampled display meshes.

**Next implementation milestone:** create a general `occt-to-rhino` converter in the CAD worker, validate a plain box as a **closed** native Brep, then a drilled box, then the existing post-union-fillet demo. Only enable the beta-backed general 3DM export button when a closed solid round-trips and passes validity checks.

**Development commands:** `npm test` runs the exact single-face 3DM round-trip and existing CAD/demo tests. `npm run probe:3dm` is a verbose, manually invoked API/type investigation; it is intentionally excluded from routine deployment builds.

## Camera and editor

Camera framing happens once when a new model file is loaded, or when Fit is pressed. Rebuilding from source or parameter edits replaces the geometry but leaves the camera position and orbit target unchanged. Programmatic source updates do not scroll CodeMirror to parameter positions; mobile panel sizing uses stable small-viewport units rather than dynamic viewport height to avoid page jumps. CodeMirror provides JavaScript syntax highlighting, line numbers, bracket matching and native undo; the model source is still a normal JS file.

## Arena exporter comparison

Arena's `data/cad/arena/export.py` writes exact OCCT shapes to STEP/BREP. Its `.3dm` path currently writes Rhino meshes for four-corner panels and polyline curves for edges—not NURBS/B-rep solids. This does not establish a general OCCT→openNURBS solid converter. Studio's precise 3DM export remains intentionally restricted rather than approximating unsupported solids.

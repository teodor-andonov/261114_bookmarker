# Replicad Studio — Testlab prototype

Standalone browser-only parametric modelling workspace built with vanilla JavaScript, CodeMirror 6, Replicad/OpenCascade WebAssembly, rhino3dm WebAssembly and Three.js.

## Scope

- Open a local `.js` model, edit highlighted JavaScript code with CodeMirror, and press Run to regenerate. New loads a fresh starter file. Load demo opens a picker for two bundled examples: a parametric box and a Boolean cut / fillet / union test with an exposed unionParts toggle.
- Use Replicad's function-style `defaultParams` convention; number, boolean and string properties become UI controls.
- Changing parameter controls directly edits the matching literal inside the visible `defaultParams` source (preserving other code and comments), then rebuilds automatically after a short debounce. Editing code by typing still requires Run. The source in the editor is always the model's saved state.
- Save / Save as model source to the file system. If the File System Access API isn't available, use normal file import and browser download.
- Download STL (mesh), STEP (exact OpenCascade B-rep), or `.3dm` containing exact Rhino B-reps for **planar-faced solids with straight edges** (including boolean cuts and unions) and **complete spheres**. The viewport always shows a tessellation of the exact model.
- Run completely in-browser and cache app assets for offline reuse once downloaded. No server compute, user account, model database or persisted model source.
- **Curved and filleted B-reps are not yet supported in 3DM.** The live worker now tries the verified `rhino3dm 9.2 beta` shared-topology planar translator first; if the geometry is non-planar, it falls back to the existing exact 8.35 primitive writer (such as a full sphere). Unsupported shapes fail clearly. STEP remains the exact export route for the complex filleted Boolean demo. No mesh substitute.

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

- Testlab's GitHub Actions workflow runs `npm install`, `npm test` (including actual OCCT-to-3DM closed-solid/Boolean round-trips), `npm run test:cad`, `npm run build`, and `.github/scripts/build_site.py`.
- Browser smoke test to perform: confirm version/SHA in header, load initial box and export `.3dm`; import into Rhino and verify closed B-rep and mm units; try a script with a planar Boolean through-hole and union; confirm the curved/filleted demo still reports unsupported 3DM and works via STEP. Also test slider/code synchronization, camera stability and offline reuse.
- Rhino 3DM round-trips are verified in Node + real OCCT/rhino3dm WASM by CI. The compiled browser worker was built successfully, but Rhino desktop and a live browser have **not** yet been smoke-tested in this environment.

## Exact 3DM research — rhino3dm 9.2 beta (15 Nov 2026)

**Selected route:** Replicad's existing OCCT WebAssembly -> JavaScript topology conversion -> McNeel's openNURBS-based `rhino3dm` 9.2 beta WebAssembly -> native Rhino Brep in `.3dm`. No Python, Rhino installation, external service, or custom openNURBS C++ bridge by default.

**Verified in GitHub Actions (Node 22):**
- Installed `rhino3dm-beta` as a **development-only npm alias** pinned to `rhino3dm@9.2.0-beta.0`. The existing production `rhino3dm@8.35.0` exporter is deliberately unchanged.
- Both independent WASM libraries initialize together. The beta directly exposes `Brep.addSurface`, `Brep.addEdgeCurve`, `Brep.addTrimCurve`, `brep.faces.add`, `brep.edges.add`, `brep.loops.add`, `brep.vertices.add`, `brep.trims.add`, `brep.isValidTopology`, `brep.isValidGeometry` and `brep.isSolid`.
- **Actual first geometry round-trip:** sample one planar Replicad/OpenCascade box face, reconstruct its exact bounded bilinear NURBS surface in Rhino geometry, create a one-face Brep with four trim edges, save a `.3dm`, reopen it with rhino3dm beta, verify the imported Brep and topology. Automated by `tests/3dm-write.test.mjs`, run in normal `npm test`.
- OCCT bindings have `BRep_Tool.CurveOnSurface(E, F, ...)` returning the face's 2D trim curve with parameter limits, plus `GeomConvert` / `Geom2dConvert` and BSpline pole/knot/weight readers. Signatures inspected from the *installed* `replicad_single.d.ts`.

**Newly implemented and proved (v0.3.0-alpha.1):** `occt-to-rhino.js` maps planar OCCT faces and straight shared edges to precise native Rhino NURBS surfaces, shared vertices/edges, explicit outer/inner UV trim loops, orientations and tolerances. `rhino-planar-core.js` validates and round-trips these B-reps into `.3dm` with millimetre document units. CI proves a closed 6-face box, a planar Boolean through-hole with inner loops, a planar Boolean union, and a two-solid assembly. `rhino-planar-export.js` lazy-loads the beta's browser WASM for actual 3DM export. **Not yet supported:** NURBS curves/surfaces of general curvature, analytic cylinders/toruses and fillet patches, periodic seams, singularities and truly arbitrary OCCT B-reps.

**Specific OCCT constraint:** `GeomConvert.SurfaceToBSplineSurface` rejects unbounded analytic planes/cylinders. When translating an individual bounded face, first respect its actual `UVBounds`. Rectangular surface trimming is not exposed in Replicad's current custom OCCT build; either generate exact bounded analytic NURBS patches from the face parameters or extend that custom build with the needed trim operation. Do not replace the surfaces with sampled display meshes.

**Next milestone:** extend the existing exact translator to curved NURBS faces and 3D/2D B-spline edge curves, preserving original OCCT face UV parameterization, periodic seams and singularities; validate the filleted Boolean demo as a closed Brep. Do not approximate NURBS by sampled display meshes.

**Development commands:** `npm test` runs exact OCCT 3DM face, closed-solid, planar Boolean and browser-ESM round-trip tests. `npm run test:cad` checks the filleted CAD example; `npm run probe:3dm` is a verbose API/type investigation excluded from normal deployment.

## Camera and editor

Camera framing happens once when a new model file is loaded, or when Fit is pressed. Rebuilding from source or parameter edits replaces the geometry but leaves the camera position and orbit target unchanged. Programmatic source updates do not scroll CodeMirror to parameter positions; mobile panel sizing uses stable small-viewport units rather than dynamic viewport height to avoid page jumps. CodeMirror provides JavaScript syntax highlighting, line numbers, bracket matching and native undo; the model source is still a normal JS file.

## Arena exporter comparison

Arena's `data/cad/arena/export.py` writes exact OCCT shapes to STEP/BREP. Its `.3dm` path currently writes Rhino meshes for four-corner panels and polyline curves for edges—not NURBS/B-rep solids. This does not establish a general OCCT→openNURBS solid converter. Studio's precise 3DM export remains intentionally restricted rather than approximating unsupported solids.

## Versioning and release identification

- Version source: `package.json#version`. Current version: **v0.3.0-alpha.1**.
- The topbar shows `v<version> · <7-char Git SHA>`; Vite injects the real `GITHUB_SHA` at GitHub Pages build time and reads local Git HEAD for development builds.
- Root `/AGENTS.md` applies the same version/revision reporting convention to future prototypes, without modifying other existing prototypes.
- Every release should report its actual commit and verify GitHub Pages deployment. A new commit is not necessarily the version currently served from the website.

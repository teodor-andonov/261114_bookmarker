# Replicad Studio — Testlab prototype

Browser-only parametric CAD editor: vanilla JavaScript, CodeMirror 6, Replicad / OpenCascade WebAssembly, Three.js, and rhino3dm/openNURBS WebAssembly.

**Current release:** `v0.4.0-alpha.1`. The header shows **the version and the exact deployed short Git SHA** (injected by Vite). The repository-wide version and commit-reporting convention is in the root `AGENTS.md`.

## Functionality

- **New / Open / Save / Save as:** Edit normal JavaScript `.js` model files; no backend, database, user accounts or persistent model storage. The editor executes only user-trusted JavaScript in a dedicated Web Worker.
- **Load demo:** Simple parametric box and advanced drilled / filleted / Boolean-unioned model. The complex demo includes a separate joint fillet applied after the union and a **Union parts** toggle.
- **Parameters:** `defaultParams` literals (numbers, booleans, strings) appear as controls. Changing controls edits the **visible JavaScript source immediately**, retains comments and undo, and rebuilds the geometry. Save always writes the visible source verbatim.
- **Viewer:** Three.js tessellated preview of the OpenCascade model; stable camera across parameter rebuilds and a manual Fit action.
- **Exports:** STL meshes, exact STEP solids and native **Rhino 3DM closed NURBS B-reps**, including the advanced filleted Boolean-union demo.

## Model format

```js
const defaultParams = { width: 60, depth: 40, height: 30 };
const main = (replicad, params) => {
  return replicad.makeBaseBox(params.width, params.depth, params.height);
};
```

`main` can return one Replicad shape, an array of shapes, or `{shape, name}` entries. Model source imports / `export default` aren't supported in this first version.

## 3DM architecture — v0.4.0-alpha.1

`Replicad OCCT B-rep → occt-nurbs-geometry.js → occt-to-rhino-general.js → rhino-general-core.js → rhino3dm 9.2 beta → native .3dm`

The exporter runs **entirely in the browser**. There is no Rhino installation, Python server or C++ bridge. Rhino 9.2 beta exposes the surface/edge/vertex/loop/trim constructors needed to reconstruct a joined B-rep.

- **3D geometry:** Plane, cylinder, sphere, torus, cone and compatible OpenCascade B-spline surfaces convert to genuine rational NURBS, transferring their exact control points, weights and knots or reconstructing exact analytic rational patches. Shared 3D edges become exact line/NURBS curves, including trimmed conics. This is **not** a mesh or faceted substitute.
- **Topology:** Shared OpenCascade edge identities and vertices become Rhino B-rep topology. Adjacent faces get ordered UV trims; periodic cylindrical seams receive two trims referencing one 3D edge; degenerate spherical poles use singular trims.
- **UV trims:** Where the analytic surface's UV parameters differ from the NURBS parameters, `BRepAdaptor_Curve2d` coordinates are mapped numerically, then represented as adaptive NURBS trimming curves to a target of **0.0001 model units (mm)**. On planar faces, circular and straight trim curves can be represented exactly. **Do not call all converted UV trims mathematically exact**; they have a controlled approximation. The underlying 3D surfaces and edge geometry are exact.
- **Validation:** For every part, enforce `isValidTopology`, `isValidGeometry` and `isSolid` before and after writing/reopening the `.3dm`. The model uses mm units and 0.001 mm Rhino document absolute tolerance. A failed conversion rejects the entire file, not a partial or mesh fallback.
- **Fallbacks:** The previously verified planar exporter and exact full-sphere primitive exporter remain available if the general translator reports a failure on geometry they can represent exactly.

## Automated verification

Tests run against **real OpenCascade WASM and rhino3dm WASM**, not geometry mocks.

- Complete box: one valid closed Rhino B-rep with 6 faces, 12 shared edges, 8 vertices, 6 loops and 24 trims; check source/exported dimensions.
- Planar Boolean union and through-hole: valid joined closed Rhino B-reps, with outer/inner trimming loops; re-open saved 3DM.
- Full advanced complex demo: **63 original OpenCascade faces** and **143 edge entries** (including 14 singular pole edges). The general translator built one valid Rhino solid with 63 faces, 129 non-degenerate edges, 65 loops and 272 trims; opened the `.3dm` and revalidated.
- Production writer and browser ESM WASM: test the same export path used by the UI on fused and separate-parts demo configurations.
- Existing source-synced parameters, demo and OpenCascade fillet tests remain.

GitHub Actions builds the site only after `npm test`, `npm run test:cad` and `npm run build` pass. The verbose exploratory probes are available via `npm run test:probe` and `npm run probe:3dm`, but excluded from normal releases.

```bash
npm install
npm run dev
npm test
npm run test:cad
npm run build
```

Build files are published to GitHub Pages through Testlab's workflow. The production build uses the app version from `package.json` and the actual Git SHA from the GitHub build environment.

## Limitations and manual checks

- **Precision:** UV trim curves on reparameterized curved faces are a 0.0001 mm target approximation; this is not strict mathematical identity of *all* underlying parametric curves. Arbitrary CAD models outside the tested shape families may expose further seam/singularity cases.
- **Runtime verification:** CI exercises both WebAssembly libraries and the actual browser-compatible rhino3dm module in Node. An interactive browser and Rhino desktop import have not been independently smoke-tested here. Verify in Rhino with `What`, `Check`, and a geometric comparison to the STEP export.
- **Complex model settings:** Tests cover the supplied default demo and both states of Union parts, not all arbitrary slider combinations. Unsupported configurations must fail cleanly, never silently export a different shape.
- **Files:** User-controlled `.js` sources stay local; no source data is sent to a server for computation. Browser asset caching is optional and separate from user model storage.

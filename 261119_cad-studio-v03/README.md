# CAD Studio / v0.3 prototype

A fresh implementation of the 19 November 2026 coding brief. No earlier Testlab prototypes were used as dependencies or references. The companion app definition was not supplied, so the coding brief alone is the implementation contract. This is a local-server prototype, not a GitHub Pages app.

## Run

Requirements: Node 22 LTS, npm, desktop Chromium/Edge with WebGL2 and WebAssembly. These are target versions, not a verified compatibility matrix.

```sh
cd 261119_cad-studio-v03
npm install
npm run fixture
npm run build
npm start
```

Open the **token-bearing local URL printed in the terminal** (port 4179). The default project is the real `demo/` directory. Never share the token. To work on a different existing directory:

```sh
npm start -- "/absolute/path/to/project"
```

To authorize existing external files read-only, add absolute file paths after the project root. For instance:

```sh
npm start -- "/path/to/project" "/path/to/another/model.3dm"
```

Restart to select a different project root or authorize another external reference. Import copy is available inside Files. No project data database, no cloud backend. Keep the server bound to loopback. For development, run the local server in one terminal and `npm run dev` in another; use the dev URL printed by the server.

## Try the workflows

- **Parametric:** default starter workspace. Open the Replicad tab, Run / Rebuild, explicitly approve the saved code, switch between editor and runner, change parameters, select an object in the shared tree and inspect it. Export STEP downloads one precise shape per semantic object. Run the bridge demo by choosing its source. The runner can operate without an editor.
- **Rhino:** generate the real, newly authored `fixture.3dm` with `npm run fixture` (the generator refuses to overwrite an existing file); open `inspection.workspace.json` or deliberately open an actual .3dm via the file row action. Stored render meshes are used where available. Files can be loaded in succession.
- **Mixed:** from the parametric workspace open a .3dm file using Files → Open 3DM model. Both providers publish into the same workspace Model collection. Hide/show or filter objects in Model tree, select in viewport or tree, inspect with Inspector.
- **Composition:** + Dock adds a column, then + Tool adds panels. Drag a tab onto another dock to move it; the divider resizes columns. Square button focuses/restores, × removes the active panel. Multiple panels can observe the same context. Use New → text or blank to create a non-CAD workspace. The workspace switcher keeps concurrently opened workspaces independent.
- **Storage:** Save writes a workspace JSON file; use a new filename or save back to the opened file with revision checks. Open workspace accepts the project-relative path. Source and parameter files are ordinary text files, watch polling is approximately 1.5 seconds. Save in the editor before running. See ARCHITECTURE.md.

## Tests

```sh
npm test
npm run fixture
npm run build
npx playwright install chromium
npm run test:browser
```

Only run the fixture command when fixture.3dm does not exist. Stop other instances of the local file server on 4179 before automated tests. See TEST-STATUS.md for verification status and gaps.

## Boundaries

This is an initial implementation, not a certified CAD engine or a complete acceptance pass. Rhino BReps without render meshes remain metadata-only. Not all Rhino units, block instances, display materials or hidden modes are implemented. Scripts are explicitly trusted local JavaScript, not untrusted plugins; the worker has no filesystem capability but is not a general security sandbox. Export is per-object STEP; multi-object STEP assembly and native BREP export are not implemented. Docking is column/tab-based rather than a recursive split tree. External references are CLI-authorized. Full limitations in TEST-STATUS.md.

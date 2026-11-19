# CAD Studio / v0.3.1 PWA

Browser-only, file-first document-centric CAD workspace. Desktop Chrome or Edge on HTTPS is the target. No backend, local Node process, account or project database. Published through the Testlab GitHub Pages build.

## Use

1. Open the published app and click **Open Folder**, then grant read/write access to the chosen folder. This is the project root.
2. Use actual files and subfolders. The app holds the authorized directory handle in memory for the current session. Reopen the folder after refreshing or relaunching.
3. For a ready-made example, use **Copy examples** (explicitly copies bundled files including a genuine 3DM fixture into the chosen folder; never overwrites existing files). It opens the parametric starter workspace.
4. In Replicad click **Run / Rebuild** and approve the source. Change parameters, select in the viewport or Model tree, inspect with Inspector and export STEP. Use the Files row action to choose bridge.js or open fixture.3dm in the same workspace.
5. Open workspace loads ordinary project-relative JSON; Save writes actual workspace JSON. The File Explorer imports copies, can authorize external read-only files for this session, and allows file/folder creation. File renaming uses copy+verify+delete; folder rename is not supported by the browser, use your OS file manager. External refs must be authorized again after relaunch.
6. + Dock adds a column; drag tabs between docks, resize dividers, focus or close a tool. New workspace → text or blank is available without CAD packages.

Chrome/Edge may prompt for permission and exclude sensitive folders. Folder scope is recursive; no permission to arbitrary paths outside it. File change observation polls; revision checks are best effort, not transactional with other applications. No IndexedDB, localStorage or OPFS used for project data or retained handles. Service-worker Cache Storage stores only static app/reproducible example assets, including WASM; wait for initial offline cache installation while online. Use browser Install app menu if desired.

## Development

Node.js is build-time only:
```sh
npm install
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:browser
```
Build uses Vite to produce `build/` with all assets, genuine generated sample 3DM and a content-versioned offline service worker scoped to this app. Preview and test use a static HTTP host, not a runtime API. See ARCHITECTURE.md and TEST-STATUS.md.

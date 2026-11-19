# Verification status / browser-only 0.3.1

Previous 0.3.0 GitHub Actions check (run 44446680278): npm install, unit tests, real 3DM fixture generation, build and empty/file-text browser smoke passed. Rhino fixture opened with named objects, GUID and layer metadata. Browser test failed at an assertion looking for a selected object's name in the JSON block (name was only shown in the heading). The inspector and assertion are corrected in 0.3.1. That earlier run did not reach Replicad.

0.3.1 replaces the Node API entirely. Unit and browser tests are configured for the new adapter; browser tests inject Chromium's own OPFS directory handle ONLY as a test substitute for the unautomatable native picker. Production relies solely on showDirectoryPicker, never OPFS. Initial native picker and permissions need manual desktop verification. See latest Actions results for actual test outcomes.

Known limitations:
- Companion app definition not supplied; implementation follows v0.3 brief and later browser-only decision.
- Browser write permission must be granted, folder selections are session-only, sensitive folders may be refused. File rename is non-atomic copy/verify/delete; folder rename is unsupported. External refs need reauthorization after relaunch. No automatic path remapping on rename.
- Polling and optimistic conflict checks reduce but cannot eliminate external write races; missing parameter sidecar needs manual refresh. No merge UI.
- Rhino static display depends on stored mesh data or supported curves/points. No fresh BRep tessellation, full block/instance handling, complete visibility/material/unit semantics or arbitrary geometry roundtrip.
- Replicad export is per-shape STEP; compound assembly and BREP exports not implemented. Engine import attempted and logged. Trusted local model JS is not an untrusted-code sandbox; workers do not receive file handles, but browser APIs remain available to executed code.
- Dock layout is column/tab-based. No nested bento, global reference rename remapping, large model performance certification or full acceptance pass. Workspace restore never auto-executes saved JS.
- Offline cache is static app assets only; selecting a project still requires authorized native file access.

# Verification status

**Implementation status: initial prototype; acceptance not certified.**

The authoring environment had Node available but DNS/network access to npm and GitHub was blocked. Dependencies could not be installed or run in that environment; the GitHub connector did accept the commits. No browser render, actual fixture generation, CAD build, exact STEP output or STEP importer success has been verified there. Do not interpret source presence as passing tests.

Reproducible checks supplied:
- node --test: core registry/context/resource, independent subscriber, qualified refs and visibility, revision reconciliation, parameter validation, actual file service capability/revision/traversal.
- npm run fixture: generates two named mesh objects with layer metadata in a genuine .3dm and reopens it using Rhino3dm. The binary is generated locally rather than fabricated or committed.
- npm run build: verifies package/bundler resolution.
- npm run test:browser: browser smoke checks empty/file-text composition, real Rhino fixture, both Replicad demos, shared selection and nonempty STEP header. Run on a desktop WebGL2-capable environment. Engine reimport status is separately logged at export time.

### Known gaps / review before daily use
- No companion app-definition document supplied. Implemented v0.3 brief alone.
- Exact dependency versions pinned but no lockfile until npm install can be run; dependency compatibility and WASM bundling remain unverified.
- Rhino conversion: actual support depends on Rhino3dm API and stored render meshes. No BRep tessellation from scratch. Blocks/instancing, native hide modes, inherited parent visibility and all unit systems are not comprehensively handled. Unknown unit fallback is warned. Curves approximate display via samples. Native model originals unchanged.
- Workspace and layout: horizontal column/tab layout only, not arbitrary nested bento; no empty-dock removal, no visual native directory picker, no global file rename remapping; open paths become missing after a rename. Concurrent workspaces share one authorized root but have separate contexts. On workspace restoration Replicad requires manual Run; unrun saved active parametric sources are not re-materialized.
- External edit detection is polling (not instantaneous), missing parameter sidecars do not automatically become watched until reloaded, conflict checks reduce but do not eliminate races with external writers. Multiple editors expose dirty state; no merge UI.
- Heavy display arrays are shared in memory by provider but each viewer owns its own GPU buffers; resource lifetime on model close/workspace close implemented. Unused runner records may remain until workspace close. Rhino reads and Replicad run in workers; repeated WASM startup may be slow. No rigorous large-model performance tests.
- Native export: one STEP per semantic object, no compound assembly or BREP output. Export reimport is an attempted verification, not a guaranteed successful check. No generalized exact 3DM export.
- Local file service capability protects normal worker access; only run trusted JS. Not a hardened hostile-code sandbox. Symlink paths rejected but no adversarial concurrent filesystem race audit.
- Manual acceptance remaining: actual stored render-mesh BRep and curve/point fixtures; all browsers/runtime OS configurations; selection by viewport and filters; duplicate viewers and camera retention; panel move/resize; saved/restored workspaces and external references; parameter persistence and rapid changes; failing script stale state; external file edit conflicts; missing dependency recovery.

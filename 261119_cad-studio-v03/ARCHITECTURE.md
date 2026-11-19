# Architecture / implemented v0.3

```
Workspace
  Registry — package contributions
  Context — exactly one per workspace
  Resources — shared evaluated revisions
  Host — mounted tool instances and layout
  Files — authorized local project service
```

The composition root is src/catalog.js. Core imports no CAD-specific modules. Packages are ordinary ES modules. A package may contribute types, handlers, channels, operations and tools in a single descriptor, declare requires, and provide optional save/restore hooks. Registry.add rejects missing dependencies and duplicate ids. Packages are loaded explicitly, in dependency order; the blank workspace loads none. File/Text-only workspace does not load the Model or geometry engine packages. No graph scheduler, links, ports, or nested contexts.

## Minimal contracts

- Registry.invoke(operationId, workspace, ...args) dispatches a package operation. File actions use operation.accepts(path) and a human-readable title. Headless Rhino is a handler, not a panel.
- Context.get/set/update/subscribe. Subscribe fires immediately and returns an unsubscribe. Duplicate JSON-like values are suppressed. Channel values are registered by packages, not core.
- Resources.get/publish/remove/subscribe identifies a logical or derived representation by stable ID. Retain the latest revision and notify its consumers. Source bytes live in ordinary files and are read by the provider.
- A tool mount(workspace, root, settings, panelId) returns a disposal function. Settings are panel-local and serialized with the layout; context is never duplicated. Moving tabs moves the existing mounted DOM. Closing tabs calls disposal. Workspaces separately own resources/providers and contexts.
- Files offers project/list/read/text/write/writeText/mkdir/rename/import/watch/draft. The API uses SHA-256 revisions for optimistic concurrency, atomic temporary writes and polling for external changes. One server project root; explicitly authorized external refs are read-only; symlinks forbidden. The random API capability is passed as a URL fragment, not a query/server route, and is retained in the main client instance. The worker receives code, parameter values and a message schema, never the file API or token.

## Model package

Model identity = provider + project-relative source reference. Model object identities = Rhino GUID or explicit script id. Qualified references are {modelId, objectId}. A model holds source, handler, revision, units and scale to metres, objects, and optional stale/warning state. Each object includes name, group, metadata, native reference and optional transient display parts (mesh/line/points). Display typed arrays are in memory, not embedded in persisted workspaces. Precise native Rhino data stays in the source file; Replicad native runtime shapes stay in a worker retained by the workspace until replacement or close. No mesh is passed off as precise native CAD.

- cad.activeModels: ordered stable resource ids; providers publish and append if necessary.
- cad.selection: array of qualified refs, last explicit selection wins; retain selection when hidden, indicate visibility in Inspector; clear unresolved refs on model replacement or close.
- cad.visibility: qualified hidden override map; native source visibility takes precedence. Show clears override.
- cad.filter: case-insensitive name/layer substring query; combines with visibility without rewriting model data.

Viewer, Explorer and Inspector import only the Model interface and core UI helpers, never each other or providers. A selection-observer package is included as the independent consumer example and is enabled in demo workspaces. It has no inter-panel connections.

## Replicad convention

A local .js file defines function main(cad, params) and returns a nonempty array of {id, name, group, color, properties, shape}; shape is a real Replicad object, id is stable and unique within its model. Source must be explicitly approved per saved revision. No arbitrary parameter extraction or source rewriting.

The optional companion <source>.params.json stores definitions and authoritative values, e.g.:
```json
{"definitions":[{"id":"height","type":"number","min":100,"max":1000,"step":10,"units":"mm"}],"values":{"height":400}}
```
Number, boolean and choice supported. Runner commits parameter changes with the expected revision and checks dirty buffers. Any source edit marks the last good representation stale; new source revisions require explicit reauthorization. Parameter changes through the runner rebuild after prior authorization. External parameter edits mark the model stale for manual rebuild. Builds occur in dedicated workers. A newer build invalidates the older token and terminates the pending worker; successful results replace the old worker after checking file revisions. Exact STEP exported per shape and checked for header; engine reimport attempted and logged. No automatic execution on workspace restore.

## Deliberate simplifications

Local Node service with a pre-authorized project path instead of native folder-picker integration; 1.5-second file polling; columns with tab docking; line sampling for supported curves; native refs remain runtime/source references. No generic format conversion or full CAD editing.

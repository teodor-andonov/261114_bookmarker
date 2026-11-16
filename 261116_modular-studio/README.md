# Modular Studio — dockable workspace prototype

**Version**: 0.1.0-alpha.1. Standalone browser-only experiment in the Testlab, built with Vite and deployed as static assets on GitHub Pages. No runtime server, account, shared database, collaboration layer, or custom model format.

This is an architecture-studio *shell* experiment inspired by the flexibility of Obsidian and the component-composition ideas discussed around Patchwork. The implementation is original, not a fork.

## Components and contracts

- **Shell** — plain JavaScript, recursive split/stack tree in layout-core.js and DOM renderer in layout.js; drag tabs onto center to stack, edges to split; drag gutters to resize; layouts (UI only) remembered using a namespaced localStorage key.
- **Editor** — CodeMirror 6 operating on one ordinary JavaScript model document.
- **Replicad Runner** — dedicated Web Worker with Replicad + OpenCascade WASM. Runs only explicitly opened/load-demo/run sources or after parameter edits. Produces mesh previews and optional STEP/STL exports, with build status/logs.
- **Viewer** — Three.js presentation of worker meshes; camera persists across rebuilds and panel moves.
- **Formatter** — Prettier processor; preview and apply edits to the same source document, preserving CodeMirror undo.
- **Parametric Controls** — values discovered from the model's top-level defaultParams. Changes precisely replace source literals through an Acorn parser. There is no second parameter truth.

## Source format

Standard Replicad Studio scripts:

```js
const defaultParams = { width: 60, height: 20 };
const main = (replicad, params) =>
  replicad.makeBaseBox(params.width, 40, params.height);
```

The same source can be opened or saved as a normal .js file. The source and mesh data are in memory only until saved/exported by the user. The layout preference is the only persistent application data.

## Controls

| Interaction | Behaviour |
| --- | --- |
| Drag a panel tab onto a box centre | Dock as another tab |
| Drag a panel tab onto an edge | Create a split box |
| Drag a splitter gutter | Resize adjoining boxes |
| Tab / Shift+Tab | Switch tabs in the focused box (outside typing controls) |
| Space | Maximise / restore the focused box (outside typing controls) |
| Double-click box header / ⛶ | Maximise / restore |
| Ctrl/⌘ + K | Search commands |
| Ctrl/⌘ + Enter | Run current script |
| Ctrl/⌘ + S | Save current script |
| Command palette → Reset panel layout | Restore five-box bento |

When typing in CodeMirror or a form control, Tab retains its normal editing/focus behaviour; use a box header to return to panel navigation. Responsive narrow screens arrange the boxes vertically rather than compressing them to unreadable strips.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

The Testlab deploy workflow builds this prototype before assembling the gallery. Vite compiles worker and WASM assets. Testlab injects its shared Home/theme controls into the published index; the local dev preview intentionally does not duplicate those controls.

## Scope and caveats

- This prototype has five single-instance panels; it doesn't yet implement a general plugin/extension API, arbitrary panel duplication, or saved named layout presets.
- It does not include the separate Replicad Studio experiment's exact NURBS 3DM exporter; STEP is the native precise CAD export offered here, while the Three.js viewer uses tessellated display meshes.
- HTML5 drag-and-drop works best with a mouse/trackpad. Mobile uses stacked boxes and the maximize button; touch-native docking can be a later iteration.
- Replicad models are JavaScript, not sandbox-safe documents. A Web Worker protects UI responsiveness but does **not** prevent scripts from using browser network APIs. Only run models you trust.

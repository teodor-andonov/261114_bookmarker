# Maya → Rhino · Geometry Converter

Browser-only Autodesk Maya ASCII (.ma) → Rhino 3DM converter.
Version **0.4.0-alpha.1**.

## Layers and colours

- **Only Maya displayLayer nodes become Rhino layers.** Maya DAG transform
  groups and individual mesh objects no longer create layers.
- Assignment follows connections from a display layer's `drawInfo` to a mesh
  or ancestor transform's `drawOverride` (and compatible objectSet membership).
- Objects without a recognised display-layer assignment go to one **Default**
  layer. Empty explicitly named Maya display layers may also be included.
- If a Maya display layer carries an explicit RGB override (`ovrgb`,
  `overrideColorRGB`), it becomes the Rhino layer colour.
- When no RGB is available, a stable pseudo-random colour derived from the
  layer name is assigned. No colours change between repeated imports.
- Shader RGB is collected through a mesh's `instObjGroups` → shadingEngine
  `dagSetMembers` and the shader's `outColor` → shadingEngine
  `surfaceShader` connections. Basic Maya lambert, phong, blinn, surfaceShader,
  standardSurface and Arnold aiStandardSurface colours are supported.
- Rhino objects receive **material assignments and display RGB** when a
  supported explicit shader colour is available, independently of layer colour.
  Materials with the same name and colour are deduplicated.
- Unsupported texture networks, face-level materials, procedurally computed
  colours, and external renderer features cannot be evaluated from static
  Maya ASCII alone. Shader RGB can differ from colour-managed Maya viewport output.

## Workflow

1. Open or drop a Maya ASCII file into the local-only browser UI.
2. Inspect the subdivided meshes with the shaded preview, optional grid and edges.
3. The layer panel shows Maya display layers (not transform groups). Toggle
   visibility, use All/None or search by name.
4. Choose Smooth As Maya (default) or override subdivision 0–3.
5. Export Rhino 3DM. Export is performed in a cancellable Web Worker with
   per-object progress and 3DM read-back verification.

Hiding a layer only changes the preview unless **Only export visible** is checked.

## Limitations

- Only static polygon geometry stored in .ma is read. Maya construction history,
  deformers, smooth-preview networks, external references and texture computations
  are not evaluated. For exact visual output bake meshes in Maya.
- The output comprises baked polygon meshes, real Rhino display layers and
  basic RGB materials. No native Rhino SubD objects.
- Not every Maya .ma serialisation connects display layers in an identical way.
  Unrecognised memberships are safely assigned to Default instead of
  inventing an object-per-layer hierarchy.
- Binary .mb files are not supported.

## Development

Run npm install, npm test, npm run dev, or npm run build.

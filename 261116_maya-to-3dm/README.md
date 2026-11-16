# Maya → Rhino · Geometry Converter

Browser-only Maya ASCII (.ma) → Rhino 3DM **baked polygon meshes**, with native Rhino layers.
Version **0.3.0-alpha.1**.

## Workflow

1. Open or drop a Maya ASCII file. No server, upload, or Maya installation is required.
2. Inspect the shaded, Z-up viewport. Orbit/pan/zoom, toggle the grid or edges, and fit the view.
3. Expand the **Layers** tree to inspect the Maya DAG transform hierarchy. Toggle any group (and descendants) on/off; **All** / **None** restore or hide the scene. Filter the tree by name.
4. Choose **Smooth → As Maya**, or override subdivision level 0–3. Source up axis is Auto/Y/Z.
5. Export the 3DM. The exporter runs in a Web Worker, advances one mesh at a time, reports progress, and allows cancellation without locking the preview.

Layers in the Rhino file are **real nested Rhino layers**, not encoded into object names.
They follow the Maya **DAG transform parent hierarchy**, rather than automatically guessing materials.
Each mesh is placed on its corresponding leaf transform layer. The layer colors in preview also appear in Rhino.

**Visibility affects the preview only by default.** Enable **Export visible layers only**
to omit currently hidden mesh objects from the 3DM. Hiding a group hides its descendants.

## Notes and limitations

- Uses polygon geometry stored in .ma, not Maya's evaluated dependency graph.
- Catmull–Clark subdivision with available edge/vertex creases and mesh boundary behavior.
  Does not evaluate procedural construction history, external references, animation, skinning
  or connected crease-set networks. For exact results, bake geometry in Maya first.
- Does **not** read Maya's separate displayLayer membership as material categories;
  grouping derives from transform parents. Shapes without parent transforms use Ungrouped.
- Preview and Rhino export both use the **same baked polygon geometry**.
- Invalid objects are skipped without aborting other meshes; the completed 3DM is
  reopened with rhino3dm to verify its contents.
- The 3DM contains only mesh geometry, object names and layer organization.
  No SubD objects, materials, textures, cameras or UV maps are transferred.
- Rhino 3DM conversion and read-back happen entirely in a browser Web Worker.
  Initial Maya parsing and subdivision still run on the UI thread; very large files
  can cause a delay when opening or changing subdivision settings.
- Binary .mb files are not supported.

## Development

Run npm install, npm test, npm run dev, or npm run build.
The Testlab repository builds this prototype through GitHub Actions.

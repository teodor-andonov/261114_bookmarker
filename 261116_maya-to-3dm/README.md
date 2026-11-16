# Maya → Rhino · Baked mesh converter

Browser-only Maya ASCII (.ma) to Rhino polygon mesh (.3dm) converter.
Version 0.2.0-alpha.1.

**Workflow:** Open .ma, inspect subdivided preview, choose detail (default reads each mesh’s saved Maya smooth-preview setting), optionally choose source-up-axis (Auto/Y/Z), export .3dm. No Rhino-side script or native SubD processing.

Exports standard polygon meshes. Reads polygon control cages, edge/vertex crease data (.cd/.cvd), boundary behavior, transform hierarchies, pivots and linear units. Exports only geometry and object names, not materials, UVs, animations or cameras. An invalid mesh is skipped without canceling other geometry.

**Limitations:** Maya's dependency graph, deformers and construction history are not evaluated. Maya crease sets driven by connected nodes, exact hard/soft face-vertex normals and advanced transforms cannot be guaranteed. For pixel-accurate parity, bake subdivided meshes in Maya first. Unsupported faces with holes are skipped.

Development: npm install; npm test; npm run build.

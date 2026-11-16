# Maya → Rhino — Testlab

Browser-only geometry-only Maya ASCII (.ma) → Rhino .3dm converter.
Version: 0.1.0-alpha.1.

## Use

1. Open the Testlab prototype and drag in a Maya ASCII \`.ma\` file.
2. Inspect the polygon control cages, face/quad count, and warnings.
3. Export **.3dm** — native Rhino polygon meshes, without materials, animation, UVs, lights or construction history.
4. For Rhino's **native editable SubD**: download the optional \`maya_meshes_to_subd.py\` script, open the .3dm in Rhino 8/9, run \`_RunPythonScript\`, choose the script, then **Save As**. It replaces all mesh objects in the active Rhino document with \`Rhino.Geometry.SubD\` using the original mesh vertices as control points.

The in-browser export is a **polygon mesh 3DM**, not a native SubD 3DM. There is no native mesh→SubD constructor exposed by rhino3dm.js 8.35/9.2 beta. We explicitly avoid pretending otherwise.

## Scope and limitations

- Reads static Maya polygon mesh attributes \`.vt\`, \`.ed\`, and \`.fc\` (\`polyFaces\`), including indexed batches, reversed edge references and basic polygon-history shape connections.
- Preserves low-poly cage vertices and triangle/quad connectivity, object names, translation, Euler rotation, scale and hierarchical transforms. Converts Maya Y-up coordinates to Rhino Z-up and preserves Maya's linear unit setting (defaults to centimetres).
- Detects display smooth mesh settings and skips intermediate shapes. Meshes with no stored polygon cage are not reconstructable without evaluating Maya's dependency graph.
- Non-planar and N-gon faces are triangulated by a simple fan; **N-gon topology is not retained** for SubD.
- Does not evaluate polySmoothFace, deformers, blendshapes, booleans, instancing, references or other Maya dependency graph operations.
- Mesh edge smooth/hard flags and fractional crease weights are *not* mapped to native Rhino SubD creases. Rhino's script currently uses smooth SubD conversion; open boundary behavior follows Rhino's defaults.
- Maya transform pivots, shear and rotate-axis offsets are not fully supported; warnings are emitted for nonzero values. Hierarchical translation/rotation/scale should be checked against Maya for non-default rotation orders.
- ASCII-only. Binary \`.mb\` files are not supported. No external file uploads, server, Maya runtime, textures, cameras or lights.

## Development

\`\`\`sh
npm install
npm test
npm run dev
npm run build
\`\`\`

This is an independent Vite experiment in \`261114_testlab\`; compiled assets are written to \`build/\` for the gallery.

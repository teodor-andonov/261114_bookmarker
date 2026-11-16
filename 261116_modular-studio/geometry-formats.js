// Geometry format adapters. "Formatter" is a processor, not a source-code
// pretty-printer. It lives with CAD kernel-owned shapes inside the worker.
// A future runner can register another source representation + adapters.
export const SOURCE_FORMAT = "replicad/shapes";

export const FORMAT_ADAPTERS = Object.freeze([
  Object.freeze({
    source: SOURCE_FORMAT,
    target: "viewer/mesh",
    label: "Viewer mesh",
    description: "Tessellated faces and feature edges for the Three.js viewer.",
    extension: null,
    representation: "Triangle mesh",
    fidelity: "Preview",
    automatic: true,
  }),
  Object.freeze({
    source: SOURCE_FORMAT,
    target: "step",
    label: "STEP",
    description: "Native CAD B-rep geometry for downstream CAD applications.",
    extension: ".step",
    representation: "B-rep",
    fidelity: "Precise",
    automatic: false,
  }),
  Object.freeze({
    source: SOURCE_FORMAT,
    target: "stl",
    label: "STL",
    description: "Tessellated surface mesh; one part per STL in this prototype.",
    extension: ".stl",
    representation: "Triangle mesh",
    fidelity: "Tessellated",
    automatic: false,
  }),
]);

export function listConversions(sourceFormat = SOURCE_FORMAT) {
  return FORMAT_ADAPTERS.filter(adapter => adapter.source === sourceFormat);
}

export function makeGeometryDocument(items, revision, sourceFormat = SOURCE_FORMAT) {
  if (!Array.isArray(items) || !items.length) throw new Error("No geometry to convert.");
  return {
    format: sourceFormat,
    revision,
    units: "mm",
    items,
  };
}

// Shapes cannot be structured-cloned or transferred: OCCT geometry remains
// worker-owned. Conversion results are serializable meshes or file bytes.
export async function convertGeometry(document, target, context = {}) {
  if (!document || !Array.isArray(document.items)) throw new Error("Run a model before converting geometry.");
  if (!listConversions(document.format).some(item => item.target === target)) {
    throw new Error("No adapter for " + document.format + " → " + target + ".");
  }
  if (target === "viewer/mesh") {
    return {
      kind: "preview",
      target,
      value: document.items.map(({ shape, name }) => ({
        name,
        faces: shape.mesh(),
        edges: shape.meshEdges(),
      })),
    };
  }
  if (target === "step") {
    const blob = document.items.length === 1
      ? await document.items[0].shape.blobSTEP()
      : await context.replicad.exportSTEP(document.items);
    return { kind: "file", target, extension: ".step", bytes: await blob.arrayBuffer() };
  }
  if (target === "stl") {
    if (document.items.length !== 1) {
      throw new Error("STL currently supports one shape. Use STEP for assemblies.");
    }
    const blob = await document.items[0].shape.blobSTL();
    return { kind: "file", target, extension: ".stl", bytes: await blob.arrayBuffer() };
  }
  throw new Error("Unsupported output: " + target);
}

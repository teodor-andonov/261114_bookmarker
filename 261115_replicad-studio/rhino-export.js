// Restricted, genuine B-rep export using openNURBS/rhino3dm.
// Only export when we can prove that the original OpenCascade shape is one
// of the supported exact primitive types. No triangulation, fitting, or
// bounding-box approximations are ever used.
import initRhino from "rhino3dm";
import rhinoWasmURL from "rhino3dm/rhino3dm.wasm?url";

let rhinoPromise;
function loadRhino() {
  if (!rhinoPromise) {
    rhinoPromise = initRhino({ locateFile: () => rhinoWasmURL }).catch(err => {
      rhinoPromise = null;
      throw err;
    });
  }
  return rhinoPromise;
}

const close = (a, b, tol) => Math.abs(a - b) <= tol;

function boundsFor(shape) {
  const box = shape.boundingBox;
  try {
    const [min, max] = box.bounds;
    const extent = Math.max(...max.map((v, i) => Math.abs(v - min[i])), 1);
    const tolerance = extent * 1e-6;
    if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) return null;
    if (max.some((v, i) => v - min[i] <= tolerance)) return null;
    return { min, max, tolerance };
  } finally {
    box.delete();
  }
}

function isExactAxisAlignedBox(shape, bounds) {
  const faces = shape.faces;
  const edges = shape.edges;
  const solids = shape.solids;
  try {
    if (solids.length !== 1 || faces.length !== 6 || edges.length !== 12) return false;
    if (!faces.every(face => face.geomType === "PLANE")) return false;
    if (!edges.every(edge => edge.geomType === "LINE")) return false;

    // Verify all twelve actual CAD edges span the box dimensions between
    // the eight expected corners. Merely matching the bounds is insufficient.
    const { min, max, tolerance } = bounds;
    const edgeKeys = new Set();
    for (const edge of edges) {
      const start = edge.startPoint;
      const end = edge.endPoint;
      let a, b;
      try {
        a = start.toTuple();
        b = end.toTuple();
      } finally {
        start.delete();
        end.delete();
      }
      const varying = [0, 1, 2].filter(i => !close(a[i], b[i], tolerance));
      if (varying.length !== 1) return false;
      const axis = varying[0];
      if (!close(Math.min(a[axis], b[axis]), min[axis], tolerance) ||
          !close(Math.max(a[axis], b[axis]), max[axis], tolerance)) return false;

      let key = String(axis);
      for (let i = 0; i < 3; i++) {
        if (i === axis) continue;
        if (!close(a[i], b[i], tolerance)) return false;
        const side = close(a[i], min[i], tolerance) ? 0 :
          close(a[i], max[i], tolerance) ? 1 : -1;
        if (side < 0) return false;
        key += ":" + side;
      }
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
    }
    return edgeKeys.size === 12;
  } finally {
    for (const item of [...faces, ...edges, ...solids]) item.delete();
  }
}

function isExactFullSphere(shape, bounds) {
  const faces = shape.faces;
  const solids = shape.solids;
  try {
    if (solids.length !== 1 || faces.length !== 1) return false;
    if (faces[0].geomType !== "SPHERE") return false;
    const dimensions = bounds.max.map((value, i) => value - bounds.min[i]);
    return dimensions.every(v => close(v, dimensions[0], bounds.tolerance));
  } finally {
    for (const item of [...faces, ...solids]) item.delete();
  }
}

function convertExactPrimitive(shape, rhino) {
  const bounds = boundsFor(shape);
  if (!bounds) return null;
  if (isExactAxisAlignedBox(shape, bounds)) {
    return rhino.Brep.createFromBoundingBox(
      new rhino.BoundingBox(bounds.min, bounds.max)
    );
  }
  if (isExactFullSphere(shape, bounds)) {
    const radius = (bounds.max[0] - bounds.min[0]) / 2;
    const center = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
    return rhino.Brep.createFromSphere(new rhino.Sphere(center, radius));
  }
  return null;
}

/** Returns actual .3dm bytes containing only exact closed Rhino B-reps.
 * Unsupported geometry rejects the whole export instead of changing it.
 */
export async function exportExactRhino3dm(entries) {
  if (!entries.length) throw new Error("No model geometry to export.");
  const rhino = await loadRhino();
  const document = new rhino.File3dm();
  document.applicationName = "Replicad Studio";
  document.settings().modelUnitSystem = rhino.UnitSystem.Millimeters;
  document.settings().modelAbsoluteTolerance = 0.001;

  try {
    for (let i = 0; i < entries.length; i++) {
      const brep = convertExactPrimitive(entries[i].shape, rhino);
      if (!brep) {
        throw new Error(
          "Exact 3DM conversion is currently supported only for axis-aligned " +
          "box solids and complete spherical solids. Model part " + (i + 1) +
          " is not supported; export STEP to preserve its exact NURBS/B-rep."
        );
      }
      if (!brep.isValid || !brep.isSolid) {
        throw new Error("rhino3dm generated an invalid or open B-rep for part " + (i + 1));
      }
      const id = document.objects().addBrep(brep);
      if (!id) throw new Error("Could not add part " + (i + 1) + " to Rhino document.");
    }
    const bytes = document.toByteArray();
    if (!bytes?.byteLength) throw new Error("rhino3dm produced an empty document.");
    const loaded = rhino.File3dm.fromByteArray(bytes);
    if (!loaded) throw new Error("Saved Rhino document could not be read back.");
    try {
      if (loaded.objects().count !== entries.length) {
        throw new Error("Rhino document did not contain the expected number of B-reps.");
      }
    } finally {
      loaded.destroy();
    }
    return bytes;
  } finally {
    document.destroy();
  }
}

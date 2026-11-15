import { convertExactPlanarBrep } from "./occt-to-rhino.js";

/**
 * Convert every supported OCCT planar solid to one native Rhino B-rep.
 * Return null if ANY part contains unsupported non-planar geometry; the
 * caller can try an independently verified exact primitive converter.
 * No meshes, surface approximations or partial exports.
 */
export function createExactPlanar3dm(entries, rhino) {
  if (!entries.length) throw new Error("No model geometry to export.");
  const breps = [];
  try {
    for (const entry of entries) {
      const brep = convertExactPlanarBrep(entry.shape, rhino);
      if (!brep) return null;
      if (!brep.isSolid || !brep.isValidTopology()[0] || !brep.isValidGeometry()[0]) {
        throw new Error("OpenCascade-to-Rhino conversion produced a non-solid or invalid B-rep.");
      }
      breps.push(brep);
    }

    const doc = new rhino.File3dm();
    try {
      doc.applicationName = "Replicad Studio";
      doc.settings.modelUnitSystem = rhino.UnitSystem.Millimeters;
      doc.settings.modelAbsoluteTolerance = 0.001;
      for (const brep of breps) {
        const added = doc.objects.addBrep(brep);
        if (!added) throw new Error("Rhino failed to add a B-rep to the 3DM document.");
      }
      const bytes = doc.toByteArray();
      if (!bytes?.length) throw new Error("Empty Rhino file.");

      const read = rhino.File3dm.fromByteArray(bytes);
      if (!read) throw new Error("Failed to reopen Rhino file.");
      try {
        const objects = [...read.objects];
        if (objects.length !== entries.length) {
          throw new Error("Saved 3DM has an incorrect number of objects.");
        }
        for (const object of objects) {
          const brep = object.geometry;
          if (!(brep instanceof rhino.Brep) || !brep.isSolid ||
              !brep.isValidTopology()[0] || !brep.isValidGeometry()[0]) {
            throw new Error("Saved 3DM contains a non-solid or invalid Rhino B-rep.");
          }
        }
      } finally {
        read.delete?.();
      }
      return bytes;
    } finally {
      doc.delete?.();
    }
  } finally {
    breps.forEach(brep => brep.delete?.());
  }
}

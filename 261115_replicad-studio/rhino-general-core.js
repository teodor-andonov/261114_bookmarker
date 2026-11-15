import { convertGeneralNurbsBrep } from "./occt-to-rhino-general.js";

/**
 * Produce a Rhino 3DM with one native, closed Brep per Replicad part.
 *
 * OCCT surfaces and 3D edges are reconstructed as exact NURBS. UV trims on
 * reparameterized curved faces are tolerance-controlled NURBS, never meshes.
 * No partial files leave this function: validate EVERY part and the saved
 * document before returning bytes to the download handler.
 */
export function createGeneralNurbs3dm(entries, rhino, oc) {
  if (!entries.length) throw new Error("No model geometry to export.");
  if (!oc) throw new Error("OpenCascade must be initialized to export 3DM.");
  const breps = [];
  let document;
  let reloaded;
  try {
    for (const [index, entry] of entries.entries()) {
      let brep;
      try {
        brep = convertGeneralNurbsBrep(entry.shape, rhino, oc);
      } catch (error) {
        throw new Error("Part " + (index + 1) + " (" + entry.name + "): " + error.message);
      }
      breps.push(brep);
      const [validTopology, topologyReason] = brep.isValidTopology();
      const [validGeometry, geometryReason] = brep.isValidGeometry();
      if (!brep.isSolid || !validTopology || !validGeometry) {
        throw new Error("Part " + (index + 1) +
          " is not a valid closed Rhino Brep: " + (topologyReason || geometryReason || "open solid"));
      }
    }

    document = new rhino.File3dm();
    document.applicationName = "Replicad Studio";
    // The beta exposes the model unit system as read-only. Its measured
    // default is mm; reject if a future version silently changes this.
    if (document.settings.modelUnitSystem !== rhino.UnitSystem.Millimeters)
      throw new Error("Rhino beta did not initialise the document in millimetres.");
    document.settings.modelAbsoluteTolerance = 0.001;

    for (const brep of breps) {
      const id = document.objects.addBrep(brep);
      if (!id) throw new Error("Unable to add a closed Brep to Rhino document.");
    }
    const bytes = document.toByteArray();
    if (!bytes?.byteLength) throw new Error("Rhino produced an empty .3dm.");

    reloaded = rhino.File3dm.fromByteArray(bytes);
    if (!reloaded) throw new Error("Cannot re-open exported .3dm.");
    const objects = [...reloaded.objects];
    if (objects.length !== entries.length)
      throw new Error("Exported .3dm has the wrong number of objects.");
    for (const [index, object] of objects.entries()) {
      const brep = object.geometry;
      if (!(brep instanceof rhino.Brep) || !brep.isSolid ||
          !brep.isValidTopology()[0] || !brep.isValidGeometry()[0]) {
        throw new Error("Reopened .3dm part " + (index + 1) + " is not a valid closed Brep.");
      }
    }
    return bytes;
  } finally {
    reloaded?.delete?.();
    document?.delete?.();
    breps.forEach(brep => brep.delete?.());
  }
}

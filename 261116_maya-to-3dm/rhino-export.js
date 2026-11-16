import initRhino from "rhino3dm/rhino3dm.module.js";
import wasmUrl from "rhino3dm/rhino3dm.wasm?url";

let modulePromise;
async function getRhino() {
  if (!modulePromise) {
    modulePromise = initRhino({locateFile: () => wasmUrl}).catch(error => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

/** Writes only geometry (mesh cages) and their names. Does not bake smoothing. */
export async function exportMesh3dm(parsed) {
  if (!parsed.objects.length) throw new Error("No supported polygon geometry to export.");
  const rhino = await getRhino();
  const doc = new rhino.File3dm();
  doc.applicationName = "Testlab Maya ASCII Geometry Converter";
  const units = {
    mm: "Millimeters", millimeter: "Millimeters", millimeters: "Millimeters",
    cm: "Centimeters", centimeter: "Centimeters", centimeters: "Centimeters",
    m: "Meters", meter: "Meters", meters: "Meters",
    km: "Kilometers", in: "Inches", inch: "Inches", ft: "Feet", foot: "Feet"
  };
  const unitKey = units[parsed.unit] || "Centimeters";
  doc.settings().modelUnitSystem = rhino.UnitSystem[unitKey];
  try {
    for (const object of parsed.objects) {
      const mesh = new rhino.Mesh();
      try {
        mesh.vertices().useDoublePrecisionVertices = true;
        for (const point of object.vertices) {
          if (!point || point.length !== 3 || !point.every(Number.isFinite)) {
            throw new Error(object.name + ": invalid vertex coordinates.");
          }
          mesh.vertices().add(point[0], point[1], point[2]);
        }
        for (const polygon of object.faces) {
          if (polygon.length === 3) mesh.faces().addTriFace(...polygon);
          else if (polygon.length === 4) mesh.faces().addQuadFace(...polygon);
          else for (let j = 1; j < polygon.length - 1; j++)
            mesh.faces().addTriFace(polygon[0], polygon[j], polygon[j + 1]);
        }
        if (!mesh.isValid) throw new Error(object.name + ": invalid Rhino mesh; export cancelled.");
        mesh.normals().computeNormals();
        const attributes = new rhino.ObjectAttributes();
        attributes.name = object.name;
        const id = doc.objects().add(mesh, attributes);
        if (!id) throw new Error(object.name + ": could not add mesh to 3DM.");
      } finally {
        mesh.delete();
      }
    }
    const bytes = doc.toByteArray();
    if (!bytes || bytes.length < 100) throw new Error("Rhino returned an empty .3dm file.");
    // Reopen in the same OpenNURBS library before offering the bytes to the user.
    const roundtrip = rhino.File3dm.fromByteArray(bytes);
    if (!roundtrip || roundtrip.objects().count !== parsed.objects.length) {
      if (roundtrip) roundtrip.destroy();
      throw new Error("3DM read-back verification failed.");
    }
    roundtrip.destroy();
    return bytes;
  } finally {
    doc.destroy();
  }
}

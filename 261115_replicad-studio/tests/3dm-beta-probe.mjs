// Integration-only feasibility probe. No production exporter changes.
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";

const names = object => {
  if (!object) return [];
  const methods = new Set();
  let proto = object;
  for (let level = 0; proto && level < 3; level++, proto = Object.getPrototypeOf(proto)) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (!key.startsWith("_")) methods.add(key);
    }
  }
  return [...methods].sort();
};
const print = (name, object) => console.log(name, names(object).filter(v =>
  /add|append|new|create|set|vertex|edge|face|trim|loop|point|knots|surface|curve|poles|weight|valid|solid|isnull|degree|cast|toByte|fromByte|multiplic|geom/i.test(v)
).join(", ") || "(none)");

console.log("Loading rhino3dm 9.2.0-beta.0");
const rhino = await initRhino();
console.log("rhino3dm loaded", !!rhino.Brep, !!rhino.File3dm, !!rhino.NurbsSurface);
const b = new rhino.Brep();
print("beta Brep", b);
for (const part of ["faces","surfaces","vertices","edges","loops","trims"]) {
  try { print("beta Brep." + part, b[part]); }
  catch (error) { console.log("beta Brep." + part + " ERROR", error.message); }
}
print("beta NurbsSurface prototype", rhino.NurbsSurface?.prototype);
print("beta NurbsCurve prototype", rhino.NurbsCurve?.prototype);
print("beta NurbsSurfaceKnotList", rhino.NurbsSurfaceKnotList?.prototype);
print("beta NurbsSurfacePointList", rhino.NurbsSurfacePointList?.prototype);
print("beta NurbsCurvePointList", rhino.NurbsCurvePointList?.prototype);
console.log("beta BrepLoopType", rhino.BrepLoopType, "beta BrepTrimType", rhino.BrepTrimType);

const doc = new rhino.File3dm();
print("beta file objects", doc.objects);
const bytes = doc.toByteArray();
console.log("beta empty 3dm byte length:", bytes?.length || bytes?.byteLength || 0);
if (!bytes?.length && !bytes?.byteLength) throw new Error("rhino3dm beta could not write a 3dm file");

console.log("Loading OpenCascade WASM");
const oc = await initOC();
replicad.setOC(oc);
const shape = replicad.makeBaseBox(20, 30, 10).fillet(2);
console.log("OCCT sample shape",shape.faces.length,"faces",shape.edges.length,"edges");
print("OCCT BRep_Tool", oc.BRep_Tool);
print("OCCT GeomConvert", oc.GeomConvert);
print("OCCT Geom2dConvert", oc.Geom2dConvert);
print("OCCT BRepTools", oc.BRepTools);
print("OCCT Geom_BSplineSurface", oc.Geom_BSplineSurface?.prototype);
print("OCCT Geom2d_BSplineCurve", oc.Geom2d_BSplineCurve?.prototype);
print("OCCT Geom_BSplineCurve", oc.Geom_BSplineCurve?.prototype);
print("OCCT TopoDS", oc.TopoDS);
const face=shape.faces[0];
const surface=oc.BRep_Tool.Surface(face.wrapped);
print("OCCT surface handle",surface);
try {print("OCCT surface object",surface.get());}
catch(error) {console.log("OCCT surface .get error",error.message);}
console.log("PROBE COMPLETED");

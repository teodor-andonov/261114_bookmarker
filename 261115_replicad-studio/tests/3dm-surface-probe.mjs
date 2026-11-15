// Narrow test for translating an OpenCascade surface and making a Rhino B-rep.
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";

const rhino = await initRhino();
const oc = await initOC();
replicad.setOC(oc);

const safe = (name, action) => {
  try { const value = action(); console.log(name, JSON.stringify(value)); return value; }
  catch (e) { console.log(name, "ERROR:", e.message); return null; }
};
const methods = o => {
  if (!o) return [];
  let x=o; const names=new Set();
  for(let n=0;n<4&&x;n++,x=Object.getPrototypeOf(x)){
    Object.getOwnPropertyNames(x).forEach(p=>names.add(p));
  }
  return [...names].filter(x=>!/^(constructor|clone|delete|isDeleted)$/.test(x)).sort();
};
console.log("=== BETA NURBS SURFACE / FACE BUILDER ===");
const rhinoSurf = safe("new NurbsSurface",()=>new rhino.NurbsSurface(3, false, 2, 2, 2, 2));
if(rhinoSurf){
 const pts=rhinoSurf.points;
 console.log("Rhino surface points/knots",pts.countU,pts.countV,rhinoSurf.knotsU.count,rhinoSurf.knotsV.count);
 safe("surface point 00",()=>pts.setPoint(0,0,{X:0,Y:0,Z:0}));
 safe("surface point 01",()=>pts.setPoint(0,1,{X:0,Y:10,Z:0}));
 safe("surface point 10",()=>pts.setPoint(1,0,{X:20,Y:0,Z:0}));
 safe("surface point 11",()=>pts.setPoint(1,1,{X:20,Y:10,Z:0}));
 safe("knotU0",()=>rhinoSurf.knotsU.set(0,0));
 safe("knotU1",()=>rhinoSurf.knotsU.set(1,1));
 safe("knotV0",()=>rhinoSurf.knotsV.set(0,0));
 safe("knotV1",()=>rhinoSurf.knotsV.set(1,1));
 safe("surface pointAt",()=>rhinoSurf.pointAt(0.5,0.5));
 const brep=safe("surface to Brep",()=>rhino.Brep.createFromSurface(rhinoSurf));
 if(brep){
  console.log("Brep counts",brep.faces.count,brep.edges.count,brep.trims.count,brep.loops.count,"isSolid",brep.isSolid);
  console.log("isValid",safe("Brep valid topology",()=>brep.isValidTopology()));
 }
 const bare=new rhino.Brep();
 const f=safe("bare faces.add",()=>bare.faces.add(rhinoSurf));
 console.log("bare Brep counts",bare.faces.count,bare.edges.count,bare.trims.count,bare.loops.count, "face",!!f);
 console.log("bare valid",safe("bare BRep topology",()=>bare.isValidTopology()));
}

console.log("=== OCCT SURFACE CONVERSION ===");
for(const shape of [replicad.makeBaseBox(20,30,10),replicad.makeBaseBox(20,30,10).fillet(2)]){
 const faces=shape.faces;
 const chosen=[faces.find(f=>f.geomType==="PLANE"),faces.find(f=>f.geomType==="CYLINDRE")].filter(Boolean);
 console.log("shape face count",faces.length,"sample face types",chosen.map(f=>f.geomType));
 for(const face of chosen){
  console.log("face type and bounds",face.geomType,JSON.stringify(face.UVBounds));
  const source=safe("OCCT BRep_Tool.Surface",()=>oc.BRep_Tool.Surface(face.wrapped));
  if(!source)continue;
  console.log("OCCT handle methods",methods(source).slice(0,40).join(","));
  const bs=safe("OCCT SurfaceToBSplineSurface",()=>oc.GeomConvert.SurfaceToBSplineSurface(source));
  if(!bs)continue;
  console.log("BSpline surface methods",methods(bs).slice(0,140).join(","));
  for(const [name,fn] of [
    ["NbUPoles",()=>bs.NbUPoles()],["NbVPoles",()=>bs.NbVPoles()],
    ["UDegree",()=>bs.UDegree()],["UKnots count",()=>bs.NbUKnots()],
    ["UKnot1",()=>bs.UKnot(1)],["Pole11",()=>{const p=bs.Pole(1,1);return [p.X(),p.Y(),p.Z()]}],
    ["Weight11",()=>bs.Weight(1,1)],
    ["UPeriod",()=>bs.IsUPeriodic()],
    ["VPeriod",()=>bs.IsVPeriodic()],
  ])safe(name,fn);
  console.log("CurveOnSurface arity",oc.BRep_Tool.CurveOnSurface.length,"Curve arity",oc.BRep_Tool.Curve.length);
  const wire=face.wires?.[0];
  if(wire){
   console.log("wire edges",wire.edges.length);
   const edge=wire.edges[0];
   for(const action of [
      ["pc(edge,face)",()=>oc.BRep_Tool.CurveOnSurface(edge.wrapped,face.wrapped)],
      ["pc(edge,face,0,0)",()=>oc.BRep_Tool.CurveOnSurface(edge.wrapped,face.wrapped,0,0)],
      ["curve(edge)",()=>oc.BRep_Tool.Curve(edge.wrapped)]
   ])safe(action[0],()=>{const out=action[1]();return methods(out).slice(0,45)});
  }
 }
}
console.log("SURFACE PROBE COMPLETED");

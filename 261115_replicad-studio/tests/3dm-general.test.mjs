import test from "node:test";
import assert from "node:assert/strict";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { DEMOS } from "../examples.js";

const inspect = x => {
  if (!x) return "(missing)";
  const seen = new Set();
  for(let p=x,i=0;p&&i<4;p=Object.getPrototypeOf(p),i++)
    for(const name of Object.getOwnPropertyNames(p)) if(!name.startsWith("_")) seen.add(name);
  return [...seen].filter(n => /BSpline|Curve|Surface|Pole|Knot|Degree|Weight|First|Last|Value|Point|Handle|Geom|Axis|Constructor|D0|D1|Trim|Perform|Shape|Parameter|Bounds/i.test(n)).sort().join(" ");
};
const attempt = (name, fn) => {
  try { const result=fn(); console.log(name,"OK",result==null?String(result):inspect(result).slice(0,800)); return result; }
  catch(e){console.log(name,"FAILED",e?.message||String(e));return null;}
};

test("probe OCCT exact surface and pcurve access on actual filleted Boolean", {timeout:120000}, async () => {
 const oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const faces=shape.faces;const edges=shape.edges;
 console.log("total faces",faces.length,"edges",edges.length);
 console.log("face types",faces.reduce((a,f)=>{a[f.geomType]=(a[f.geomType]||0)+1;return a},{}));
 console.log("edge types",edges.reduce((a,e)=>{a[e.geomType]=(a[e.geomType]||0)+1;return a},{}));
 console.log("OCCT NurbsConvert",Boolean(oc.BRepBuilderAPI_NurbsConvert),"TrimmedSurface",Boolean(oc.Geom_RectangularTrimmedSurface),"CurveOnSurface type",typeof oc.BRep_Tool.CurveOnSurface);
 const chosen=new Map();faces.forEach(f=>{if(!chosen.has(f.geomType))chosen.set(f.geomType,f);});
 for(const [type,face] of chosen){
  console.log("FACE",type,face.UVBounds);
  const base=attempt("Base "+type,()=>oc.BRep_Tool.Surface(face.wrapped));
  const adaptor=attempt("adaptor "+type,()=>new oc.BRepAdaptor_Surface(face.wrapped,true));
  if(adaptor) console.log("adaptor methods",inspect(adaptor).slice(0,1500));
  const bs=attempt("surface -> spline "+type,()=>oc.GeomConvert.SurfaceToBSplineSurface(base));
  if(bs) {
    for(const method of ["NbUPoles","NbVPoles","UDegree","VDegree","NbUKnots","NbVKnots"]) {
      attempt(method+" "+type,()=>{const x=bs[method]();console.log(method+" value",x);return x;});
    }
    attempt("pole11 "+type,()=>{const p=bs.Pole(1,1);console.log("pole coords",p.X(),p.Y(),p.Z());return p});
  }
  if(adaptor && typeof adaptor.BSpline==="function")attempt("adaptor BSpline "+type,()=>adaptor.BSpline());
  const wires=face.wires;
  for(const wire of wires.slice(0,2)){
    const es=wire.edges;
    for(const edge of es.slice(0,1)){
      console.log("edge of face",type,edge.geomType,"closed?",edge.isClosed);
      const pc=attempt("pcurve "+type,()=>oc.BRep_Tool.CurveOnSurface(edge.wrapped,face.wrapped,0,0,false));
      if(pc) {
        console.log("pcurve",type,pc.First,pc.Last,"curve methods",inspect(pc.returnValue||pc.C));
        attempt("convert pcurve "+type,()=>oc.Geom2dConvert.CurveToBSplineCurve(pc.returnValue||pc.C));
      }
      const curve=attempt("curve3d "+type,()=>oc.BRep_Tool.Curve(edge.wrapped));
      if(curve) console.log("curve3d result",Object.keys(curve),curve.First,curve.Last);
    }
    es.forEach(e=>e.delete());wire.delete();
  }
 }
 faces.forEach(f=>f.delete());edges.forEach(e=>e.delete());
 assert.ok(chosen.size>2);
});

import test from "node:test";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { DEMOS } from "../examples.js";

const out=(label,fn)=>{try {let value=fn();console.log(label,JSON.stringify(value).slice(0,600));return value;}catch(e){console.log(label,"ERROR",String(e?.message||e));return null;}};
test("probe exact OCCT 2d pcurves, NURBS geometry and UV parameterization", {timeout:120000},async()=>{
 const oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 let faceTypes=new Map();
 for(const f of shape.faces){ if(!faceTypes.has(f.geomType))faceTypes.set(f.geomType,f); else f.delete();}
 for(const [kind,f] of faceTypes){
  console.log("FACE",kind,"bounds",JSON.stringify(f.UVBounds));
  const geom=oc.BRep_Tool.Surface(f.wrapped);
  const bs=out("B-spline "+kind,()=>oc.GeomConvert.SurfaceToBSplineSurface(geom));
  if(bs){
   out("BS bounds "+kind,()=>bs.Bounds());
   for(let i=1;i<=bs.NbUKnots();i++)out("U knot "+i,()=>[bs.UKnot(i),bs.UMultiplicity(i)]);
   for(let i=1;i<=bs.NbVKnots();i++)out("V knot "+i,()=>[bs.VKnot(i),bs.VMultiplicity(i)]);
   const b=f.UVBounds;
   for(const [u,v] of [[b.uMin,b.vMin],[(b.uMin+b.uMax)/2,(b.vMin+b.vMax)/2],[b.uMax,b.vMax]]){
    out("point orig spline "+kind,()=>{
      const p=geom.Value(u,v),q=bs.Value(u,v);
      return {uv:[u,v],geom:[p.X(),p.Y(),p.Z()],bspline:[q.X(),q.Y(),q.Z()],distance:p.Distance(q)};
    });
   }
  }
  const w=f.wires[0];const e=w.edges[0];
  console.log("sample edge",kind,e.geomType,"surface has BRepAdaptor_Curve2d",!!oc.BRepAdaptor_Curve2d);
  for(const args of [
   [e.wrapped,f.wrapped,0,0,false],
   [e.wrapped,f.wrapped,0,0],
   [e.wrapped,f.wrapped],
   [e.wrapped,geom,new oc.TopLoc_Location(),0,0,false],
  ]) out("pc with "+args.length+" args "+kind,()=>{
      const result=oc.BRep_Tool.CurveOnSurface(...args);
      return {keys:Object.keys(result||{}),First:result?.First,Last:result?.Last,hasReturnValue:!!result?.returnValue};
  });
  if(oc.BRepAdaptor_Curve2d){
   const adapt=out("BRepAdaptor_Curve2d "+kind,()=>new oc.BRepAdaptor_Curve2d(e.wrapped,f.wrapped));
   if(adapt){
    for(const n of ["GetType","FirstParameter","LastParameter","BSpline"])if(typeof adapt[n]==="function")out("Adaptor "+n+" "+kind,()=>adapt[n]());
    adapt.delete?.();
   }
  }
  const c=oc.BRep_Tool.Curve(e.wrapped);
  out("3d curve properties "+kind,()=>({First:c.First,Last:c.Last,hasValue:!!c.returnValue,constructor:c.returnValue?.constructor?.name}));
  if(c.returnValue){
    const nb=out("3d -> NURBS "+kind,()=>oc.GeomConvert.CurveToBSplineCurve(c.returnValue));
    if(nb){
      out("Nurbs degree poles "+kind,()=>[nb.Degree(),nb.NbPoles(),nb.NbKnots()]);
      out("Nurbs knots "+kind,()=>Array.from({length:nb.NbKnots()},(_,i)=>[nb.Knot(i+1),nb.Multiplicity(i+1)]));
    }
  }
  e.delete();w.edges.slice(1).forEach(x=>x.delete());w.delete();
 }
 faceTypes.forEach(f=>f.delete());
});

import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import {DEMOS} from "../examples.js";
test("probe converting actual torus/sphere surface and circular edge to rhino rational NURBS", {timeout:120000}, async()=>{
 const rh=await initRhino(),oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 let found=new Set();
 for(const face of shape.faces){
  if(["TORUS","SPHERE"].includes(face.geomType)&&!found.has(face.geomType)){
   found.add(face.geomType);
   const surface=oc.BRep_Tool.Surface(face.wrapped);
   const bs=oc.GeomConvert.SurfaceToBSplineSurface(surface);
   const inspect=()=>({
      dims:[bs.NbUPoles(),bs.NbVPoles()],degrees:[bs.UDegree(),bs.VDegree()],
      periods:[bs.IsUPeriodic(),bs.IsVPeriodic()],
      u:Array.from({length:bs.NbUKnots()},(_,i)=>[bs.UKnot(i+1),bs.UMultiplicity(i+1)]),
      v:Array.from({length:bs.NbVKnots()},(_,i)=>[bs.VKnot(i+1),bs.VMultiplicity(i+1)]),
   });
   console.log(face.geomType,"BEFORE",JSON.stringify(inspect()));
   if(bs.IsUPeriodic())bs.SetUNotPeriodic();
   if(bs.IsVPeriodic())bs.SetVNotPeriodic();
   console.log(face.geomType,"AFTER",JSON.stringify(inspect()));
   const nu=bs.NbUPoles(),nv=bs.NbVPoles(),du=bs.UDegree(),dv=bs.VDegree();
   const surf=new rh.NurbsSurface(3,true,du+1,dv+1,nu,nv);
   for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){
      const p=bs.Pole(u+1,v+1);
      const w=bs.Weight(u+1,v+1);
      if(!surf.points.setPoint(u,v,{X:p.X(),Y:p.Y(),Z:p.Z()}))throw Error("setPoint failed");
      if(!surf.points.setWeight(u,v,w))throw Error("setWeight failed");
   }
   const expand=(values)=>values.flatMap(([value,m])=>Array.from({length:m},()=>value)).slice(1,-1);
   const uknots=expand(inspect().u),vknots=expand(inspect().v);
   console.log("knot counts",face.geomType,uknots.length,surf.knotsU.count,vknots.length,surf.knotsV.count);
   if(uknots.length===surf.knotsU.count&&vknots.length===surf.knotsV.count){
    uknots.forEach((value,i)=>surf.knotsU.set(i,value));
    vknots.forEach((value,i)=>surf.knotsV.set(i,value));
    const bounds=face.UVBounds;
    const u=(bounds.uMin+bounds.uMax)/2,v=(bounds.vMin+bounds.vMax)/2;
    const expected=face.pointOnSurface(u,v);
    const actual=surf.pointAt(u,v);
    const err=Math.hypot(expected.x-actual.X,expected.y-actual.Y,expected.z-actual.Z);
    const reference=bs.Value(u,v);
    console.log("Rhino NURBS",face.geomType,"error using same UV",err,"isValid",surf.isValid,
      "orig",expected.toTuple(),"oc bs", [reference.X(),reference.Y(),reference.Z()],
      "rh",actual,"surface-domain",surf.domain(0),surf.domain(1));
    for(const [ii,jj] of [[0,0],[0,1],[1,0],[1,1]]){
      const cp=bs.Pole(ii+1,jj+1);
      console.log(face.geomType,"CONTROL",ii,jj, "original",[cp.X(),cp.Y(),cp.Z(),bs.Weight(ii+1,jj+1)],
        "rh getPoint",surf.points.getPoint(ii,jj),"rh getPoint4d",surf.points.getPoint4d(ii,jj),"weight",surf.points.getWeight(ii,jj));
    }
    expected.delete();
    const brep=rh.Brep.createFromSurface(surf);
    console.log("surface brep",face.geomType,brep?.faces.count,brep?.isValidGeometry());
   }
  }
  face.delete();
 }
 const edge=shape.edges.find(e=>e.geomType==="CIRCLE");
 const info=oc.BRep_Tool.Curve(edge.wrapped);
 const trim=new oc.Geom_TrimmedCurve(info.returnValue,info.First,info.Last);
 const bs=oc.GeomConvert.CurveToBSplineCurve(trim);
 console.log("EDGE",bs.NbPoles(),bs.Degree(),bs.NbKnots(),
   bs.IsPeriodic(),Array.from({length:bs.NbKnots()},(_,i)=>[bs.Knot(i+1),bs.Multiplicity(i+1)]));
 if(bs.IsPeriodic())bs.SetNotPeriodic();
 const cv=new rh.NurbsCurve(3,true,bs.Degree()+1,bs.NbPoles());
 for(let i=0;i<bs.NbPoles();i++){
  const p=bs.Pole(i+1);
  cv.points.setPoint(i,{X:p.X(),Y:p.Y(),Z:p.Z()});
  cv.points.setWeight(i,bs.Weight(i+1));
 }
 console.log("RHINO curve knot count",cv.knots.count,bs.NbPoles()+bs.Degree()-1);
 const knots=Array.from({length:bs.NbKnots()},(_,i)=>Array.from({length:bs.Multiplicity(i+1)},()=>bs.Knot(i+1))).flat().slice(1,-1);
 knots.forEach((v,i)=>cv.knots.set(i,v));
 const p0=cv.pointAtStart,p1=cv.pointAtEnd;
 console.log("rational edge start/end",p0,p1,edge.startPoint.toTuple(),edge.endPoint.toTuple());
 assert.ok(cv.points.count>=3);
});

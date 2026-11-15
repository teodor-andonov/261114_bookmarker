import test from "node:test";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import {DEMOS} from "../examples.js";
const xyz=p=>[p.X(),p.Y(),p.Z()];
test("probe whether OCCT periodic surface conversion modifies original face parameterization", {timeout:120000},async()=>{
 const oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(d=>d.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const done=new Set();
 for(const face of shape.faces){
  if(!["TORUS","SPHERE"].includes(face.geomType)||done.has(face.geomType)){face.delete();continue;}
  done.add(face.geomType);
  const bounds=face.UVBounds,u=(bounds.uMin+bounds.uMax)/2,v=(bounds.vMin+bounds.vMax)/2;
  const base=oc.BRep_Tool.Surface(face.wrapped);
  const beforeFace=face.pointOnSurface(u,v);const before=beforeFace.toTuple();beforeFace.delete();
  const beforeBase=xyz(base.Value(u,v));
  const bs=oc.GeomConvert.SurfaceToBSplineSurface(base);
  const bsBefore=xyz(bs.Value(u,v));
  const convertFace=face.pointOnSurface(u,v);const afterConversion=convertFace.toTuple();convertFace.delete();
  if(bs.IsUPeriodic())bs.SetUNotPeriodic();
  if(bs.IsVPeriodic())bs.SetVNotPeriodic();
  const convertBS=xyz(bs.Value(u,v));
  const newFace=face.pointOnSurface(u,v);const afterUnperiodic=newFace.toTuple();newFace.delete();
  const afterBase=xyz(base.Value(u,v));
  console.log("MUTATION",face.geomType,{bounds,before, beforeBase,bsBefore,afterConversion,convertBS,afterUnperiodic,afterBase});
  face.delete();
 }
});

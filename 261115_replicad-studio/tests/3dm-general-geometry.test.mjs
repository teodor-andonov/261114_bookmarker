import test from "node:test";
import assert from "node:assert/strict";
import initOC from "replicad-opencascadejs";
import initRhino from "rhino3dm-beta";
import * as replicad from "replicad";
import { DEMOS } from "../examples.js";
import { makeNurbsFace, makeNurbsEdge } from "../occt-nurbs-geometry.js";

test("all 63 complex demo faces become accurate rational Rhino NURBS surfaces", {timeout:120000},async()=>{
 const rh=await initRhino(),oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const faces=shape.faces;
 let passed=0;
 for(const face of faces){
  try {
   const data=makeNurbsFace(face,rh,oc);
   const b=face.UVBounds,u=(b.uMin+b.uMax)/2,v=(b.vMin+b.vMax)/2;
   const [U,V]=data.map([u,v]);
   const origin=face.pointOnSurface((u-b.uMin)/(b.uMax-b.uMin),(v-b.vMin)/(b.vMax-b.vMin)),mapped=data.surface.pointAt(U,V);
   const error=Math.hypot(origin.x-mapped.X,origin.y-mapped.Y,origin.z-mapped.Z);
   origin.delete();
   assert.ok(error<3e-5,face.geomType+" surface mapping error "+error);
   assert.ok(data.surface.isValid);
   passed++;
   data.surface.delete?.();
  } catch(error) {
   console.log("FACE FAILED",passed,"type",face.geomType,"bounds",face.UVBounds,"error",error?.message||String(error));
   throw error;
  } finally{face.delete();}
 }
 assert.equal(passed,63);
 console.log("Complex demo: 63 exact surface geometries mapped to Rhino NURBS");
});

test("all 143 complex demo 3D edges become exact Rhino curves", {timeout:120000},async()=>{
 const rh=await initRhino(),oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const edges=shape.edges;let count=0;
 for(const edge of edges){
   try{
    const data=makeNurbsEdge(edge,rh,oc);
    const a=edge.startPoint,b=edge.endPoint;
    const ds=Math.min(
       Math.hypot(...[a.x-data.a[0],a.y-data.a[1],a.z-data.a[2]]),
       Math.hypot(...[a.x-data.b[0],a.y-data.b[1],a.z-data.b[2]])
    );
    a.delete();b.delete();
    assert.ok(ds<1e-5,"NURBS curve does not start/end on source OCCT edge "+ds);
    count++;data.curve?.delete?.();
   }catch(error){
    console.log("EDGE FAILED",count,"type",edge.geomType,"error",error?.message||String(error));throw error;
   }finally{edge.delete();}
 }
 assert.equal(count,143);
 console.log("Complex demo: 143 exact 3D edge curves transferred");
});

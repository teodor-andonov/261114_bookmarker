import test from "node:test";
import assert from "node:assert/strict";
import {build,roundTrip} from "../model.js";
import {DEMOS} from "../examples.js";
import {parameterEdit} from "../param-source.js";
for(const demo of DEMOS) test(demo.name+" native USDA",()=>{
  const built=build(demo.source);
  assert.match(built.usda,/BrepArray/i);
  assert.equal(built.usda.startsWith("#usda"),true);
  assert.ok(built.meshes.every(m=>m.indices.length>0 && m.corners.length===m.indices.length*3 && m.normals?.length===m.corners.length && m.lines.length>0));
  const result=roundTrip(built.usda);
  assert.equal(result.length,built.meshes.length);
  for(let i=0;i<result.length;i++){
    const a=built.meshes[i],b=a.name?result.find(x=>x.name===a.name):result[i];
    assert.ok(b,"Missing object "+a.name);
    assert.ok(a.volume>0);
    assert.ok(Math.abs(a.volume-b.volume)<Math.max(1e-5,a.volume*1e-5));
    assert.equal(a.faces,b.faces);
  }
});
test("box dimensions and mesh option",()=>{
 const a=build(DEMOS[0].source,true);
 assert.equal(a.meshes[0].faces,6);
 assert.ok(Math.abs(a.meshes[0].volume-96000)<0.01);
 assert.match(a.usda,/\bMesh\b/);
 assert.equal(roundTrip(a.usda).length,1);
});
test("parameter source editing",()=>{const a=parameterEdit(DEMOS[0].source,"width",100);assert.equal(build(a.source).params.width,100);});
test("mesh-only results rejected",()=>assert.throws(()=>build("const main = sm => sm.tessellate(sm.Box(1,1,1));"),/B-reps/));

test("box uses hard face normals rather than averaged vertex normals",()=>{
 const m=build(DEMOS[0].source).meshes[0];
 assert.equal(m.normals.length,m.corners.length);
 assert.ok(m.normals.every(n=>Math.abs(n)<1e-5||Math.abs(Math.abs(n)-1)<1e-5));
 for(let i=0;i<m.normals.length;i+=9){
   for(let j=3;j<9;j++) assert.ok(Math.abs(m.normals[i+j]-m.normals[i+j%3])<1e-5);
 }
 assert.equal(m.lines.length,12*6);
});

test("Galaxy SOHO detailed components and named material metadata",()=>{
 const demo=DEMOS.find(d=>d.name.startsWith("Galaxy SOHO"));
 const a=build(demo.source);
 const names=a.meshes.map(m=>m.name);
 assert.ok(a.meshes.length>140,"Expected detailed building rather than four masses");
 assert.equal(new Set(names).size,names.length);
 for(const id of ["A","B","C","D"]){
   assert.ok(names.includes("Tower_"+id+"_Rounded_Roof_Crown"));
   assert.ok(names.includes("Tower_"+id+"_White_Oculus_Rim"));
   assert.ok(names.some(n=>n.startsWith("Tower_"+id)&&n.endsWith("Atrium_Glazing")));
 }
 assert.ok(names.some(n=>n.startsWith("Bridge_AD_Skybridge")));
 assert.ok(names.includes("Central_Canyon_Water_Feature"));
 assert.match(a.usda,/Material/);
 assert.ok(a.meshes.every(m=>m.color!=null));
 const b=roundTrip(a.usda);
 for(const m of a.meshes){
   const other=b.find(e=>e.name===m.name);
   assert.ok(other?.color!=null,m.name+" missing color");
 }
});


import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {buildMesh3dm,createMesh3dmSession} from "../rhino-core.js";
const quad=(name,layerName,materialColor=null,materialName=null,z=0)=>({
  name,path:"|MASSING|"+name+"|"+name+"Shape",layerName,
  materialColor,materialName,
  vertices:[[0,0,z],[1,0,z],[1,1,z],[0,1,z]],
  faces:[[0,1,2,3]]
});
test("3DM uses only actual named display layers, not transform paths",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const objects=[quad("A","Facade"),quad("B","Structure",null,null,1)];
  const model={unit:"cm",displayLayers:[
    {name:"Facade",color:{r:26,g:51,b:77}},
    {name:"Structure"},
    {name:"Unused"}
  ],objects};
  const result=buildMesh3dm(model,rhino);
  assert.equal(result.exported,2);
  assert.equal(result.layers,3);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.equal(doc.layers().count,3);
    assert.deepEqual([0,1,2].map(i=>doc.layers().get(i).name),
      ["Facade","Structure","Unused"]);
    assert.deepEqual(doc.layers().get(0).color,{r:26,g:51,b:77,a:255});
    assert.equal(doc.objects().get(0).attributes().layerIndex,0);
    assert.equal(doc.objects().get(1).attributes().layerIndex,1);
  }finally{doc.destroy();}
});
test("real Rhino material is shared by objects and RGB is applied",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const color={r:220,g:55,b:11};
  const objects=[quad("A","Facade",color,"brick"),quad("B","Facade",color,"brick",1)];
  const result=buildMesh3dm({unit:"m",objects,displayLayers:[{name:"Facade"}]},rhino);
  assert.equal(result.materials,1);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.equal(doc.materials().count,1);
    for(let i=0;i<2;i++){
      const attr=doc.objects().get(i).attributes();
      assert.equal(attr.materialSource,rhino.ObjectMaterialSource.MaterialFromObject);
      assert.equal(attr.materialIndex,0);
      assert.equal(attr.colorSource,rhino.ObjectColorSource.ColorFromObject);
      assert.deepEqual(attr.objectColor,{r:220,g:55,b:11,a:255});
    }
    const savedMaterial=doc.materials().get(0);
    assert.equal(savedMaterial.name,"brick");
    assert.equal(savedMaterial.diffuseColor.r,220);
    assert.equal(savedMaterial.diffuseColor.g,55);
    assert.equal(savedMaterial.diffuseColor.b,11);
  }finally{doc.destroy();}
});
test("session still writes incrementally",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const objects=[quad("A","Default"),quad("B","Default",null,null,1)];
  const s=createMesh3dmSession({unit:"cm",objects},rhino);
  try{s.addObject(objects[0]);s.addObject(objects[1]);
    assert.equal(s.finish().exported,2);
  }finally{s.dispose();}
});

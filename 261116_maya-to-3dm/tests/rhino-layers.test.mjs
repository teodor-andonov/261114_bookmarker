import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {buildMesh3dm,createMesh3dmSession} from "../rhino-core.js";

const quad=(name,path,z=0)=>({
 name,path,vertices:[[0,0,z],[1,0,z],[1,1,z],[0,1,z]],faces:[[0,1,2,3]]
});
test("Rhino 3DM contains nested Maya layers and correct object layer indices",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const objects=[
    quad("facadeA","|MASSING|facadeA|facadeAShape"),
    quad("facadeB","|MASSING|facadeB|facadeBShape",1)
  ];
  const result=buildMesh3dm({unit:"cm",objects},rhino);
  assert.equal(result.exported,2);
  assert.equal(result.layers,3);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.equal(doc.layers().count,3);
    const root=doc.layers().get(0),leafA=doc.layers().get(1),leafB=doc.layers().get(2);
    assert.equal(root.name,"MASSING");
    assert.equal(leafA.parentLayerId,root.id);
    assert.equal(leafB.parentLayerId,root.id);
    assert.equal(doc.objects().get(0).attributes().layerIndex,1);
    assert.equal(doc.objects().get(1).attributes().layerIndex,2);
  }finally{doc.destroy();}
});
test("incremental session and normal export produce the same Rhino geometry",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const objects=[quad("A","|Group|A|Shape"),quad("B","|Group|B|Shape")];
  const session=createMesh3dmSession({unit:"m",objects},rhino);
  try{
    session.addObject(objects[0]);session.addObject(objects[1]);
    const result=session.finish();
    assert.equal(result.exported,2);
    assert.equal(result.skipped.length,0);
  }finally{session.dispose();}
});

import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {applyLayerMode,layerCatalog,objectGroupPaths,groupCatalog} from "../layers.js";
import {buildMesh3dm} from "../rhino-core.js";

const quad=(name,path,materialName=null,materialColor=null,layerName="Default",z=0)=>({
  name,path,layerName,materialName,materialColor,
  vertices:[[0,0,z],[1,0,z],[1,1,z],[0,1,z]],faces:[[0,1,2,3]]
});
const color={r:115,g:80,b:55};
const model={
  unit:"cm",displayLayers:[{name:"OriginalDisplay",color:{r:1,g:2,b:3}}],
  objects:[
    quad("Wall","|Building|East|Wall|WallShape","Brick",color,"OriginalDisplay"),
    quad("Roof","|Building|East|Roof|RoofShape","Metal",null,"OriginalDisplay",1),
    quad("Furniture","|Building|West|Chair|ChairShape",null,null,"OriginalDisplay",2)
  ]
};
test("material mode generates one layer per material and Unassigned, not per object",()=>{
  const result=applyLayerMode(model,"material");
  assert.deepEqual(result.displayLayers.map(x=>x.name),["Brick","Metal","Unassigned"]);
  assert.deepEqual(result.objects.map(x=>x.layerName),["Brick","Metal","Unassigned"]);
  assert.deepEqual(layerCatalog(result.objects,result.displayLayers).find(x=>x.name==="Brick").color,color);
  assert.equal(result.objects[0].materialName,"Brick");
  assert.equal(model.objects[0].layerName,"OriginalDisplay"); // no mutation
  assert.deepEqual(applyLayerMode(model,"display").objects,model.objects);
  assert.throws(()=>applyLayerMode(model,"unsupported"),/Unknown layer mode/);
});
test("Rhino groups follow Maya ancestor transforms, excluding object shape transforms",()=>{
  assert.deepEqual(objectGroupPaths(model.objects[0]),["|Building","|Building|East"]);
  const groups=groupCatalog(model.objects);
  assert.deepEqual(groups.map(x=>x.name),["Building","Building::East","Building::West"]);
  assert.deepEqual(groups.map(x=>x.count),[3,2,1]);
  assert.deepEqual(objectGroupPaths(quad("Single","|Single|SingleShape")),[]);
});
test("3DM contains material-based layers and overlapping Maya ancestor groups",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const result=buildMesh3dm(applyLayerMode(model,"material"),rhino);
  assert.equal(result.exported,3);
  assert.equal(result.layers,3);
  assert.equal(result.groups,3);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.equal(doc.layers().count,3);
    assert.deepEqual([0,1,2].map(i=>doc.layers().get(i).name),["Brick","Metal","Unassigned"]);
    assert.equal(doc.groups().count,3);
    assert.deepEqual([0,1,2].map(i=>doc.groups().get(i).name),
      ["Building","Building::East","Building::West"]);
    assert.deepEqual(doc.groups().groupMembers(0).length,3);
    assert.equal(doc.groups().groupMembers(1).length,2);
    assert.equal(doc.groups().groupMembers(2).length,1);
    assert.deepEqual(doc.objects().get(0).attributes().getGroupList(),[0,1]);
    assert.deepEqual(doc.objects().get(1).attributes().getGroupList(),[0,1]);
    assert.deepEqual(doc.objects().get(2).attributes().getGroupList(),[0,2]);
    assert.deepEqual([0,1,2].map(i=>doc.objects().get(i).attributes().layerIndex),[0,1,2]);
  }finally{doc.destroy();}
});
test("optional exportGroups=false yields no groups without disturbing layers",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const data={...applyLayerMode(model,"material"),exportGroups:false};
  const result=buildMesh3dm(data,rhino);
  assert.equal(result.groups,0);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.equal(doc.groups().count,0);
    assert.equal(doc.layers().count,3);
  }finally{doc.destroy();}
});
test("filtered mesh export keeps groups with only surviving members",{timeout:120000},async()=>{
  const rhino=await initRhino();
  const modified=applyLayerMode(model,"material");
  const result=buildMesh3dm({...modified,objects:[modified.objects[2]]},rhino);
  assert.equal(result.groups,2);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.deepEqual([0,1].map(i=>doc.groups().get(i).name),["Building","Building::West"]);
    assert.equal(doc.groups().groupMembers(0).length,1);
    assert.equal(doc.groups().groupMembers(1).length,1);
  }finally{doc.destroy();}
});

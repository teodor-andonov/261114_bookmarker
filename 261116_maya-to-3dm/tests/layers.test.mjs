import test from "node:test";
import assert from "node:assert/strict";
import {objectLayerKey,layerCatalog,visibleOnLayer,layerColor} from "../layers.js";
const objects=[
  {path:"|MASSING|wingA|wall|wallShape",layerName:"Facade"},
  {path:"|MASSING|wingA|roof|roofShape",layerName:"Facade"},
  {path:"|MASSING|wingB|wall|wallShape",layerName:"Structure"},
  {path:"|looseShape",layerName:"Default"}
];
test("only Maya display layers and a fallback Default, not every transform",()=>{
  const layers=layerCatalog(objects,[{name:"Facade"},{name:"Structure"}]);
  assert.deepEqual(layers.map(l=>l.name),["Facade","Structure","Default"]);
  assert.equal(layers.find(l=>l.name==="Facade").count,2);
  assert.equal(objectLayerKey(objects[0]),"Facade");
  assert.equal(layers.every(l=>l.parent===null),true);
});
test("visibility is independent per display layer",()=>{
  const flags=new Map([["Facade",false]]);
  assert.equal(visibleOnLayer(objectLayerKey(objects[0]),flags),false);
  assert.equal(visibleOnLayer(objectLayerKey(objects[2]),flags),true);
});
test("saved RGB overrides win over fallback, and seeded colours stay stable",()=>{
  const custom={r:50,g:100,b:150};
  const layers=layerCatalog(objects,[{name:"Facade",color:custom}]);
  assert.deepEqual(layers.find(l=>l.name==="Facade").color,custom);
  assert.deepEqual(layerColor("Structure"),layerColor("Structure"));
});
test("empty actual Maya layers can exist in Rhino",()=>{
  const a=layerCatalog([],[{name:"Unused",visible:false}]);
  assert.equal(a.length,1);
  assert.equal(a[0].visible,false);
});

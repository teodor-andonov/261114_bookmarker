import test from "node:test";
import assert from "node:assert/strict";
import {objectLayerKey,layerCatalog,visibleOnLayer} from "../layers.js";

const objs=[
  {path:"|MASSING|wingA|wall|wallShape"},
  {path:"|MASSING|wingA|roof|roofShape"},
  {path:"|MASSING|wingB|wall|wallShape"},
  {path:"|looseShape"}
];
test("full DAG becomes parent/child Rhino layer hierarchy",()=>{
  const layers=layerCatalog(objs);
  assert.equal(objectLayerKey(objs[0]),"|MASSING|wingA|wall");
  assert.deepEqual(layers.find(l=>l.id==="|MASSING|wingA|wall").parent,"|MASSING|wingA");
  assert.equal(layers.find(l=>l.id==="|MASSING").count,3);
  assert.equal(objectLayerKey(objs[3]),"|Ungrouped");
});
test("a hidden ancestor hides descendants but does not affect siblings",()=>{
  const flags=new Map([["|MASSING|wingA",false]]);
  assert.equal(visibleOnLayer(objectLayerKey(objs[0]),flags),false);
  assert.equal(visibleOnLayer(objectLayerKey(objs[2]),flags),true);
  assert.equal(visibleOnLayer(objectLayerKey(objs[3]),flags),true);
});
test("stable distinct sublayer colors",()=>{
  const a=layerCatalog(objs),b=layerCatalog(objs);
  assert.deepEqual(a.map(x=>x.color),b.map(x=>x.color));
});

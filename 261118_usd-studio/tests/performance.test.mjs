import test from "node:test";
import assert from "node:assert/strict";
import {evaluate,disposeModel,meshShape,fingerprint,checkedExport} from "../model.js";
import {PreviewCache} from "../preview-cache.js";
import {DEMOS} from "../examples.js";
test("exact geometry cache survives identical rebuilds and rejects changed bodies",()=>{
 const a=evaluate("const main=sm=>sm.Box(80,60,20)");
 const b=evaluate("const main=sm=>sm.Box(80,60,20)");
 const c=evaluate("const main=sm=>sm.Box(81,60,20)");
 try{
  const cache=new PreviewCache();
  const mesh=meshShape(a.shapes[0],"standard");
  cache.put(fingerprint(a.shapes[0]),"standard",mesh);
  assert.equal(cache.get(fingerprint(b.shapes[0]),"standard"),mesh);
  assert.equal(cache.get(fingerprint(c.shapes[0]),"standard"),null);
  assert.equal(cache.get(fingerprint(a.shapes[0]),"high"),null);
 }finally{[a,b,c].forEach(disposeModel);}
});
test("Galaxy benchmark: legacy versus standard, exact export independent of quality",{timeout:180000},()=>{
 const t=performance.now(),model=evaluate(DEMOS.find(x=>x.name.startsWith("Galaxy SOHO")).source);
 try{
  const modeling=Math.round(performance.now()-t);
  const run=q=>{const start=performance.now();let triangles=0,tess=0,prep=0;for(const shape of model.shapes){const m=meshShape(shape,q);triangles+=m.indices.length/3;tess+=m.tessMs;prep+=m.prepMs;}return {ms:Math.round(performance.now()-start),triangles,tess:Math.round(tess),prep:Math.round(prep)};};
  const legacy=run("legacy"),standard=run("standard");
  console.log("GALAXY BENCHMARK",JSON.stringify({objects:model.shapes.length,modeling,legacy,standard}));
  assert.equal(model.shapes.length,209);
  assert.ok(standard.triangles<legacy.triangles,"Standard must reduce preview triangle count");
  const a=checkedExport(model.shapes,false);
  assert.equal(a.checked.length,209);
 }finally{disposeModel(model);}
});

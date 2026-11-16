import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {parseMayaAscii} from "../maya-parser.js";
import {prepareMeshes} from "../subdivide.js";
import {buildMesh3dm} from "../rhino-core.js";

const fixture=[
  'currentUnit -l "cm";',
  'createNode transform -n "quad";',
  'createNode mesh -n "quadShape" -p "quad";',
  'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;',
  'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;',
  'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3;'
].join("\n");

test("Baked Maya mesh -> 3DM contains subdivided Rhino mesh", {timeout:120000},async()=>{
  const rhino=await initRhino();
  const model=prepareMeshes(parseMayaAscii(fixture),2);
  assert.equal(model.objects[0].faces.length,16);
  const result=buildMesh3dm(model,rhino);
  assert.equal(result.exported,1);
  assert.equal(result.skipped.length,0);
  assert.ok(result.bytes.length>100);
  const doc=rhino.File3dm.fromByteArray(result.bytes);
  try{
    assert.ok(doc);
    assert.equal(doc.objects().count,1);
    const mesh=doc.objects().get(0).geometry();
    assert.equal(mesh.faces().quadCount,16);
    assert.ok(mesh.vertices().count>4);
  }finally{doc.destroy();}
});
test("Malformed object cannot abort valid mesh export", {timeout:120000},async()=>{
  const rhino=await initRhino();
  const model=prepareMeshes(parseMayaAscii(fixture),1);
  model.objects.push({
    name:"broken",vertices:[[0,0,0]],faces:[[0,1,2]]
  });
  const result=buildMesh3dm(model,rhino);
  assert.equal(result.exported,1);
  assert.equal(result.skipped.length,1);
});

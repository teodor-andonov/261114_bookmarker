import test from "node:test";
import assert from "node:assert/strict";
import {expandPreview} from "../preview.js";
test("shared vertex retains independent exact corner normals",()=>{
 const pos=new Float32Array([0,0,0,1,0,0,0,1,0,0,0,1]);
 const idx=new Uint32Array([0,1,2,0,3,1]);
 const n=new Float32Array([0,0,1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0]);
 const p=expandPreview(pos,idx,n);
 assert.equal(p.corners.length,18);
 assert.deepEqual([...p.corners.slice(0,3)],[...p.corners.slice(9,12)]);
 assert.deepEqual([...p.normals.slice(0,3)],[0,0,1]);
 assert.deepEqual([...p.normals.slice(9,12)],[0,1,0]);
 assert.equal(expandPreview(pos,idx,new Float32Array(12)).normals,null);
});

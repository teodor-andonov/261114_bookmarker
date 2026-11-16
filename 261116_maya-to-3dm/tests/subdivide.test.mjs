import test from "node:test";
import assert from "node:assert/strict";
import {subdivideCage,prepareMeshes} from "../subdivide.js";
import {parseMayaAscii} from "../maya-parser.js";
const cube={
  name:"cube",vertices:[
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ],
  faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]
};
test("Catmull Clark produces quads, not control cages",()=>{
  const smoothed=subdivideCage(cube,2);
  assert.equal(smoothed.faces.length,96);
  assert.ok(smoothed.vertices[0][0]>0);
});
test("creased edge midpoint remains sharp for weighted crease",()=>{
  const mesh={...cube,edgeCreases:new Map([["0:1",3]])};
  const sub=subdivideCage(mesh,1);
  const midpoint=sub.vertices.find(p=>p[0]===0.5&&p[1]===0&&p[2]===0);
  assert.ok(midpoint);
});
test("duplicate short DAG names are separate valid objects",()=>{
  const part=(group)=>[
    'createNode transform -n "'+group+'";',
    'createNode transform -n "MASSING" -p "'+group+'";',
    'createNode mesh -n "shape" -p "|'+group+'|MASSING";',
    'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;',
    'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;',
    'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3;'
  ].join("\n");
  const p=parseMayaAscii(part("a")+"\n"+part("b"));
  assert.equal(p.objects.length,2);
  assert.equal(p.warnings.length,0);
  assert.notEqual(p.objects[0].path,p.objects[1].path);
});
test("Z-up files retain height axis; Y-up files rotate into Z",()=>{
  const a=parseMayaAscii('upAxis -ax z;\n'+partFixture(),{upAxis:"auto"});
  const b=parseMayaAscii(partFixture(),{upAxis:"y"});
  assert.deepEqual(a.objects[0].vertices[2],[1,1,0]);
  assert.deepEqual(b.objects[0].vertices[2],[1,0,1]);
});
function partFixture(){return [
  'createNode transform -n "square";',
  'createNode mesh -n "squareShape" -p "square";',
  'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;',
  'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;',
  'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3;'
].join("\n");}
test("semi sharp edge creases and concise warnings",()=>{
  const p=parseMayaAscii(partFixture().replace('setAttr ".fc[0]"',
    'setAttr ".cd" -type "dataPolyComponent" Index_Data Edge 1 0 2.5;\nsetAttr ".fc[0]"'));
  assert.equal(p.objects[0].edgeCreases.get("0:1"),2.5);
  const m=prepareMeshes(p,1);
  assert.equal(m.objects[0].faces.length,4);
});

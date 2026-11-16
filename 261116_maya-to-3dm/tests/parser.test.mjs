import test from "node:test";
import assert from "node:assert/strict";
import {parseMayaAscii} from "../maya-parser.js";

const header = 'currentUnit -l "cm";\ncreateNode transform -n "thing";\n' +
  'setAttr ".t" -type "double3" 5 0 0;\n' +
  'createNode mesh -n "thingShape" -p "thing";\n';
const quad = 'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;\n' +
  'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;\n' +
  'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3 mu 0 4 0 1 2 3;\n';

test("reads a quad cage, units, transforms and smooth-preview flag", () => {
  const r = parseMayaAscii(header + quad + 'setAttr ".dsm" 2;');
  assert.equal(r.objects.length, 1);
  assert.deepEqual(r.objects[0].faces, [[0,1,2,3]]);
  assert.deepEqual(r.objects[0].vertices[2], [6,0,1]);
  assert.equal(r.objects[0].quads, 1);
  assert.equal(r.objects[0].smoothPreview, true);
  assert.equal(r.unit, "cm");
});

test("decodes Maya's reversed edge id as -(index+1)", () => {
  const r = parseMayaAscii(header + quad +
    'setAttr ".fc[1]" -type "polyFaces" f 4 -4 -3 -2 -1;');
  assert.deepEqual(r.objects[0].faces[1], [0,3,2,1]);
});

test("ignores comments, intermediate shapes and non-geometry nodes", () => {
  const r = parseMayaAscii('// comment ;\n' + header + quad +
    'createNode mesh -n "origShape" -p "thing";\nsetAttr ".io" yes;\n' +
    'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;\n' +
    'createNode camera -n "camera";');
  assert.equal(r.objects.length, 1);
});

test("reports non-quad topology and construction history without simulating it", () => {
  const r = parseMayaAscii(header +
    'setAttr -s 5 ".vt[0:4]" -type "float3" 0 0 0 1 0 0 2 0 0 2 1 0 0 1 0;\n' +
    'setAttr -s 5 ".ed[0:4]" 0 1 1 1 2 1 2 3 1 3 4 1 4 0 1;\n' +
    'setAttr ".fc[0]" -type "polyFaces" f 5 0 1 2 3 4;\n' +
    'createNode polySmoothFace -n "polySmoothFace1";');
  assert.equal(r.objects[0].ngons, 1);
  assert.match(r.warnings.join(" "), /N-gons/);
  assert.match(r.warnings.join(" "), /construction-history/);
});

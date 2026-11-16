import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm";
import {parseMayaAscii} from "../maya-parser.js";
import {buildMesh3dm} from "../rhino-core.js";

test("Maya quad cage -> Rhino mesh .3dm -> verified read-back", {timeout: 60000}, async () => {
  const scene = [
    'currentUnit -l "cm";',
    'createNode transform -n "quad";',
    'createNode mesh -n "quadShape" -p "quad";',
    'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0  1 0 0  1 1 0  0 1 0;',
    'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;',
    'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3;'
  ].join("\n");
  const rhino = await initRhino();
  const bytes = buildMesh3dm(parseMayaAscii(scene),rhino);
  assert.ok(bytes.byteLength > 100);
  const doc = rhino.File3dm.fromByteArray(bytes);
  try {
    assert.ok(doc);
    assert.equal(doc.objects().count,1);
    const object = doc.objects().get(0);
    assert.equal(object.attributes().name,"quad");
    assert.equal(object.geometry().faces().quadCount,1);
    assert.equal(object.geometry().vertices().count,4);
  } finally {
    doc?.destroy();
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_FORMAT, listConversions, makeGeometryDocument, convertGeometry,
} from "../geometry-formats.js";

const bytes = text => new TextEncoder().encode(text);
const fakeShape = name => ({
  mesh: () => ({ positions: [1, 2, 3], name }),
  meshEdges: () => ({ positions: [0, 1, 2] }),
  blobSTEP: () => new Blob([bytes("STEP:" + name)]),
  blobSTL: () => new Blob([bytes("STL:" + name)]),
});
const doc = () => makeGeometryDocument([{ name: "Part 1", shape: fakeShape("Part 1") }], 8);

test("registry maps an opaque CAD document to preview, STEP, and STL", () => {
  assert.deepEqual(listConversions(SOURCE_FORMAT).map(f => f.target), ["viewer/mesh", "step", "stl"]);
  assert.equal(listConversions("other/format").length, 0);
  assert.equal(doc().revision, 8);
});
test("viewport representation comes from the same document as export", async () => {
  const result = await convertGeometry(doc(), "viewer/mesh");
  assert.equal(result.kind, "preview");
  assert.equal(result.value[0].name, "Part 1");
  assert.equal(result.value[0].faces.name, "Part 1");
});
test("STEP and STL adapters produce bytes", async () => {
  for (const target of ["step", "stl"]) {
    const result = await convertGeometry(doc(), target);
    assert.equal(result.kind, "file");
    assert.equal(new TextDecoder().decode(result.bytes), target.toUpperCase() + ":Part 1");
  }
});
test("multi-part STEP uses the assembly converter while multi-part STL rejects", async () => {
  const parts = makeGeometryDocument([
    { name: "Part 1", shape: fakeShape("A") },
    { name: "Part 2", shape: fakeShape("B") },
  ], 9);
  let calls = 0;
  const result = await convertGeometry(parts, "step", {
    replicad: { exportSTEP: entries => { calls++; return new Blob([bytes(String(entries.length))]); } },
  });
  assert.equal(calls, 1);
  assert.equal(new TextDecoder().decode(result.bytes), "2");
  await assert.rejects(convertGeometry(parts, "stl"), /one shape/);
});
test("unknown conversion rejects rather than quietly exporting a mesh", async () => {
  await assert.rejects(convertGeometry(doc(), "3dm"), /No adapter/);
  assert.throws(() => makeGeometryDocument([], 0), /No geometry/);
});

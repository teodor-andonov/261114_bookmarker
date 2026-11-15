import test from "node:test";
import assert from "node:assert/strict";
import opencascade from "replicad-opencascadejs";
import * as replicad from "replicad";
import { DEMOS } from "../examples.js";

test("real OpenCascade builds the post-union seam fillet", { timeout: 120000 }, async () => {
  const oc = await opencascade();
  replicad.setOC(oc);
  const demo = DEMOS.find(({ id }) => id === "booleans");
  const { main, defaultParams } = new Function(
    "replicad",
    demo.source + "\nreturn { main, defaultParams };"
  )(replicad);

  // Confirm the unfilleted union works first, then the joint fillet.
  const rawUnion = main(replicad, { ...defaultParams, jointFillet: 0 });
  assert.equal(typeof rawUnion.mesh, "function");
  const beforeFaces = rawUnion.faces;
  assert.ok(beforeFaces.length > 6);
  beforeFaces.forEach(face => face.delete());

  const blended = main(replicad, defaultParams);
  assert.equal(typeof blended.mesh, "function");
  const solids = blended.solids;
  assert.equal(solids.length, 1, "joint-filleted result must be one solid");
  solids.forEach(solid => solid.delete());
  const mesh = blended.mesh();
  assert.ok(mesh.triangles?.length > 0, "joint-filleted result must be renderable");

  const separate = main(replicad, { ...defaultParams, unionParts: false });
  assert.equal(separate.length, 2);
});

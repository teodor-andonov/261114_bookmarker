import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { convertExactPlanarBrep } from "../occt-to-rhino.js";

test("OCCT six-face box converts into ONE valid CLOSED Rhino NURBS Brep", {timeout:120000}, async () => {
  const rhino = await initRhino();
  const oc = await initOC();
  replicad.setOC(oc);

  const shape = replicad.makeBaseBox(20,30,10);
  const brep = convertExactPlanarBrep(shape, rhino);
  assert.ok(brep, "converter should accept planar OCCT solid");
  console.log("Topology", {faces:brep.faces.count, edges:brep.edges.count,
    vertices:brep.vertices.count, loops:brep.loops.count,
    trims:brep.trims.count, solid:brep.isSolid,
    validTopology:brep.isValidTopology(), validGeometry:brep.isValidGeometry()});
  assert.equal(brep.faces.count, 6);
  assert.equal(brep.edges.count, 12);
  assert.equal(brep.vertices.count, 8);
  assert.equal(brep.loops.count, 6);
  assert.equal(brep.trims.count, 24);
  assert.equal(brep.isSolid, true);
  assert.equal(brep.isValidTopology()[0], true);
  assert.equal(brep.isValidGeometry()[0], true);

  const doc = new rhino.File3dm();
  doc.objects.addBrep(brep);
  const bytes = doc.toByteArray();
  const reread = rhino.File3dm.fromByteArray(bytes);
  assert.ok(reread);
  assert.equal(reread.objects.count, 1);
  const readBrep = [...reread.objects][0].geometry;
  assert.equal(readBrep.isSolid,true);
  assert.equal(readBrep.isValidTopology()[0],true);
  assert.equal(readBrep.faces.count,6);
  console.log("Exact closed box .3dm verified", bytes.length,"bytes");
});

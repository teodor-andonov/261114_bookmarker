import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { convertExactPlanarBrep } from "../occt-to-rhino.js";
import { createExactPlanar3dm } from "../rhino-planar-core.js";

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

test("planar Boolean cut and union export as exact closed Rhino B-reps", { timeout: 120000 }, async () => {
  const rhino = await initRhino();
  const oc = await initOC();
  replicad.setOC(oc);
  const plate = replicad.makeBaseBox(40, 30, 12);
  const cutter = replicad.makeBaseBox(10, 10, 20).translateZ(-3);
  const joined = plate.fuse(replicad.makeBaseBox(18, 15, 18).translate([24, 0, 0]));
  const drilled = plate.cut(cutter);

  for (const [name, shape] of [["through-hole", drilled], ["union", joined]]) {
    const brep = convertExactPlanarBrep(shape, rhino);
    assert.ok(brep, name + " should convert using exact planar faces and edges");
    console.log(name, { faces:brep.faces.count, edges:brep.edges.count, vertices:brep.vertices.count,
      loops:brep.loops.count, trims:brep.trims.count, isSolid:brep.isSolid,
      topology:brep.isValidTopology(), geometry:brep.isValidGeometry() });
    assert.equal(brep.isSolid, true, name + " must remain closed");
    assert.equal(brep.isValidTopology()[0], true, name);
    assert.equal(brep.isValidGeometry()[0], true, name);
    const doc = new rhino.File3dm();
    doc.objects.addBrep(brep);
    const reload = rhino.File3dm.fromByteArray(doc.toByteArray());
    assert.ok(reload, name + " should reopen");
    const reopenedBrep = [...reload.objects][0].geometry;
    assert.equal(reopenedBrep.isSolid, true, name + " should stay solid after reopening");
  }
});

test("production planar 3DM builder round-trips named parts with millimetre units", { timeout:120000 }, async () => {
  const rhino = await initRhino();
  const oc = await initOC();
  replicad.setOC(oc);
  const entries = [
    { name: "Plate", shape: replicad.makeBaseBox(40,30,12) },
    { name: "Block", shape: replicad.makeBaseBox(12,10,18).translate([60,0,0]) },
  ];
  const bytes = createExactPlanar3dm(entries,rhino);
  assert.ok(bytes.length > 10000);
  const read = rhino.File3dm.fromByteArray(bytes);
  assert.equal(read.objects.count,2);
  assert.equal(read.settings.modelUnitSystem,rhino.UnitSystem.Millimeters);
  const shapes=[...read.objects].map(item=>item.geometry);
  assert.ok(shapes.every(item=>item instanceof rhino.Brep && item.isSolid && item.isValidTopology()[0]));
  console.log("Verified two exact solids with mm units in 3DM", bytes.length, "bytes");
});

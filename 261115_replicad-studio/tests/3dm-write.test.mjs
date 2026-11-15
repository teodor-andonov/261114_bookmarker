import test from "node:test";
import assert from "node:assert/strict";
import initRhino from "rhino3dm-beta";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";

// First real OCCT->rhino3dm round-trip milestone: one exact bounded planar
// NURBS face, not a mesh. This is NOT a whole-solid conversion.
test("OCCT planar face -> native Rhino NURBS Brep -> 3dm -> reimport", { timeout: 120000 }, async () => {
  const [rhino, oc] = await Promise.all([initRhino(), initOC()]);
  replicad.setOC(oc);
  const shape = replicad.makeBaseBox(20, 30, 10);
  const face = shape.faces[0];
  const { uMin, uMax, vMin, vMax } = face.UVBounds;
  const points = [
    [uMin, vMin], [uMin, vMax],
    [uMax, vMin], [uMax, vMax],
  ].map(([u, v]) => {
    const position = face.pointOnSurface(u, v);
    const coords = { X: position.x, Y: position.y, Z: position.z };
    position.delete();
    return coords;
  });
  const surface = new rhino.NurbsSurface(3, false, 2, 2, 2, 2);
  assert.equal(surface.points.setPoint(0, 0, points[0]), true);
  assert.equal(surface.points.setPoint(0, 1, points[1]), true);
  assert.equal(surface.points.setPoint(1, 0, points[2]), true);
  assert.equal(surface.points.setPoint(1, 1, points[3]), true);
  for (let i = 0; i < 2; i++) {
    surface.knotsU.set(i, i);
    surface.knotsV.set(i, i);
  }
  const brep = rhino.Brep.createFromSurface(surface);
  assert.ok(brep);
  assert.equal(brep.faces.count, 1);
  assert.equal(brep.trims.count, 4);
  assert.equal(brep.isValidGeometry()[0], true);
  assert.equal(brep.isValidTopology()[0], true);

  const doc = new rhino.File3dm();
  doc.objects.addBrep(brep);
  const bytes = doc.toByteArray();
  assert.ok(bytes.length > 1000);
  const read = rhino.File3dm.fromByteArray(bytes);
  assert.ok(read, "must re-open as 3dm");
  assert.equal(read.objects.count, 1);
  const geometry = read.objects.get(0).geometry;
  assert.ok(geometry instanceof rhino.Brep);
  assert.equal(geometry.faces.count, 1);
  assert.equal(geometry.isValidTopology()[0], true);
  console.log("Validated exact planar NURBS face in 3dm", bytes.length, "bytes");
});

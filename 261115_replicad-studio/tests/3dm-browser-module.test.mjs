import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import initRhino from "rhino3dm-beta/rhino3dm.module.js";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import { createExactPlanar3dm } from "../rhino-planar-core.js";

test("browser ESM rhino3dm 9.2 writes a closed OCCT B-rep 3DM", { timeout: 120000 }, async () => {
  // Use the *same module entry* as the browser exporter; wasmBinary avoids
  // relying on a local HTTP server during this Node CI compatibility test.
  const wasmBinary = readFileSync(new URL("../node_modules/rhino3dm-beta/rhino3dm.wasm", import.meta.url));
  const rhino = await initRhino({ wasmBinary });
  const oc = await initOC();
  replicad.setOC(oc);
  const bytes = createExactPlanar3dm([
    { name: "Rotated plate", shape: replicad.makeBaseBox(30,20,12) },
  ], rhino);
  assert.ok(bytes?.byteLength > 10000);
  const doc = rhino.File3dm.fromByteArray(bytes);
  const brep = [...doc.objects][0].geometry;
  assert.ok(brep.isSolid);
  assert.equal(brep.isValidTopology()[0], true);
  console.log("Browser rhino3dm ESM exact closed solid OK:", bytes.byteLength, "bytes");
});

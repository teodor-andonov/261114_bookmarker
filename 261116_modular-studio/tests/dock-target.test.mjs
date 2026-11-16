import test from "node:test";
import assert from "node:assert/strict";
import { defaultLayout, movePanel } from "../layout-core.js";
import { zoneAt, gapInsertion } from "../dock-target.js";

const rect = { left: 10, top: 20, width: 300, height: 200, right: 310, bottom: 220 };
test("whole box is the tab target except a narrow split perimeter", () => {
  assert.equal(zoneAt(rect, 160, 120), "center");
  assert.equal(zoneAt(rect, 12, 120), "left");
  assert.equal(zoneAt(rect, 306, 120), "right");
  assert.equal(zoneAt(rect, 160, 22), "top");
  assert.equal(zoneAt(rect, 160, 217), "bottom");
  assert.equal(zoneAt(rect, 50, 100), "center");
});
test("gap drop chooses the surviving opposite box", () => {
  const split = { kind: "split", axis: "x", ratio: .5,
    a: { kind: "stack", id: "one", active: "editor", tabs: ["editor"] },
    b: { kind: "stack", id: "two", active: "viewer", tabs: ["viewer"] } };
  assert.deepEqual(gapInsertion(split, "editor"), {targetId:"two",zone:"left"});
  assert.deepEqual(gapInsertion(split, "viewer"), {targetId:"one",zone:"right"});
  const after = movePanel(defaultLayout(), "editor", "s2", "center");
  assert.equal(after.kind, "split");
});

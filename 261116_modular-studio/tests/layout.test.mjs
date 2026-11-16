import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultLayout, isValidLayout, movePanel, allStacks, stackContaining,
  findStack, cycleTab, activatePanel,
} from "../layout-core.js";

test("default bento holds each of the five panels exactly once", () => {
  const tree = defaultLayout();
  assert.equal(isValidLayout(tree), true);
  assert.equal(allStacks(tree).length, 5);
});
test("center drop stacks panels and removes an empty source box", () => {
  const tree = movePanel(defaultLayout(), "editor", "s2", "center");
  assert.equal(isValidLayout(tree), true);
  assert.equal(allStacks(tree).length, 4);
  assert.deepEqual(findStack(tree, "s2").tabs, ["viewer", "editor"]);
  assert.equal(findStack(tree, "s2").active, "editor");
});
test("moving to edges splits and preserves five unique panels", () => {
  let tree = movePanel(defaultLayout(), "editor", "s2", "center");
  tree = movePanel(tree, "formatter", "s2", "left");
  assert.equal(isValidLayout(tree), true);
  assert.equal(allStacks(tree).length, 4);
  assert.notEqual(stackContaining(tree, "formatter")?.id, "s2");
  tree = movePanel(tree, "runner", "s2", "bottom");
  assert.equal(isValidLayout(tree), true);
  assert.equal(allStacks(tree).length, 4);
});
test("Tab cycling and direct panel activation change only the active tab", () => {
  const tree = movePanel(defaultLayout(), "editor", "s2", "center");
  const previous = findStack(tree, "s2").active;
  const cycled = cycleTab(tree, "s2");
  assert.notEqual(findStack(cycled, "s2").active, previous);
  assert.equal(findStack(tree, "s2").active, previous);
  assert.equal(findStack(activatePanel(tree, "editor"), "s2").active, "editor");
});
test("no-op self drops, invalid inputs, and corrupted saved tree", () => {
  const tree = defaultLayout();
  assert.strictEqual(movePanel(tree, "editor", "s1", "left"), tree);
  assert.strictEqual(movePanel(tree, "bogus", "s2", "center"), tree);
  assert.equal(isValidLayout({kind:"stack",id:"x",tabs:["editor"],active:"editor"}),false);
});

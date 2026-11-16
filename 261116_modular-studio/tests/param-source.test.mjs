import test from "node:test";
import assert from "node:assert/strict";
import { locateParameter, editParameter } from "../param-source.js";

const model = `// User source stays unchanged except for the literal token.
const defaultParams = {
  size: 40, // width
  enabled: true,
  label: "hello",
  offset: -2.5,
};
const main = (replicad, p) => replicad.makeBaseBox(p.size, p.size, p.size);
`;
test("parameter edits only replace the matching literal", () => {
  const next = editParameter(model, "size", 63);
  assert.equal(next.source.includes("size: 63, // width"), true);
  assert.equal(next.source.includes("enabled: true,"), true);
  assert.equal(next.source.includes("offset: -2.5,"), true);
  assert.equal(next.source.replace("size: 63", "size: 40"), model);
});
test("negative numbers, booleans, and strings are editable", () => {
  assert.match(editParameter(model, "offset", -9).source, /offset: -9,/);
  assert.match(editParameter(model, "enabled", false).source, /enabled: false,/);
  assert.match(editParameter(model, "label", "test").source, /label: "test",/);
});
test("reject computed expressions and invalid values", () => {
  assert.throws(() => locateParameter(model, "missing"));
  assert.throws(() => editParameter(model, "size", Infinity));
  assert.throws(() => locateParameter(model.replace("size: 40","size: 20 + 20"), "size"));
});

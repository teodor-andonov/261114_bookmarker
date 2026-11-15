import test from "node:test";
import assert from "node:assert/strict";
import { parameterEdit, locateParameter } from "../param-source.js";
import { DEMOS, NEW_MODEL } from "../examples.js";

test("parameter value edits retain comments and unrelated statements", () => {
  const code = `// before
const defaultParams = {
  width: 30, // dimensions in mm
  height: 10,
};
const main = () => 1;
// after
`;
  const out = parameterEdit(code, "width", 75).source;
  assert.equal(out, code.replace("width: 30,", "width: 75,"));
  assert.equal(parameterEdit(out, "height", 20).source.includes("height: 20,"), true);
});

test("negative numbers, quoted keys, booleans and strings", () => {
  const code = `const defaultParams = { "-offset": -2.5, enabled: false, label: 'A' };`;
  let next = parameterEdit(code, "-offset", -10).source;
  next = parameterEdit(next, "enabled", true).source;
  next = parameterEdit(next, "label", "B").source;
  assert.equal(next, `const defaultParams = { "-offset": -10, enabled: true, label: "B" };`);
});

test("blocks expressions, shorthands and missing parameters instead of rewriting them incorrectly", () => {
  assert.throws(() => parameterEdit("const defaultParams = { width: 3 * 4 };", "width", 9), /directly editable/);
  assert.throws(() => parameterEdit("const width=3; const defaultParams={ width };", "width", 9), /shorthand/);
  assert.throws(() => locateParameter("const defaultParams = { depth: 3 };", "width"), /exactly once/);
  assert.throws(() => parameterEdit("const defaultParams = { width: 3 };", "width", Number.POSITIVE_INFINITY), /finite/);
});

test("all bundled demos are executable plain-JS Replicad model sources", () => {
  assert.equal(DEMOS.length, 2);
  for (const demo of DEMOS) {
    const result = new Function("replicad", demo.source + "\nreturn { main, defaultParams };")({});
    assert.equal(typeof result.main, "function", demo.id);
    assert.equal(typeof result.defaultParams, "object", demo.id);
    for (const name of Object.keys(result.defaultParams)) {
      const newValue = result.defaultParams[name] + 1;
      assert.ok(parameterEdit(demo.source, name, newValue).source.includes(String(newValue)));
    }
  }
  const blank = new Function("replicad", NEW_MODEL + "\nreturn { main, defaultParams };")({});
  assert.equal(typeof blank.main, "function");
  assert.match(DEMOS[1].source, /\.cut\(cutter\)/);
  assert.match(DEMOS[1].source, /\.fillet\(/);
  assert.match(DEMOS[1].source, /return \[/);
});

test("Boolean example builds two separate shapes through expected CAD operations", () => {
  const log = [];
  class Shape {
    constructor(kind) { this.kind = kind; }
    fillet(radius) { assert.ok(radius > 0); log.push("fillet"); return this; }
    cut(other) { assert.ok(other instanceof Shape); log.push("cut"); return this; }
    translate() { log.push("translate"); return this; }
    translateZ() { return this; }
  }
  const mockReplicad = {
    makeBaseBox() { return new Shape("box"); },
    drawCircle() {
      return {
        sketchOnPlane() { return this; },
        extrude() { return new Shape("cylinder"); },
      };
    },
  };
  const demo = DEMOS.find(entry => entry.id === "booleans");
  const { main, defaultParams } = new Function("replicad", demo.source +
    "\nreturn { main, defaultParams };")(mockReplicad);
  const output = main(mockReplicad, defaultParams);
  assert.equal(output.length, 2);
  assert.deepEqual(output.map(item => item.name), ["Drilled plate", "Rounded block"]);
  assert.ok(output.every(item => item.shape instanceof Shape));
  assert.ok(log.includes("cut"));
  assert.equal(log.filter(operation => operation === "fillet").length, 2);
});

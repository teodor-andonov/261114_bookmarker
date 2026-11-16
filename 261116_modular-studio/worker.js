import initOpenCascade from "replicad-opencascadejs";
import wasmURL from "replicad-opencascadejs/wasm?url";
import * as replicad from "replicad";

let initialization;
let builtShapes = [];
const init = () => (initialization ||= initOpenCascade({ locateFile: () => wasmURL })
  .then(oc => { replicad.setOC(oc); return oc; }));

function compile(source, logs) {
  const capturedConsole = {
    log: (...parts) => logs.push(parts.map(String).join(" ")),
    info: (...parts) => logs.push(parts.map(String).join(" ")),
    warn: (...parts) => logs.push("Warning: " + parts.map(String).join(" ")),
    error: (...parts) => logs.push("Error: " + parts.map(String).join(" ")),
  };
  // User-authored scripts execute only after a deliberate Run command or
  // explicit parameter change; use a worker, not the UI thread.
  const evaluate = new Function("replicad", "console",
    source + "\nreturn { main: typeof main !== 'undefined' ? main : null, defaults: typeof defaultParams !== 'undefined' ? defaultParams : {} };");
  const { main, defaults } = evaluate(replicad, capturedConsole);
  if (typeof main !== "function") throw Error("Define main(replicad, params).");
  if (!defaults || Array.isArray(defaults) || typeof defaults !== "object") throw Error("defaultParams must be an object.");
  for (const [key,value] of Object.entries(defaults)) {
    if (!["number", "boolean", "string"].includes(typeof value) || (typeof value === "number" && !Number.isFinite(value)))
      throw Error("Unsupported defaultParams value: " + key);
  }
  return { main, defaults: structuredClone(defaults) };
}
self.onmessage = async ({ data }) => {
  const { id, type } = data;
  const start = performance.now();
  const logs = [];
  try {
    await init();
    if (type === "build") {
      const { main, defaults } = compile(data.source, logs);
      const outputs = await main(replicad, defaults);
      const list = Array.isArray(outputs) ? outputs : [outputs];
      if (!list.length) throw Error("Model returned no shapes.");
      const shapes = list.map((entry, index) => {
        const shape = entry?.shape || entry;
        if (!shape || typeof shape.mesh !== "function") throw Error("Item " + (index + 1) + " is not a Replicad shape.");
        return { shape, name: entry?.name || "Shape " + (index + 1) };
      });
      const meshes = shapes.map(({ shape, name }) => ({ name, faces: shape.mesh(), edges: shape.meshEdges() }));
      builtShapes = shapes;
      self.postMessage({ id, type: "built", meshes, defaults, logs, duration: Math.round(performance.now() - start) });
    } else if (type === "export") {
      if (!builtShapes.length) throw Error("Run the model before exporting.");
      const format = data.format;
      if (!["step","stl"].includes(format)) throw Error("Unsupported export format.");
      if (format === "stl" && builtShapes.length > 1) throw Error("STL is available for single-shape models; use STEP for multi-shape.");
      const blob = await (format === "step"
        ? builtShapes.length === 1 ? builtShapes[0].shape.blobSTEP() : replicad.exportSTEP(builtShapes)
        : builtShapes[0].shape.blobSTL());
      const bytes = await blob.arrayBuffer();
      self.postMessage({ id, type: "exported", format, bytes }, [bytes]);
    } else throw Error("Unknown worker message: " + type);
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || String(error), logs });
  }
};
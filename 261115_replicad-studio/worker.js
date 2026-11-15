import initOpenCascade from "replicad-opencascadejs";
import wasmURL from "replicad-opencascadejs/wasm?url";
import * as replicad from "replicad";

let initialization = null;
let builtShapes = [];

function init() {
  if (!initialization) {
    initialization = initOpenCascade({ locateFile: () => wasmURL }).then(oc => {
      replicad.setOC(oc);
      return true;
    });
  }
  return initialization;
}

// Standard function-style Replicad Studio code: const defaultParams = {...};
// const main = (replicad, params) => shape;
// Deliberately avoid source rewriting or app-specific model syntax here.
function evaluateSource(source) {
  // Explicit, user-supplied code executes in this worker. Open trusted JS models.
  const evaluate = new Function("replicad", source + "\nreturn { main: (typeof main !== 'undefined' ? main : null), defaults: (typeof defaultParams !== 'undefined' ? defaultParams : {}) };");
  const result = evaluate(replicad);
  if (typeof result.main !== "function") throw new Error("Define a main(replicad, params) function.");
  const defaults = result.defaults && typeof result.defaults === "object" && !Array.isArray(result.defaults) ? result.defaults : {};
  for (const [name, value] of Object.entries(defaults)) {
    if (!["number", "string", "boolean"].includes(typeof value)) {
      throw new Error("Parameter '" + name + "' must be a number, string or boolean.");
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Parameter '" + name + "' must be a finite number.");
    }
  }
  return { main: result.main, defaults: structuredClone(defaults) };
}

function normalizeShapes(result) {
  const items = Array.isArray(result) ? result : [result];
  if (!items.length) throw new Error("Model returned no shapes.");
  return items.map((item, index) => {
    const shape = item?.shape || item;
    if (!shape || typeof shape.mesh !== "function" || typeof shape.blobSTEP !== "function") {
      throw new Error("Model item " + (index + 1) + " is not a supported Replicad shape.");
    }
    return { shape, name: item?.name || "Shape " + (index + 1) };
  });
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    await init();

    if (type === "build") {
      const { main, defaults } = evaluateSource(data.source);
      const values = data.values == null ? defaults : { ...defaults, ...data.values };
      const result = await main(replicad, values);
      const entries = normalizeShapes(result);
      const meshes = entries.map(({ shape, name }) => ({
        name,
        faces: shape.mesh(),
        edges: shape.meshEdges(),
      }));
      builtShapes = entries;
      self.postMessage({ id, type: "built", meshes, defaults, values });
      return;
    }

    if (type === "export") {
      if (!builtShapes.length) throw new Error("Run a model before exporting.");
      let blob;
      if (data.format === "step") {
        blob = builtShapes.length === 1
          ? builtShapes[0].shape.blobSTEP()
          : replicad.exportSTEP(builtShapes);
      } else if (data.format === "stl") {
        if (builtShapes.length > 1) throw new Error("STL export currently supports single-shape models. Use STEP for assemblies.");
        blob = builtShapes[0].shape.blobSTL();
      } else if (data.format === "3dm") {
        // Lazy-load the independent rhino3dm WASM runtime on demand.
        // Unsupported B-reps are rejected; no mesh-derived substitutes.
        const { exportExactRhino3dm } = await import("./rhino-export.js");
        const bytes = await exportExactRhino3dm(builtShapes);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        self.postMessage({ id, type: "exported", format: data.format, bytes: buffer }, [buffer]);
        return;
      } else {
        throw new Error("Unsupported export format.");
      }
      blob = await blob;
      const bytes = await blob.arrayBuffer();
      self.postMessage({ id, type: "exported", format: data.format, bytes }, [bytes]);
      return;
    }
    throw new Error("Unknown worker command: " + type);
  } catch (error) {
    self.postMessage({ id, type: "error", message: error?.message || String(error) });
  }
};

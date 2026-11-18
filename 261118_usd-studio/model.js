import * as sm from "@classcad/smlibwasm";
import { locateParameter } from "./param-source.js";

export function normalizeShapes(result) {
  const shapes = Array.isArray(result) ? result.flat(Infinity) : [result];
  if (!shapes.length || shapes.some(s => !(s instanceof sm.Part || s instanceof sm.Shell)))
    throw new Error("main must return an SMLib Part, Shell, or array of them. Meshes are not CAD B-reps.");
  return shapes;
}
export function build(source, includeMesh = false) {
  return sm.scope(() => {
    // Local, trusted model scripts, intentionally executable; not a security sandbox.
    const model = new Function("sm", source + "\n;return { main: typeof main === 'function' ? main : null, params: typeof defaultParams === 'undefined' ? {} : defaultParams };")(sm);
    if (!model.main) throw new Error("Define main(sm, params).");
    if (!model.params || typeof model.params !== "object" || Array.isArray(model.params)) throw new Error("defaultParams must be an object.");
    const params = Object.fromEntries(Object.entries(model.params).filter(([key,value]) => {
      if (!["number","boolean","string"].includes(typeof value)) return false;
      if (typeof value === "number" && !Number.isFinite(value)) return false;
      try { locateParameter(source,key); return true; } catch { return false; }
    }));
    const shapes = normalizeShapes(model.main(sm, {...model.params}));
    const meshes = shapes.map((shape,i) => {
      const mesh = sm.tessellate(shape, 0.1);
      const positions = new Float32Array(mesh.vertices);
      const indices = new Uint32Array(mesh.triangles);
      const normals = mesh.normals && mesh.normals.length === positions.length ? new Float32Array(mesh.normals) : null;
      if (!positions.length || !indices.length || positions.length%3 || indices.length%3 || !positions.every(Number.isFinite) || !indices.every(x=>x<positions.length/3)) throw new Error("Invalid preview tessellation for object " + (i+1));
      return {positions,indices,normals,faces:shape.faces().length,edges:shape.edges().length,volume:shape instanceof sm.Part ? shape.volume : null};
    });
    const usda = sm.toUsd(shapes,{mesh: Boolean(includeMesh),materials:true});
    if (!usda.startsWith("#usda") || !/BrepArray/i.test(usda)) throw new Error("Exporter did not produce a USD BRep stage; refusing mesh-only output.");
    return {params,meshes,usda};
  });
}

export function roundTrip(usda) {
  return sm.scope(() => normalizeShapes(sm.fromUsd(usda,{strict:true,check:true})).map(s=>({volume:s instanceof sm.Part ? s.volume : null,faces:s.faces().length,edges:s.edges().length})));
}

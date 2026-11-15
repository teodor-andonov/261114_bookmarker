// Inspect *installed* Replicad OCCT WASM type definitions for bridge feasibility.
import { readFileSync } from "node:fs";
const source = readFileSync("node_modules/replicad-opencascadejs/dist/replicad_single.d.ts", "utf8");
const lines = source.split("\n");
for (const term of [
  "CurveOnSurface", "BRep_Tool", "SurfaceToBSplineSurface", "CurveToBSplineCurve",
  "Geom_BSplineSurface", "Geom_BSplineCurve", "Geom2d_BSplineCurve",
  "RectangularTrimmedSurface"
]) {
  const found = lines.flatMap((line, i) => line.includes(term) ? [{ n:i+1, value:line.trim() }] : []);
  console.log("TYPE",term,found.length);
  found.slice(0, 12).forEach(item => console.log(item.n + ": " + item.value.slice(0, 450)));
}

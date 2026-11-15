// Bundled, read-only example sources; loading one copies its JavaScript into
// the editor. Nothing is persisted until the user explicitly saves a file.
export const DEMOS = [
  {
    id: "box",
    title: "Parametric box",
    description: "Three dimensions. A small example of source-backed sliders and exact STEP / 3DM export.",
    filename: "box.js",
    source: `// 01 — PARAMETRIC BOX
// Edit the numbers here or use the parameter controls.
const defaultParams = {
  width: 60,
  depth: 40,
  height: 30,
};

const main = (replicad, params) => {
  const { width, depth, height } = params;
  return replicad.makeBaseBox(width, depth, height);
};
`,
  },
  {
    id: "booleans",
    title: "Boolean + fillets",
    description: "Two independent solids: a filleted plate with a through-hole, plus a rounded block. Tests cut, fillet, and multiple objects.",
    filename: "boolean-fillets.js",
    source: `// 02 — BOOLEAN + FILLETS
// Returns multiple independent solids. All dimensions are in mm.
const defaultParams = {
  width: 80,
  depth: 50,
  height: 20,
  edgeRadius: 2,
  holeRadius: 10,
  gap: 15,
};

const main = (replicad, params) => {
  const { width, depth, height, edgeRadius, holeRadius, gap } = params;

  // Keep edge fillets and hole radii inside safe dimensions.
  const fillet = Math.max(0.2, Math.min(edgeRadius, width / 5, depth / 5, height / 5));
  const hole = Math.max(1, Math.min(holeRadius, width / 3, depth / 3));

  const plate = replicad.makeBaseBox(width, depth, height).fillet(fillet);
  const cutter = replicad.drawCircle(hole)
    .sketchOnPlane()
    .extrude(height + 4)
    .translateZ(-2);
  const drilledPlate = plate.cut(cutter);

  const blockWidth = Math.max(12, width / 3);
  const block = replicad.makeBaseBox(blockWidth, depth / 2, height * 1.4)
    .fillet(Math.min(fillet, 3))
    .translate([width / 2 + gap + blockWidth / 2, 0, 0]);

  return [
    { name: "Drilled plate", shape: drilledPlate },
    { name: "Rounded block", shape: block },
  ];
};
`,
  },
];

export const NEW_MODEL = `// NEW MODEL — write an independent Replicad JavaScript model.
const defaultParams = {
  size: 40,
};

const main = (replicad, params) => {
  // Replace this starter shape with your own geometry.
  return replicad.makeBaseBox(params.size, params.size, params.size);
};
`;

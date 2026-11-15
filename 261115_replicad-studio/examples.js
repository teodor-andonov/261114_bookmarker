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
    title: "Boolean union + fillets",
    description: "Cut, fillet and union two bodies, then round the new joint edges. Toggle Union parts to inspect the originals.",
    filename: "boolean-fillets.js",
    source: `// 02 — BOOLEAN CUT + FILLET + UNION + JOINT FILLET
// Two intersecting solids can be fused into one connected solid.
// A second fillet rounds only the edges created where they join.
const defaultParams = {
  width: 80,
  depth: 50,
  height: 20,
  edgeRadius: 2,
  holeRadius: 10,
  overlap: 12,
  jointFillet: 1,
  unionParts: true,
};

const main = (replicad, params) => {
  const { width, depth, height, edgeRadius, holeRadius, overlap, jointFillet, unionParts } = params;

  // Keep fillets and hole radii within the body's dimensions.
  const fillet = Math.max(0.2, Math.min(edgeRadius, width / 5, depth / 5, height / 5));
  const hole = Math.max(1, Math.min(holeRadius, width / 3, depth / 3));

  // Base: fillet the plate, then subtract a through-hole.
  const plate = replicad.makeBaseBox(width, depth, height).fillet(fillet);
  const cutter = replicad.drawCircle(hole)
    .sketchOnPlane()
    .extrude(height + 4)
    .translateZ(-2);
  const drilledPlate = plate.cut(cutter);

  // Second rounded solid protrudes from one side of the plate.
  // Ensure a positive volume intersection, not just coplanar contact.
  const blockWidth = Math.max(12, width / 3);
  // Keep enough flat, overlapping area for the post-union blend.
  const intersection = Math.max(fillet * 3, Math.min(overlap, blockWidth * 0.75, width / 3));
  const block = replicad.makeBaseBox(blockWidth, depth / 2, height * 1.4)
    .fillet(Math.min(fillet, 3))
    .translate([
      width / 2 + blockWidth / 2 - intersection,
      0,
      height * 0.3,
    ]);

  // With union disabled, show the two parts before the final operations.
  if (!unionParts) {
    return [
      { name: "Drilled plate", shape: drilledPlate },
      { name: "Rounded block", shape: block },
    ];
  }

  // First fuse the exact B-reps; then round ONLY the new joint seams.
  const fused = drilledPlate.fuse(block);
  if (jointFillet <= 0) return fused;

  const seamX = width / 2 - intersection / 2;
  const seamY = depth / 4;
  const seamPointA = [seamX, seamY, height];
  const seamPointB = [seamX, -seamY, height];
  const selectJoint = (e) => e.inDirection("X").either([
    (edge) => edge.near(seamPointA, 0.05),
    (edge) => edge.near(seamPointB, 0.05),
  ]);
  const matchingEdges = fused.findEdges(selectJoint);
  const matches = matchingEdges.length;
  matchingEdges.forEach(edge => edge.delete());
  if (matches !== 2) {
    throw new Error("Could not identify the two new union edges. Adjust overlap or edgeRadius.");
  }
  // A small radius is more robust around the pre-existing edge fillets.
  const radius = Math.min(jointFillet, fillet * 0.6, intersection / 8);
  return fused.fillet(radius, selectJoint);
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

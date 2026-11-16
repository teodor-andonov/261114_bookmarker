// Ordinary JavaScript files; no custom model language or hidden state.
export const EXAMPLES = [
  {
    name: "Parametric pavilion",
    filename: "pavilion.js",
    source: `const defaultParams = {
  width: 60,
  depth: 42,
  height: 28,
  columnSize: 4,
  roofThickness: 3,
};

const main = (replicad, p) => {
  const w = p.width, d = p.depth, h = p.height;
  const c = Math.min(p.columnSize, w / 6, d / 6);
  const roof = replicad.makeBaseBox(w, d, p.roofThickness)
    .translateZ(h);
  const positions = [
    [-w / 2 + c / 2, -d / 2 + c / 2],
    [ w / 2 - c / 2, -d / 2 + c / 2],
    [-w / 2 + c / 2,  d / 2 - c / 2],
    [ w / 2 - c / 2,  d / 2 - c / 2],
  ];
  return [
    { name: "Canopy", shape: roof },
    ...positions.map(([x, y], i) => ({
      name: "Column " + (i + 1),
      shape: replicad.makeBaseBox(c, c, h).translate([x, y, 0]),
    })),
  ];
};`,
  },
  {
    name: "Rounded block",
    filename: "rounded-block.js",
    source: `const defaultParams = {
  width: 65,
  depth: 40,
  height: 26,
  radius: 4,
};

const main = (replicad, p) => {
  const radius = Math.min(p.radius, p.width / 4, p.depth / 4, p.height / 4);
  return replicad.makeBaseBox(p.width, p.depth, p.height).fillet(radius);
};`,
  },
];

export const DEMOS = [
 {name:"Simple box", source:`const defaultParams = { width: 80, depth: 60, height: 20 };
const main = (sm, p) => sm.Box(p.width, p.depth, p.height);
`},
 {name:"Drilled and filleted plate",source:`const defaultParams = { width: 80, depth: 60, height: 10, radius: 8, holeRadius: 4 };
const main = (sm, p) => {
  let plate = sm.Box(p.width, p.depth, p.height);
  plate = plate.fillet(plate.edges().parallelTo(sm.Z), p.radius);
  return plate.cut(sm.GridLocations(p.width - 20, p.depth - 20, 2, 2).mul(sm.Cylinder(p.holeRadius, p.height + 2)));
};
`},
 {name:"Boolean assembly",source:`const defaultParams = { width: 60, depth: 40, height: 20, offset: 25, union: true };
const main = (sm, p) => {
  const a = sm.Box(p.width, p.depth, p.height);
  const b = sm.Box(p.width, p.depth, p.height).translate(p.offset, 0, p.height / 2);
  return p.union ? a.fuse(b) : [a, b];
};
`},
 {name:"Multi-object model", source:`const defaultParams = { radius: 16, height: 45, spacing: 50 };
const main = (sm, p) => [
  sm.Cylinder(p.radius, p.height),
  sm.Box(p.radius * 2, p.radius * 2, p.height).translate(p.spacing, 0, 0)
];
`},
 {name:"Fluid twist tower",source:"const defaultParams = { height: 140, radius: 32, twist: 75, drift: 22 };\nconst main = (sm, p) => {\n  // A continuous elliptical envelope: twisting, tapering and drifting.\n  const sections = [];\n  for (let i = 0; i <= 4; i++) {\n    const t = i / 4;\n    const r = p.radius * (1 - 0.35 * t + 0.10 * Math.sin(Math.PI * t));\n    sections.push(sm.Ellipse(r, r * 0.56)\n      .rotate(sm.Z, p.twist * t)\n      .translate(p.drift * Math.sin(Math.PI * t / 2), 0, p.height * t));\n  }\n  return sm.loft(sections);\n};\n"},
 {name:"Ribbon pavilion",source:"const defaultParams = { span: 110, rise: 33, width: 12, thickness: 3 };\nconst main = (sm, p) => {\n  // Three divergent, sweeping solid ribbons.\n  const ribbons = [];\n  for (let i = -1; i <= 1; i++) {\n    const path = sm.Spline(\n      [-p.span / 2, i * 17, 0],\n      [-p.span / 4, i * 22, p.rise * 0.70],\n      [0, i * 29 + 8, p.rise],\n      [p.span / 4, i * 18 + 12, p.rise * 0.55],\n      [p.span / 2, i * 23, 0]\n    );\n    ribbons.push(sm.sweep(sm.Ellipse(p.width / 2, p.thickness / 2), path));\n  }\n  return ribbons;\n};\n"},
 {name:"Parametric strata tower",source:"const defaultParams = { floors: 15, floorHeight: 6, radius: 29, twist: 100, wave: 12 };\nconst main = (sm, p) => {\n  // Individually modelled, continuously varying floor plates.\n  const count = Math.max(2, Math.min(36, Math.round(p.floors)));\n  const plates = [];\n  for (let i = 0; i < count; i++) {\n    const t = i / (count - 1);\n    const r = p.radius * (0.86 + 0.14 * Math.cos(2 * Math.PI * t) - 0.18 * t);\n    const angle = p.twist * t;\n    plates.push(sm.Ellipse(r, r * 0.61)\n      .extrude(p.floorHeight * 0.30)\n      .rotate(sm.Z, angle)\n      .translate(p.wave * Math.sin(t * Math.PI), p.wave * 0.4 * Math.sin(t * 2 * Math.PI), i * p.floorHeight));\n  }\n  return plates;\n};\n"},
 {name:"Bifurcating canopy ribs",source:"const defaultParams = { length: 95, spread: 53, rise: 35, ribs: 9, radius: 1.6 };\nconst main = (sm, p) => {\n  // A family of spatial spline ribs, each a solid swept section.\n  const count = Math.max(3, Math.min(21, Math.round(p.ribs)));\n  const bodies = [];\n  for (let i = 0; i < count; i++) {\n    const t = i / (count - 1) * 2 - 1;\n    const y = t * p.spread / 2;\n    const path = sm.Spline(\n      [-p.length / 2, y * 0.35, 0],\n      [-p.length * 0.24, y * 0.75, p.rise * (0.75 + 0.12 * t)],\n      [0, y + 6 * Math.sin(t * Math.PI), p.rise * (1 - 0.20 * t * t)],\n      [p.length * 0.25, y * 1.20, p.rise * (0.58 - 0.12 * t)],\n      [p.length / 2, y * 1.35, 0]\n    );\n    bodies.push(sm.sweep(sm.Circle(p.radius), path));\n  }\n  return bodies;\n};\n"}
];

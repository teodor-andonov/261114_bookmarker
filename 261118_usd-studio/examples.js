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
`}
];

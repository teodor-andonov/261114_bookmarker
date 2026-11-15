// Exact, topology-preserving OCCT -> openNURBS conversion prototype.
// v0: planar B-rep faces with straight edges (boxes and planar polyhedra).
// Deliberately no display meshes, sampled polylines or approximate NURBS.
// Other face/edge types are rejected until their exact geometry is supported.
const point3 = xyz => ({ X: xyz[0], Y: xyz[1], Z: xyz[2] });
const point2 = uv => ({ X: uv[0], Y: uv[1], Z: 0 });
const PRECISION = 1e-7;
const keyOf = values => values.map(value => Math.round(value / PRECISION)).join(",");
const pointFrom = vector => {
  try { return vector.toTuple(); }
  finally { vector.delete(); }
};
const endpoints = edge => [pointFrom(edge.startPoint), pointFrom(edge.endPoint)];

function makeExactPlanarSurface(face, rhino) {
  const bounds = face.UVBounds;
  const { uMin, uMax, vMin, vMax } = bounds;
  if (![uMin, uMax, vMin, vMax].every(Number.isFinite) ||
      uMax <= uMin || vMax <= vMin) throw new Error("Invalid planar face UV domain");
  const surface = new rhino.NurbsSurface(3, false, 2, 2, 2, 2);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const uv = [i ? uMax : uMin, j ? vMax : vMin];
      const position = pointFrom(face.pointOnSurface(...uv));
      if (!surface.points.setPoint(i, j, point3(position))) {
        throw new Error("Rhino rejected exact planar surface control point");
      }
    }
    surface.knotsU.set(i, i);
    surface.knotsV.set(i, i);
  }
  return { surface, bounds };
}

function orderedWireEdges(edges) {
  // Shape explorer iteration can differ from wire order. Build the closed
  // directed cycle from shared 3D vertices, independent of traversal order.
  const pending = edges.map(edge => {
    const [a, b] = endpoints(edge);
    return { edge, a, b, ka: keyOf(a), kb: keyOf(b) };
  });
  if (pending.length < 3) throw new Error("A planar face must have at least 3 loop edges");
  const chain = [{ ...pending.shift(), reverse: false }];
  while (pending.length) {
    const endKey = chain.at(-1).reverse ? chain.at(-1).ka : chain.at(-1).kb;
    const index = pending.findIndex(item => item.ka === endKey || item.kb === endKey);
    if (index < 0) throw new Error("Face wire is not a connected loop");
    const item = pending.splice(index, 1)[0];
    chain.push({ ...item, reverse: item.kb === endKey });
  }
  const startKey = chain[0].ka;
  const end = chain.at(-1);
  if ((end.reverse ? end.ka : end.kb) !== startKey) throw new Error("Face wire is not closed");
  return chain;
}

function uvOnFace(face, position, bounds) {
  const [u, v] = face.uvCoordinates(position);
  return [(u - bounds.uMin) / (bounds.uMax - bounds.uMin),
          (v - bounds.vMin) / (bounds.vMax - bounds.vMin)];
}

/** Construct one Rhino Brep with shared edges and mated trims from a
 * planar-only Replicad solid. Returns null for curved/unsupported topology.
 */
export function convertExactPlanarBrep(shape, rhino) {
  const solids = shape.solids;
  const faces = shape.faces;
  const edges = shape.edges;
  try {
    if (solids.length !== 1 || !faces.length ||
        !faces.every(face => face.geomType === "PLANE") ||
        !edges.every(edge => edge.geomType === "LINE")) return null;

    const brep = new rhino.Brep();
    const vertices = new Map();
    const edgeMap = new Map();
    const vertexAt = xyz => {
      const key = keyOf(xyz);
      if (vertices.has(key)) return vertices.get(key);
      const vertex = brep.vertices.add(point3(xyz), PRECISION);
      if (!vertex) throw new Error("Failed to add Rhino B-rep vertex");
      const index = brep.vertices.count - 1;
      vertices.set(key, index);
      return index;
    };

    // Construct all edges only once, so adjacent faces share Rhino topology.
    for (const edge of edges) {
      const [a, b] = endpoints(edge);
      const key = String(edge.hashCode);
      if (edgeMap.has(key)) throw new Error("Duplicate edge identity in OpenCascade solid");
      const from = vertexAt(a), to = vertexAt(b);
      const curve = new rhino.LineCurve(point3(a), point3(b));
      const curveIndex = brep.addEdgeCurve(curve);
      if (curveIndex < 0) throw new Error("Could not add 3D edge curve");
      const newEdge = brep.edges.add(from, to, curveIndex, PRECISION);
      if (!newEdge) throw new Error("Could not add shared Rhino B-rep edge");
      edgeMap.set(key, { index: brep.edges.count - 1, a, b });
    }

    for (const face of faces) {
      const { surface, bounds } = makeExactPlanarSurface(face, rhino);
      const surfaceIndex = brep.addSurface(surface);
      if (surfaceIndex < 0) throw new Error("Could not add Rhino NURBS face surface");
      const newFace = brep.faces.add(surfaceIndex);
      if (!newFace) throw new Error("Could not add Rhino face to B-rep");
      newFace.orientationIsReversed = face.orientation === "backward";
      const faceIndex = brep.faces.count - 1;
      const wires = face.wires;
      try {
        // OCCT's topology explorer does not guarantee outer-wire-first
        // order (e.g. the top face of a drilled plate can list its hole first).
        // Ask OpenCascade which wire actually bounds the outside.
        const outer = face.clone().outerWire();
        try {
          const index = wires.findIndex(wire => wire.isSame(outer));
          if (index < 0) throw new Error("Cannot identify OpenCascade face outer wire");
          if (index !== 0) wires.unshift(wires.splice(index, 1)[0]);
        } finally {
          outer.delete();
        }
        for (let wireIndex = 0; wireIndex < wires.length; wireIndex++) {
          // The outer wire has been moved to index 0; later wires are holes.
          const wire = wires[wireIndex];
          // addOuterLoop() creates an automatic rectangular boundary,
          // which would duplicate our exact OCCT trims. Instead attach an
          // empty loop to the face and populate it with shared-edge trims.
          const loop = brep.loops.add(
            wireIndex === 0 ? rhino.BrepLoopType.Outer : rhino.BrepLoopType.Inner,
            newFace
          );
          if (!loop) throw new Error("Could not construct a Rhino trimming loop");
          const loopEdges = wire.edges;
          try {
            let ordered = orderedWireEdges(loopEdges);
            // openNURBS defines outer loops counterclockwise and holes
            // clockwise in the underlying surface's UV domain. OCCT's
            // edge explorer order alone does not guarantee this convention.
            const signedArea = ordered.reduce((area, item) => {
              const start = item.reverse ? item.b : item.a;
              const end = item.reverse ? item.a : item.b;
              const [u0, v0] = uvOnFace(face, start, bounds);
              const [u1, v1] = uvOnFace(face, end, bounds);
              return area + (u0 * v1 - u1 * v0);
            }, 0);
            if (Math.abs(signedArea) < 1e-12) throw new Error("Degenerate planar trim loop");
            if ((signedArea > 0) !== (wireIndex === 0)) {
              ordered = ordered.reverse().map(item => ({
                ...item, reverse: !item.reverse,
              }));
            }
            for (const item of ordered) {
              const mapped = edgeMap.get(String(item.edge.hashCode));
              if (!mapped) throw new Error("OpenCascade face edge not found in solid");
              const start = item.reverse ? item.b : item.a;
              const end = item.reverse ? item.a : item.b;
              const pCurve = new rhino.LineCurve(
                point2(uvOnFace(face, start, bounds)),
                point2(uvOnFace(face, end, bounds))
              );
              const trimCurveIndex = brep.addTrimCurve(pCurve);
              if (trimCurveIndex < 0) throw new Error("Could not add exact UV trim curve");
              const shared = brep.edges.get(mapped.index);
              // A trim traverses a shared Rhino edge in either direction.
              const reversed = keyOf(start) !== keyOf(mapped.a);
              const trim = brep.trims.add(shared, reversed, loop, trimCurveIndex);
              if (!trim) throw new Error("Could not attach trim to shared edge");
            }
          } finally {
            loopEdges.forEach(item => item.delete());
          }
        }
      } finally {
        wires.forEach(item => item.delete());
      }
    }

    brep.setVertices();
    brep.setTolerancesBoxesAndFlags(false, true, true, true, true, true, true, true);
    const [valid, message] = brep.isValidTopology();
    if (!valid) throw new Error("Rhino topology invalid: " + message);
    if (!brep.isSolid) throw new Error("Rhino B-rep is not closed");
    return brep;
  } finally {
    [...solids, ...faces, ...edges].forEach(item => item.delete());
  }
}

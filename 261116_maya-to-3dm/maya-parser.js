// Maya ASCII polygon-cage parser. Does not execute Maya commands/history.
function mayaCommands(source) {
  const commands = [];
  let buffer = "", quote = "", escaped = false, lineComment = false, blockComment = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === "\n") { lineComment = false; buffer += " "; } continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i++; } continue; }
    if (quote) {
      buffer += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i++; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; buffer += ch; continue; }
    if (ch === ";") { if (buffer.trim()) commands.push(buffer.trim()); buffer = ""; continue; }
    if (ch === "\\" && next === "\n") { i++; buffer += " "; continue; }
    buffer += ch;
  }
  if (buffer.trim()) commands.push(buffer.trim());
  return commands;
}

function mayaTokens(command) {
  return (command.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s]+/g) || []).map(token => {
    if ((token.startsWith('"') && token.endsWith('"')) ||
        (token.startsWith("'") && token.endsWith("'"))) {
      return token.slice(1, -1).replace(/\\(["'\\])/g, "$1");
    }
    return token;
  });
}

function mayaFaceRecords(values) {
  const faces = [];
  for (let i = 0; i < values.length;) {
    const kind = values[i++];
    if (kind === "f") {
      const size = Number(values[i++]);
      if (!Number.isInteger(size) || size < 3 || size > 10000 || i + size > values.length) break;
      faces.push(values.slice(i, i + size).map(Number));
      i += size;
    } else if (kind === "mu" || kind === "mc") {
      i++; const count = Number(values[i++]); i += Number.isFinite(count) && count >= 0 ? count : values.length;
    } else if (["h", "mf", "mh", "fc"].includes(kind)) {
      const count = Number(values[i++]); i += Number.isFinite(count) && count >= 0 ? count : values.length;
    } else {
      // PolyFace records may include unrelated UV and colour data.
    }
  }
  return faces;
}

function mayaApplyTransforms(point, shape, nodes) {
  let p = point.slice(), parent = shape.parent, guard = 0;
  const orderNames = ["XYZ","YZX","ZXY","XZY","YXZ","ZYX"];
  while (parent && guard++ < 100) {
    const node = nodes.get(parent);
    if (!node || node.type !== "transform") break;
    p = p.map((v,i) => v * node.scale[i]);
    const angles = node.rotation.map(v => v * Math.PI / 180);
    for (const axis of (orderNames[node.rotationOrder] || "XYZ")) {
      const a = angles["XYZ".indexOf(axis)], c = Math.cos(a), s = Math.sin(a);
      const [x,y,z] = p;
      if (axis === "X") p = [x, y*c-z*s, y*s+z*c];
      if (axis === "Y") p = [x*c+z*s, y, -x*s+z*c];
      if (axis === "Z") p = [x*c-y*s, x*s+y*c, z];
    }
    p = p.map((v,i) => v + node.translation[i]);
    if (!node.inheritsTransform) break;
    parent = node.parent;
  }
  // Maya's default Y-up coordinates to Rhino's default Z-up (right-handed).
  return [p[0], p[2] === 0 ? 0 : -p[2], p[1]];
}

export function parseMayaAscii(text) {
  if (typeof text !== "string") throw new TypeError("Expected Maya ASCII text.");
  const nodes = new Map(), connections = new Map(), warnings = [];
  let selected = null, unit = "cm", historyNodes = 0;
  const num = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const vector = (values, defaults) => defaults.map((v,i) => num(values[i], v));
  const key = ref => ref ? ref.replace(/^\|/, "").split("|").at(-1) : "";
  for (const command of mayaCommands(text)) {
    const tokens = mayaTokens(command), operation = tokens[0];
    if (operation === "currentUnit") {
      const i = tokens.findIndex(t => t === "-l" || t === "-linear");
      if (i >= 0 && tokens[i + 1]) unit = tokens[i + 1];
      continue;
    }
    if (operation === "createNode") {
      const type = tokens[1], nameFlag = tokens.indexOf("-n"), parentFlag = tokens.indexOf("-p");
      if (type !== "mesh" && type !== "transform") {
        if (/^(polySmoothFace|polyCrease|polySubd|polyReduce|polyBevel|polyExtrude)/.test(type || "")) historyNodes++;
        continue;
      }
      const name = nameFlag >= 0 ? key(tokens[nameFlag + 1]) : null;
      if (!name) continue;
      if (nodes.has(name)) { warnings.push(`Duplicate DAG name ${name}; one instance may be skipped.`); continue; }
      nodes.set(name, {
        name, type, parent: parentFlag >= 0 ? key(tokens[parentFlag + 1]) : null,
        translation: [0,0,0], rotation: [0,0,0], scale: [1,1,1], rotationOrder: 0,
        inheritsTransform: true, vertices: [], edges: [], offsets: [], faceChunks: [],
        intermediate: false, smoothPreview: false, transformLimits: false
      });
      selected = name;
      continue;
    }
    if (operation === "select") {
      const ref = tokens.slice(1).filter(t => !t.startsWith("-")).at(-1);
      if (ref) selected = key(ref);
      continue;
    }
    if (operation === "connectAttr") {
      const refs = tokens.slice(1).filter(t => !t.startsWith("-"));
      const [from, to] = refs;
      if (from && to && /\.(?:i|inMesh)$/.test(to)) {
        connections.set(key(to.split(".")[0]), key(from.split(".")[0]));
      }
      continue;
    }
    if (operation !== "setAttr") continue;
    const index = tokens.findIndex((t,i) => i > 0 && (t.startsWith(".") || /^[^-.][^\s]*\.[A-Za-z][\w]*(?:\[\d+(?::\d+)?\])?$/.test(t)));
    if (index < 0) continue;
    const attrRef = tokens[index], dot = attrRef.lastIndexOf(".");
    const owner = dot === 0 ? selected : key(attrRef.slice(0,dot));
    const node = nodes.get(owner);
    if (!node) continue;
    const match = attrRef.slice(dot+1).match(/^([a-zA-Z][\w]*)(?:\[(\d+)(?::(\d+))?\])?$/);
    if (!match) continue;
    const attribute = match[1], start = match[2] === undefined ? 0 : Number(match[2]);
    const typeFlag = tokens.indexOf("-type", index);
    const values = tokens.slice(typeFlag >= 0 ? typeFlag + 2 : index + 1)
      .filter(t => t !== "-k" && t !== "-l" && t !== "-cb" && t !== "-s");
    if (node.type === "transform") {
      if (["t","translate"].includes(attribute)) node.translation = vector(values, node.translation);
      else if (["r","rotate"].includes(attribute)) node.rotation = vector(values, node.rotation);
      else if (["s","scale"].includes(attribute)) node.scale = vector(values, node.scale);
      else if (["tx","ty","tz"].includes(attribute)) node.translation["xyz".indexOf(attribute[1])] = num(values[0]);
      else if (["rx","ry","rz"].includes(attribute)) node.rotation["xyz".indexOf(attribute[1])] = num(values[0]);
      else if (["sx","sy","sz"].includes(attribute)) node.scale["xyz".indexOf(attribute[1])] = num(values[0],1);
      else if (attribute === "ro") node.rotationOrder = num(values[0]);
      else if (attribute === "it") node.inheritsTransform = values[0] !== "no" && values[0] !== "0" && values[0] !== "off";
      else if (["rp","sp","sh","ra","rpt","spt","rotateAxis","rotatePivot","scalePivot","shear"].includes(attribute)) {
        if (values.some(v=>Math.abs(Number(v))>1e-9)) node.transformLimits = true;
      }
    } else if (node.type === "mesh") {
      if (attribute === "io") node.intermediate = values[0] === "yes" || values[0] === "1" || values[0] === "on";
      else if (["dsm","displaySmoothMesh","smoothLevel","smoothPreview"].includes(attribute))
        node.smoothPreview ||= num(values[0]) > 0;
      else if (["vt","pt","pnts"].includes(attribute)) {
        const arr = attribute === "vt" ? node.vertices : node.offsets;
        for (let i = 0; i + 2 < values.length; i += 3)
          arr[start + i / 3] = [num(values[i]), num(values[i+1]), num(values[i+2])];
      } else if (attribute === "ed") {
        for (let i = 0; i + 2 < values.length; i += 3)
          node.edges[start + i / 3] = [num(values[i]), num(values[i+1]), num(values[i+2])];
      } else if (attribute === "fc") {
        node.faceChunks.push({start, faces: mayaFaceRecords(values)});
      }
    }
  }
  const objects = [];
  for (const node of nodes.values()) {
    if (node.type !== "mesh" || node.intermediate) continue;
    let geometry = node, linked = connections.get(node.name), guard = 0;
    while (linked && guard++ < 20) {
      const upstream = nodes.get(linked);
      if (!upstream || upstream.type !== "mesh") break;
      if (upstream.vertices.length && upstream.faceChunks.length) {
        if (!geometry.vertices.length || !geometry.faceChunks.length) geometry = upstream;
        break;
      }
      linked = connections.get(upstream.name);
    }
    if (!geometry.vertices.length && !geometry.faceChunks.length) continue;
    if (!geometry.vertices.length || !geometry.edges.length || !geometry.faceChunks.length) {
      warnings.push(`${node.name}: incomplete polygon data; skipped.`);
      continue;
    }
    const vertices = geometry.vertices.map((p,i) => {
      if (!p) return null;
      const delta = geometry.offsets[i] || [0,0,0];
      return mayaApplyTransforms(p.map((v,k)=>v+delta[k]), node, nodes);
    });
    const faces = [];
    const rawFaces = [];
    for (const chunk of geometry.faceChunks) chunk.faces.forEach((f,i) => {rawFaces[chunk.start+i] = f;});
    for (const [faceIndex, raw] of rawFaces.entries()) {
      if (!raw) continue;
      const ring = [];
      let previous = null, valid = true;
      for (const edgeId of raw) {
        if (!Number.isInteger(edgeId)) { valid = false; break; }
        const edge = geometry.edges[edgeId >= 0 ? edgeId : -edgeId-1];
        if (!edge) { valid = false; break; }
        const first = edgeId >= 0 ? edge[0] : edge[1];
        const last = edgeId >= 0 ? edge[1] : edge[0];
        if (previous !== null && previous !== first) { valid = false; break; }
        ring.push(first); previous = last;
      }
      if (ring.length < 3 || !valid || previous !== ring[0] ||
          ring.some(i => !Number.isInteger(i) || !vertices[i]) ||
          new Set(ring).size !== ring.length) {
        warnings.push(`${node.name}: invalid face ${faceIndex}; skipped.`);
        continue;
      }
      faces.push(ring);
    }
    if (!faces.length) { warnings.push(`${node.name}: no valid faces; skipped.`); continue; }
    if (node.transformLimits) warnings.push(`${node.name}: pivots, shears or rotation axes are not yet supported; placement may differ.`);
    if (faces.some(f => f.length > 4)) warnings.push(`${node.name}: N-gons will be triangulated in .3dm, changing SubD control topology.`);
    objects.push({
      name: node.parent || node.name,
      vertices, faces, smoothPreview: node.smoothPreview || geometry.smoothPreview,
      hardEdges: geometry.edges.filter(e => e && e[2] === 0).length,
      triangles: faces.filter(f=>f.length===3).length,
      quads: faces.filter(f=>f.length===4).length,
      ngons: faces.filter(f=>f.length>4).length
    });
  }
  if (historyNodes) warnings.push(`${historyNodes} Maya construction-history nodes detected. Their operations are not evaluated; stored polygon cages only.`);
  return {objects, warnings, unit, parsedNodes: nodes.size, historyNodes};
}

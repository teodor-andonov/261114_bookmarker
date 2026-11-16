// Pure, framework-free dock tree operations. No DOM and no document/model storage.
export const PANEL_IDS = ["editor", "viewer", "runner", "formatter", "parameters"];

const stack = (id, panel) => ({ kind: "stack", id, tabs: [panel], active: panel });
const split = (axis, ratio, a, b) => ({ kind: "split", axis, ratio, a, b });

export function defaultLayout() {
  return split("y", 0.70,
    split("x", 0.46, stack("s1", "editor"), stack("s2", "viewer")),
    split("x", 0.34, stack("s3", "runner"),
      split("x", 0.50, stack("s4", "formatter"), stack("s5", "parameters"))));
}
export function allStacks(node, result = []) {
  if (node.kind === "stack") result.push(node);
  else { allStacks(node.a, result); allStacks(node.b, result); }
  return result;
}
export function findStack(node, id) {
  return allStacks(node).find(s => s.id === id) || null;
}
export function stackContaining(node, panel) {
  return allStacks(node).find(s => s.tabs.includes(panel)) || null;
}
export function isValidLayout(node) {
  try {
    const ids = new Set();
    const panels = [];
    const visit = n => {
      if (!n || typeof n !== "object") throw Error("Missing node");
      if (n.kind === "stack") {
        if (!n.id || ids.has(n.id) || !Array.isArray(n.tabs) || !n.tabs.length ||
            !n.tabs.includes(n.active)) throw Error("Invalid stack");
        ids.add(n.id);
        panels.push(...n.tabs);
      } else if (n.kind === "split") {
        if (!["x", "y"].includes(n.axis) || !Number.isFinite(n.ratio) ||
            n.ratio < 0.10 || n.ratio > 0.90) throw Error("Invalid split");
        visit(n.a); visit(n.b);
      } else throw Error("Unknown node");
    };
    visit(node);
    return panels.length === PANEL_IDS.length &&
      new Set(panels).size === PANEL_IDS.length &&
      PANEL_IDS.every(p => panels.includes(p));
  } catch { return false; }
}
function dropFrom(node, panel) {
  if (node.kind === "stack") {
    if (!node.tabs.includes(panel)) return node;
    const tabs = node.tabs.filter(p => p !== panel);
    return tabs.length ? { ...node, tabs, active: tabs.includes(node.active) ? node.active : tabs[0] } : null;
  }
  const a = dropFrom(node.a, panel);
  const b = dropFrom(node.b, panel);
  if (!a) return b;
  if (!b) return a;
  return { ...node, a, b };
}
function nextStackId(node) {
  const numbers = allStacks(node).map(s => Number(s.id.replace(/^s/, "")) || 0);
  return "s" + (Math.max(0, ...numbers) + 1);
}
function insertInto(node, id, panel, zone, newId) {
  if (node.kind === "stack" && node.id === id) {
    if (zone === "center") return { ...node, tabs: [...node.tabs, panel], active: panel };
    const incoming = stack(newId, panel);
    const before = zone === "left" || zone === "top";
    const axis = zone === "left" || zone === "right" ? "x" : "y";
    return before ? split(axis, 0.35, incoming, node) : split(axis, 0.65, node, incoming);
  }
  if (node.kind === "split") return { ...node,
    a: insertInto(node.a, id, panel, zone, newId),
    b: insertInto(node.b, id, panel, zone, newId),
  };
  return node;
}
export function movePanel(layout, panel, targetId, zone = "center") {
  if (!PANEL_IDS.includes(panel) || !["center", "left", "right", "top", "bottom"].includes(zone)) return layout;
  const source = stackContaining(layout, panel);
  if (!source || !findStack(layout, targetId)) return layout;
  if (source.id === targetId && (zone === "center" || source.tabs.length === 1)) return layout;
  const copy = structuredClone(layout);
  const newId = nextStackId(copy);
  const reduced = dropFrom(copy, panel);
  if (!reduced || !findStack(reduced, targetId)) return layout;
  const moved = insertInto(reduced, targetId, panel, zone, newId);
  return isValidLayout(moved) ? moved : layout;
}
export function activatePanel(layout, panel) {
  const copy = structuredClone(layout);
  const containing = stackContaining(copy, panel);
  if (containing) containing.active = panel;
  return copy;
}
export function cycleTab(layout, stackId, direction = 1) {
  const stack = findStack(layout, stackId);
  if (!stack || stack.tabs.length < 2) return layout;
  const index = stack.tabs.indexOf(stack.active);
  return activatePanel(layout, stack.tabs[(index + direction + stack.tabs.length) % stack.tabs.length]);
}

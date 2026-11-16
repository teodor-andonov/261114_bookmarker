import { allStacks } from "./layout-core.js";

// Every pointer position resolves to one target: an existing box (tab) or
// a thin gap at its perimeter. No overlapping five-zone drop overlay.
export function zoneAt(rect, x, y) {
  const margin = Math.min(28, Math.max(12, Math.min(rect.width, rect.height) * 0.12));
  const candidates = [
    ["left", x - rect.left], ["right", rect.right - x],
    ["top", y - rect.top], ["bottom", rect.bottom - y],
  ].sort((a, b) => a[1] - b[1]);
  return candidates[0][1] <= margin ? candidates[0][0] : "center";
}

export function gapInsertion(node, panel) {
  if (node.kind !== "split") throw Error("A gap belongs to a split.");
  const sourceInFirst = allStacks(node.a).some(s => s.tabs.includes(panel));
  const target = sourceInFirst ? allStacks(node.b)[0] : allStacks(node.a).at(-1);
  const zone = node.axis === "x"
    ? (sourceInFirst ? "left" : "right")
    : (sourceInFirst ? "top" : "bottom");
  return { targetId: target.id, zone };
}

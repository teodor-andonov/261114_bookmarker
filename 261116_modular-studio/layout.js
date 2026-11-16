import {
  PANEL_IDS, defaultLayout, isValidLayout, findStack, stackContaining,
  movePanel, activatePanel, cycleTab, allStacks,
} from "./layout-core.js";

const LABELS = {
  editor: "Editor", viewer: "Viewer", runner: "Replicad Runner",
  formatter: "Formatter", parameters: "Parametric Controls",
};
const STORAGE_KEY = "testlab:modular-studio:layout-v1";
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const editable = target => target?.closest?.("input, textarea, select, [contenteditable='true'], .cm-editor");

export function createWorkspace(host, panels, onFocus = () => {}) {
  let layout;
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); layout = isValidLayout(saved) ? saved : defaultLayout(); }
  catch { layout = defaultLayout(); }
  let focusedId = stackContaining(layout, "editor")?.id || allStacks(layout)[0].id;
  let maximizedId = null;
  let draggingPanel = null;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
  }
  function focus(id) {
    if (!findStack(layout, id)) return;
    focusedId = id;
    host.querySelectorAll(".dock-stack").forEach(node => {
      node.classList.toggle("focused", node.dataset.stack === focusedId);
    });
    onFocus(findStack(layout, focusedId));
  }
  function renderNode(node) {
    if (node.kind === "split") {
      const wrap = el("div", "dock-split " + (node.axis === "x" ? "horizontal" : "vertical"));
      const a = renderNode(node.a);
      const b = renderNode(node.b);
      a.style.flex = "0 0 calc(" + (node.ratio * 100) + "% - 3px)";
      b.style.flex = "1 1 0%";
      const grip = el("div", "split-grip");
      grip.setAttribute("role", "separator");
      grip.setAttribute("aria-orientation", node.axis === "x" ? "vertical" : "horizontal");
      grip.setAttribute("title", "Drag to resize");
      grip.addEventListener("pointerdown", event => {
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        const box = wrap.getBoundingClientRect();
        const update = e => {
          const raw = node.axis === "x" ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height;
          node.ratio = Math.max(0.12, Math.min(0.88, raw));
          a.style.flexBasis = "calc(" + (node.ratio * 100) + "% - 3px)";
        };
        const stop = () => {
          grip.removeEventListener("pointermove", update);
          grip.removeEventListener("pointerup", stop);
          grip.removeEventListener("pointercancel", stop);
          persist();
        };
        grip.addEventListener("pointermove", update);
        grip.addEventListener("pointerup", stop);
        grip.addEventListener("pointercancel", stop);
      });
      wrap.append(a, grip, b);
      return wrap;
    }
    const root = el("section", "dock-stack");
    root.dataset.stack = node.id;
    root.setAttribute("aria-label", "Panel box");
    root.addEventListener("pointerdown", () => focus(node.id));
    const header = el("div", "dock-head");
    const tabs = el("div", "dock-tabs");
    tabs.setAttribute("role", "tablist");
    for (const panel of node.tabs) {
      const button = el("button", "dock-tab" + (node.active === panel ? " active" : ""), LABELS[panel]);
      button.type = "button";
      button.draggable = true;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(node.active === panel));
      button.title = "Drag to dock; click to select";
      button.addEventListener("click", () => {
        layout = activatePanel(layout, panel);
        focus(node.id);
        persist(); render();
      });
      button.addEventListener("dragstart", event => {
        draggingPanel = panel;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", panel);
        document.body.classList.add("dragging-panel");
      });
      button.addEventListener("dragend", () => {
        draggingPanel = null;
        document.body.classList.remove("dragging-panel");
      });
      tabs.append(button);
    }
    const expand = el("button", "expand-btn", maximizedId === node.id ? "↙" : "⛶");
    expand.type = "button";
    expand.title = "Maximise / restore box (Space)";
    expand.setAttribute("aria-label", "Maximise or restore this box");
    expand.addEventListener("click", () => { focus(node.id); toggleMaximize(); });
    header.addEventListener("dblclick", event => {
      if (event.target.closest("button")) return;
      focus(node.id); toggleMaximize();
    });
    header.append(tabs, expand);

    const content = el("div", "dock-content");
    content.append(panels[node.active]);
    const targets = el("div", "dock-targets");
    for (const zone of ["top","left","center","right","bottom"]) {
      const area = el("div", "dock-zone zone-" + zone, zone === "center" ? "Tab" : zone);
      area.addEventListener("dragover", event => {
        if (!draggingPanel) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        targets.querySelectorAll(".dock-zone").forEach(n => n.classList.remove("hovered"));
        area.classList.add("hovered");
      });
      area.addEventListener("drop", event => {
        event.preventDefault();
        const moved = draggingPanel || event.dataTransfer.getData("text/plain");
        draggingPanel = null;
        document.body.classList.remove("dragging-panel");
        dock(moved, node.id, zone);
      });
      targets.append(area);
    }
    root.append(header, content, targets);
    return root;
  }
  function render() {
    if (maximizedId && !findStack(layout, maximizedId)) maximizedId = null;
    if (!findStack(layout, focusedId)) focusedId = allStacks(layout)[0].id;
    host.classList.toggle("is-maximized", Boolean(maximizedId));
    host.replaceChildren(renderNode(maximizedId ? findStack(layout, maximizedId) : layout));
    focus(maximizedId || focusedId);
  }
  function dock(panel, stackId, zone) {
    const before = layout;
    layout = movePanel(layout, panel, stackId, zone);
    if (before !== layout) {
      focusedId = stackContaining(layout, panel)?.id || focusedId;
      if (maximizedId) maximizedId = null;
      persist(); render();
    }
  }
  function toggleMaximize() {
    maximizedId = maximizedId === focusedId ? null : focusedId;
    render();
  }
  function activate(panel) {
    const target = stackContaining(layout, panel);
    if (!target) return;
    layout = activatePanel(layout, panel);
    if (maximizedId && maximizedId !== target.id) maximizedId = null;
    focusedId = target.id;
    persist(); render();
  }
  function reset() {
    layout = defaultLayout();
    focusedId = "s1"; maximizedId = null;
    persist(); render();
  }
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    if (editable(event.target)) return;
    if (event.key === "Tab") {
      const stack = findStack(layout, focusedId);
      if (stack && stack.tabs.length > 1) {
        event.preventDefault();
        layout = cycleTab(layout, focusedId, event.shiftKey ? -1 : 1);
        persist(); render();
      }
    } else if (event.code === "Space" && !event.repeat &&
               !event.target.closest?.("dialog, [role='dialog']")) {
      event.preventDefault();
      toggleMaximize();
    } else if (event.key === "Escape" && maximizedId) {
      maximizedId = null; render();
    }
  });
  render();
  return {
    reset, activate, dock, toggleMaximize,
    get focusedPanel() { return findStack(layout, focusedId)?.active; },
    get layout() { return structuredClone(layout); },
    get maximizeId() { return maximizedId; },
    listPanels: () => [...PANEL_IDS],
  };
}

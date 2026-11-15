import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { syncFaces, syncLines } from "replicad-threejs-helper";
import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, keymap, drawSelection } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { DEMOS, NEW_MODEL } from "./examples.js";
import { parameterEdit } from "./param-source.js";

const $ = id => document.getElementById(id);
let programmaticEditorUpdate = false;
const editor = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off", autocorrect: "off" }),
      javascript(),
      oneDark,
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !programmaticEditorUpdate) onSourceEdited();
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "12.5px" },
        ".cm-scroller": { overflow: "auto", fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace' },
        ".cm-content": { minHeight: "100%", padding: "14px 0" },
        ".cm-gutters": { backgroundColor: "#1a2024", borderRight: "1px solid #333d45" },
      }),
    ],
  }),
  parent: $("code"),
});
// Preserve a simple code.value interface for the file system and worker paths.
const code = {
  get value() { return editor.state.doc.toString(); },
  set value(source) {
    programmaticEditorUpdate = true;
    try {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: source },
        selection: { anchor: 0 },
        scrollIntoView: true,
      });
    } finally {
      programmaticEditorUpdate = false;
    }
  },
};
const fileNameLabel = $("fileName");
const unsavedLabel = $("unsaved");
const statusLabel = $("statusText");
const statusLight = $("statusLight");
const paramsRoot = $("params");
const paramsNote = $("paramsNote");
const placeholder = $("viewerPlaceholder");
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });


let fileHandle = null;
let fileName = "untitled.js";
let dirty = false;
let params = {};
let built = false;
let lastBuildRequest = 0;
let requestIndex = 0;
const requests = new Map();
let queuedBuild = null;

function status(text, state = "busy") {
  statusLabel.textContent = text;
  statusLight.className = "led" + (state === "ok" ? " ok" : state === "error" ? " error" : "");
}
function setDirty(value) {
  dirty = value;
  unsavedLabel.hidden = !value;
}
function nameFromFile(name) {
  return String(name || "untitled.js").replace(/[/\\]/g, "_").replace(/\.js$/i, "") + ".js";
}
function setName(name) {
  fileName = nameFromFile(name);
  fileNameLabel.textContent = fileName;
}
function filenameFor(extension) {
  return fileName.replace(/\.js$/i, "") + "." + extension;
}
function exportsEnabled(enabled) {
  $("stepButton").disabled = !enabled;
  $("stlButton").disabled = !enabled;
  $("threeDmButton").disabled = !enabled;
}
function setSource(source, name, handle = null) {
  code.value = source;
  fileHandle = handle;
  setName(name);
  setDirty(false);
  built = false;
  cameraHasBeenFitted = false;
  exportsEnabled(false);
  build(null, "run");
}
function send(type, fields = {}) {
  const id = ++requestIndex;
  requests.set(id, { type, kind: fields.kind || type });
  worker.postMessage({ id, type, ...fields });
  return id;
}
function build(values = null, kind = "run") {
  clearTimeout(queuedBuild);
  built = false;
  exportsEnabled(false);
  status(kind === "auto" ? "Rebuilding parameters…" : "Computing geometry…");
  const id = send("build", { source: code.value, values, kind });
  lastBuildRequest = id;
}
function autoBuild() {
  clearTimeout(queuedBuild);
  queuedBuild = setTimeout(() => build(null, "auto"), 230);
}
worker.addEventListener("message", event => {
  const data = event.data;
  const request = requests.get(data.id);
  requests.delete(data.id);
  if (!request) return;
  if (data.type === "error") {
    if (request.type !== "build" || data.id === lastBuildRequest) {
      status(data.message, "error");
      if (request.type === "export") alert("Export failed: " + data.message);
      if (request.type === "build") placeholder.textContent = "Model error. See status above.";
    }
    return;
  }
  if (data.type === "built") {
    if (data.id !== lastBuildRequest) return;
    try {
      showMeshes(data.meshes);
      built = true;
      exportsEnabled(true);
      params = { ...data.values };
      if (request.kind !== "auto") renderParameters();
      placeholder.hidden = true;
      status("Model ready · " + data.meshes.length + (data.meshes.length === 1 ? " shape" : " shapes"), "ok");
    } catch (error) {
      status("Viewer error: " + error.message, "error");
      placeholder.hidden = false;
      placeholder.textContent = "Could not display mesh.";
    }
  } else if (data.type === "exported") {
    const type = data.format;
    const mime = type === "step" ? "model/step" : type === "3dm" ? "application/octet-stream" : "model/stl";
    const extension = type === "step" ? "step" : type === "3dm" ? "3dm" : "stl";
    saveBlob(new Blob([data.bytes], { type: mime }), filenameFor(extension), mime, false)
      .then(() => status(type.toUpperCase() + " export ready", "ok"))
      .catch(error => status("Export save failed: " + error.message, "error"));
  }
});
worker.addEventListener("error", event => {
  status("CAD worker failed: " + event.message, "error");
});

function rowFor(name, value) {
  const row = document.createElement("div");
  row.className = "param-row";
  const label = document.createElement("label");
  label.textContent = name.replace(/([A-Z])/g, " $1");
  label.title = name;
  row.append(label);

  function changed(next) {
    if (Object.is(params[name], next)) return true;
    try {
      const edit = parameterEdit(code.value, name, next);
      programmaticEditorUpdate = true;
      try {
        // Single focused edit: CodeMirror keeps the syntax, surrounding
        // comments, undo history, and editor selection untouched.
        editor.dispatch({
          changes: { from: edit.from, to: edit.to, insert: edit.insert },
          effects: EditorView.scrollIntoView(edit.from, { y: "center" }),
        });
      } finally {
        programmaticEditorUpdate = false;
      }
      params[name] = next;
      setDirty(true);
      built = false;
      lastBuildRequest = -1; // discard results from prior source revisions
      exportsEnabled(false);
      autoBuild();
      return true;
    } catch (error) {
      status("Cannot update source: " + error.message, "error");
      return false;
    }
  }
  if (typeof value === "number") {
    const slider = document.createElement("input");
    slider.type = "range";
    const abs = Math.max(Math.abs(value), 1);
    slider.min = String(value >= 0 ? 0 : Math.floor(value - abs * 2));
    slider.max = String(Math.ceil(Math.max(value * 3, value + abs * 2, 10)));
    slider.step = String(Number.isInteger(value) ? 1 : 0.1);
    slider.value = String(value);
    slider.setAttribute("aria-label", name);
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.value = String(value);
    input.setAttribute("aria-label", name + " value");
    slider.addEventListener("input", () => {
      const previous = params[name];
      input.value = slider.value;
      if (!changed(Number(slider.value))) {
        slider.value = String(previous);
        input.value = String(previous);
      }
    });
    input.addEventListener("change", () => {
      const number = Number(input.value);
      if (!Number.isFinite(number)) return;
      const previous = params[name];
      slider.value = String(number);
      if (!changed(number)) {
        slider.value = String(previous);
        input.value = String(previous);
      }
    });
    row.append(slider, input);
  } else if (typeof value === "boolean") {
    const filler = document.createElement("span");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = value;
    checkbox.setAttribute("aria-label", name);
    checkbox.addEventListener("change", () => {
      if (!changed(checkbox.checked)) checkbox.checked = params[name];
    });
    row.append(filler, checkbox);
  } else {
    const filler = document.createElement("span");
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    input.setAttribute("aria-label", name);
    input.addEventListener("change", () => {
      if (!changed(input.value)) input.value = String(params[name]);
    });
    row.append(filler, input);
  }
  return row;
}
function renderParameters() {
  const list = Object.entries(params);
  paramsNote.textContent = list.length + " exposed";
  paramsRoot.replaceChildren();
  if (!list.length) {
    const note = document.createElement("p");
    note.className = "empty";
    note.textContent = "No defaultParams were found in the model.";
    paramsRoot.append(note);
    return;
  }
  paramsRoot.append(...list.map(([name, value]) => rowFor(name, value)));
}

// Source is the only model state. Slider edits have already rewritten the
// visible JavaScript, so Save never needs to apply hidden parameter overrides.
async function saveBlob(blob, name, mime = "application/octet-stream", usePicker = true) {
  // Exports complete asynchronously in a worker; their file picker would lose
  // its required user activation, so export through a normal browser download.
  if (usePicker && "showSaveFilePicker" in window) {
    const ext = "." + name.split(".").pop();
    const handle = await window.showSaveFilePicker({
      suggestedName: name,
      types: [{ description: "Model file", accept: { [mime]: [ext] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }
  // Android / Firefox fallback: a normal system download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function saveCode(forceSaveAs = false) {
  try {
    const source = code.value;
    const blob = new Blob([source], { type: "text/javascript" });
    if (!forceSaveAs && fileHandle) {
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else if ("showSaveFilePicker" in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "JavaScript model", accept: { "text/javascript": [".js"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      fileHandle = handle;
      setName(handle.name);
    } else {
      await saveBlob(blob, fileName, "text/javascript");
      fileHandle = null;
    }
    setDirty(false);
    status("Model source saved", "ok");
  } catch (error) {
    if (error?.name !== "AbortError") status("Save failed: " + error.message, "error");
  }
}
async function openModel() {
  try {
    if (dirty && !confirm("Discard unsaved changes and open another model?")) return;
    if ("showOpenFilePicker" in window) {
      const handles = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: "JavaScript model", accept: { "text/javascript": [".js"] } }],
      });
      const file = await handles[0].getFile();
      setSource(await file.text(), file.name, handles[0]);
    } else {
      $("openInput").click();
    }
  } catch (error) {
    if (error?.name !== "AbortError") status("Open failed: " + error.message, "error");
  }
}
$("openInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  setSource(await file.text(), file.name, null);
  event.target.value = "";
});
$("openButton").addEventListener("click", openModel);
const demoDialog = $("demoDialog");
const demoList = $("demoList");
for (const demo of DEMOS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "demo-card";
  const content = document.createElement("span");
  content.className = "demo-card-content";
  const title = document.createElement("span");
  title.className = "demo-card-name";
  title.textContent = demo.title;
  const description = document.createElement("span");
  description.className = "demo-card-detail";
  description.textContent = demo.description;
  const tag = document.createElement("span");
  tag.className = "demo-card-tag";
  tag.textContent = "LOAD ↗";
  content.append(title, description);
  button.append(content, tag);
  button.addEventListener("click", () => {
    if (dirty && !confirm("Discard unsaved changes and load " + demo.title + "?")) return;
    demoDialog.close();
    // Bundled examples are copies, not file handles or persistent records.
    setSource(demo.source, demo.filename, null);
  });
  demoList.append(button);
}
$("demosButton").addEventListener("click", () => demoDialog.showModal());
$("closeDemoDialog").addEventListener("click", () => demoDialog.close());
demoDialog.addEventListener("click", event => {
  if (event.target === demoDialog) demoDialog.close();
});
$("saveButton").addEventListener("click", () => saveCode(false));
$("saveAsButton").addEventListener("click", () => saveCode(true));
function runCode() {
  // Every rebuild reads defaultParams from the code currently in the editor.
  build(null, "run");
}
$("runButton").addEventListener("click", runCode);
$("newButton").addEventListener("click", () => {
  if (dirty && !confirm("Discard unsaved changes and start a new model?")) return;
  setSource(NEW_MODEL, "untitled.js", null);
});
$("stepButton").addEventListener("click", () => {
  if (!built) return;
  status("Preparing exact STEP B-rep…");
  send("export", { format: "step" });
});
$("stlButton").addEventListener("click", () => {
  if (!built) return;
  status("Preparing STL mesh…");
  send("export", { format: "stl" });
});
$("threeDmButton").addEventListener("click", () => {
  if (!built) return;
  status("Preparing exact Rhino B-reps…");
  send("export", { format: "3dm" });
});
function onSourceEdited() {
  setDirty(true);
  lastBuildRequest = -1;
  setDirty(true);
  built = false;
  exportsEnabled(false);
  status("Code changed · press Run");
}
window.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCode(false);
  } else if (event.key === "Enter") {
    event.preventDefault();
    runCode();
  }
});
window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
});

// Three.js visualisation. These meshes are DISPLAY ONLY; STEP exports are
// produced separately from the original OCCT B-rep in the worker.
const canvas = $("viewer");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 20000);
camera.up.set(0, 0, 1);
camera.position.set(100, -140, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
const grid = new THREE.GridHelper(400, 40, 0x53616a, 0x384249);
grid.rotation.x = Math.PI / 2;
scene.add(grid);
scene.add(new THREE.AmbientLight(0xffffff, 2.4));
const sunlight = new THREE.DirectionalLight(0xffffff, 3.0);
sunlight.position.set(90, -80, 150);
scene.add(sunlight);
const bodyGroup = new THREE.Group();
scene.add(bodyGroup);
function disposeGroup() {
  for (const child of [...bodyGroup.children]) {
    child.geometry?.dispose();
    child.material?.dispose();
    bodyGroup.remove(child);
  }
}
function showMeshes(meshes) {
  disposeGroup();
  for (const entry of meshes) {
    const faceGeometry = new THREE.BufferGeometry();
    syncFaces(faceGeometry, entry.faces);
    faceGeometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      color: 0x91adc2, metalness: 0.16, roughness: 0.68,
      side: THREE.DoubleSide, polygonOffset: true,
      polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
    bodyGroup.add(new THREE.Mesh(faceGeometry, material));
    if (entry.edges) {
      const lineGeometry = new THREE.BufferGeometry();
      syncLines(lineGeometry, entry.edges);
      bodyGroup.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x273b4d })));
    }
  }
  // Preserve the user's camera and orbit target on parameter-driven rebuilds.
  // New files and explicit Fit are the only automatic framing actions.
  if (!cameraHasBeenFitted) {
    fitModel();
    cameraHasBeenFitted = true;
  }
}
let cameraHasBeenFitted = false;
function fitModel() {
  if (!bodyGroup.children.length) return;
  const bounds = new THREE.Box3().setFromObject(bodyGroup);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z, 1);
  controls.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1.25, -1.5, 1.18).normalize().multiplyScalar(extent * 2.55));
  camera.near = Math.max(0.01, extent / 500);
  camera.far = Math.max(2000, extent * 100);
  camera.updateProjectionMatrix();
  controls.update();
  cameraHasBeenFitted = true;
}
$("fitButton").addEventListener("click", fitModel);
$("gridButton").addEventListener("click", () => {
  grid.visible = !grid.visible;
  $("gridButton").setAttribute("aria-pressed", String(grid.visible));
});
function resize() {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  renderer.setSize(rect.width, rect.height, false);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);
function frame() {
  requestAnimationFrame(frame);
  controls.update();
  renderer.render(scene, camera);
}
resize();
frame();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" })
      .catch(error => console.warn("Offline support unavailable:", error));
  });
}
setSource(DEMOS[0].source, DEMOS[0].filename, null);

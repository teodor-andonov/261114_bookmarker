import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { syncFaces, syncLines } from "replicad-threejs-helper";

const $ = id => document.getElementById(id);
const code = $("code");
const fileNameLabel = $("fileName");
const unsavedLabel = $("unsaved");
const statusLabel = $("statusText");
const statusLight = $("statusLight");
const paramsRoot = $("params");
const paramsNote = $("paramsNote");
const placeholder = $("viewerPlaceholder");
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

const example = `// Replicad model — dimensions in millimetres.
// Edit the code, then press Run. The controls below rebuild automatically.
const defaultParams = {
  width: 60,
  depth: 40,
  height: 30,
  cornerRadius: 5,
};

const main = (replicad, params) => {
  const { width, depth, height, cornerRadius } = params;
  const radius = Math.max(0.1, Math.min(cornerRadius, width / 2 - 0.1, depth / 2 - 0.1));
  return replicad.drawRoundedRectangle(width, depth, radius)
    .sketchOnPlane()
    .extrude(height);
};
`;

let fileHandle = null;
let fileName = "untitled.js";
let dirty = false;
let params = {};
let defaultParams = {};
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
}
function setSource(source, name, handle = null) {
  code.value = source;
  fileHandle = handle;
  setName(name);
  setDirty(false);
  built = false;
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
  queuedBuild = setTimeout(() => build({ ...params }, "auto"), 230);
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
      defaultParams = data.defaults;
      if (request.kind !== "auto") {
        params = { ...data.values };
        renderParameters();
      }
      placeholder.hidden = true;
      status("Model ready · " + data.meshes.length + (data.meshes.length === 1 ? " shape" : " shapes"), "ok");
    } catch (error) {
      status("Viewer error: " + error.message, "error");
      placeholder.hidden = false;
      placeholder.textContent = "Could not display mesh.";
    }
  } else if (data.type === "exported") {
    const type = data.format;
    const mime = type === "step" ? "model/step" : "model/stl";
    saveBlob(new Blob([data.bytes], { type: mime }), filenameFor(type === "step" ? "step" : "stl"), mime, false)
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
    params[name] = next;
    setDirty(true);
    autoBuild();
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
      input.value = slider.value;
      changed(Number(slider.value));
    });
    input.addEventListener("change", () => {
      const number = Number(input.value);
      if (!Number.isFinite(number)) return;
      slider.value = String(number);
      changed(number);
    });
    row.append(slider, input);
  } else if (typeof value === "boolean") {
    const filler = document.createElement("span");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = value;
    checkbox.setAttribute("aria-label", name);
    checkbox.addEventListener("change", () => changed(checkbox.checked));
    row.append(filler, checkbox);
  } else {
    const filler = document.createElement("span");
    const input = document.createElement("input");
    input.type = "text";
    input.value = String(value);
    input.setAttribute("aria-label", name);
    input.addEventListener("change", () => changed(input.value));
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

// Save the current parameter values back into an ordinary portable JS model.
// Only a plain object-literal defaultParams declaration is rewritten; otherwise
// we refuse to silently discard unsaved parameter edits.
function sourceWithParams() {
  const changed = Object.keys(params).some(name => params[name] !== defaultParams[name]);
  if (!changed) return code.value;
  const re = /\b(?:const|let|var)\s+defaultParams\s*=\s*\{[\s\S]*?\}\s*;/;
  if (!re.test(code.value)) throw new Error("Cannot save changed parameters: use a plain 'const defaultParams = { ... };' object.");
  const formatted = "const defaultParams = " + JSON.stringify(params, null, 2) + ";";
  return code.value.replace(re, formatted);
}
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
    const source = sourceWithParams();
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
    code.value = source;
    defaultParams = { ...params };
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
$("saveButton").addEventListener("click", () => saveCode(false));
$("saveAsButton").addEventListener("click", () => saveCode(true));
$("runButton").addEventListener("click", () => build(null, "run"));
$("newButton").addEventListener("click", () => {
  if (dirty && !confirm("Discard unsaved changes and start a new model?")) return;
  setSource(example, "untitled.js", null);
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
code.addEventListener("input", () => {
  setDirty(true);
  built = false;
  exportsEnabled(false);
  status("Code changed · press Run");
});
code.addEventListener("keydown", event => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const start = code.selectionStart;
  code.setRangeText("  ", start, code.selectionEnd, "end");
  code.dispatchEvent(new Event("input"));
});
window.addEventListener("keydown", event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveCode(false);
  } else if (event.key === "Enter") {
    event.preventDefault();
    build(null, "run");
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
  fitModel();
}
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
setSource(example, "untitled.js", null);

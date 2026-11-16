import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {parseMayaAscii} from "./maya-parser.js";
import {exportMesh3dm} from "./rhino-export.js";

const $ = id => document.getElementById(id);
const canvas = $("viewport");
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x1d252b);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d252b);
const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000000);
camera.up.set(0, 0, 1);
camera.position.set(5, -8, 5);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
const ambient = new THREE.HemisphereLight(0xe7f5ff, 0x313c45, 2.5);
ambient.position.set(0, 0, 20);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(6, -7, 12);
scene.add(sun);

const modelGroup = new THREE.Group();
scene.add(modelGroup);
let parsed = null, currentName = "maya-geometry.ma";
let edgeHelpers = [];
let cameraExtent = 10;

function clearModel() {
  for (const child of [...modelGroup.children]) {
    modelGroup.remove(child);
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
    else child.material?.dispose();
  }
  edgeHelpers = [];
}

function addMesh(object) {
  const faces = [], edgePairs = new Set(), edges = [];
  for (const polygon of object.faces) {
    for (let i = 1; i < polygon.length - 1; i++) {
      for (const index of [polygon[0], polygon[i], polygon[i + 1]])
        faces.push(...object.vertices[index]);
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const key = Math.min(a,b) + ":" + Math.max(a,b);
      if (!edgePairs.has(key)) {
        edgePairs.add(key);
        edges.push(...object.vertices[a], ...object.vertices[b]);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(faces, 3));
  geometry.computeVertexNormals();
  const surface = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: 0x8aa5b3, side: THREE.DoubleSide, metalness: 0.1,
    roughness: 0.82, flatShading: true
  }));
  surface.name = object.name;
  modelGroup.add(surface);
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edges, 3));
  const lines = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({
    color: 0x16252f, transparent: true, opacity: 0.86
  }));
  lines.visible = $("wireframe").checked;
  edgeHelpers.push(lines);
  modelGroup.add(lines);
}

function fitView() {
  if (!modelGroup.children.length) return;
  const bounds = new THREE.Box3().setFromObject(modelGroup);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.01);
  cameraExtent = radius;
  camera.position.copy(center).add(new THREE.Vector3(radius*1.7, -radius*2, radius*1.3));
  camera.near = Math.max(radius / 10000, 0.0001);
  camera.far = Math.max(radius * 2000, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function renderObjects() {
  clearModel();
  if (!parsed) return;
  for (const object of parsed.objects) addMesh(object);
  fitView();
}

function safeText(element, value) { element.textContent = String(value); }

function showResults() {
  const objects = parsed.objects;
  safeText($("object-count"), objects.length);
  safeText($("face-count"), objects.reduce((s,o) => s + o.faces.length, 0));
  safeText($("quad-count"), objects.reduce((s,o) => s + o.quads, 0));
  safeText($("unit-label"), parsed.unit);
  safeText($("geometry-count"), objects.length + " meshes");
  $("objects").replaceChildren();
  for (const object of objects) {
    const row = document.createElement("div");
    row.className = "object-item";
    const dot = document.createElement("span");
    dot.className = "mesh-dot";
    const body = document.createElement("div");
    const name = document.createElement("div");
    name.className = "object-name";
    name.textContent = object.name;
    const detail = document.createElement("div");
    detail.className = "subtle";
    detail.textContent = object.vertices.length + " vertices · " + object.faces.length +
      " faces · " + object.quads + " quads";
    body.append(name, detail);
    const flag = document.createElement("span");
    flag.className = "chip";
    flag.textContent = object.smoothPreview ? "Smooth preview" : "Polygon";
    row.append(dot, body, flag);
    $("objects").append(row);
  }
  if (!objects.length) $("objects").textContent = "No supported mesh cages found.";
  $("warnings").hidden = parsed.warnings.length === 0;
  $("warnings").replaceChildren();
  if (parsed.warnings.length) {
    const title = document.createElement("strong");
    title.textContent = parsed.warnings.length + " import notices";
    $("warnings").append(title);
    for (const warning of parsed.warnings.slice(0,30)) {
      const paragraph = document.createElement("p");
      paragraph.textContent = warning;
      $("warnings").append(paragraph);
    }
  }
  $("export-button").disabled = objects.length === 0;
  $("empty").hidden = objects.length > 0;
  safeText($("status"), objects.length ?
    "Geometry loaded · export is ready" : "No geometry found in this Maya file.");
  $("status").dataset.kind = objects.length ? "ok" : "warning";
}

async function openFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".ma")) {
    safeText($("status"), "Choose an Autodesk Maya ASCII .ma file.");
    $("status").dataset.kind = "error";
    return;
  }
  currentName = file.name;
  safeText($("file-name"), file.name);
  safeText($("file-info"), (file.size / 1024 / 1024).toFixed(2) + " MB · Maya ASCII");
  $("status").dataset.kind = "pending";
  safeText($("status"), "Parsing geometry…");
  $("export-button").disabled = true;
  try {
    parsed = parseMayaAscii(await file.text());
    renderObjects();
    showResults();
  } catch (error) {
    parsed = null;
    clearModel();
    $("empty").hidden = false;
    safeText($("status"), error.message || String(error));
    $("status").dataset.kind = "error";
  }
}

function download(data, filename, mime) {
  const url = URL.createObjectURL(new Blob([data], {type: mime}));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

$("file-input").addEventListener("change", event => {
  openFile(event.target.files?.[0]);
  event.target.value = "";
});
const drop = $("drop-target");
for (const eventName of ["dragenter","dragover"]) drop.addEventListener(eventName, event => {
  event.preventDefault();
  drop.classList.add("dragging");
});
for (const eventName of ["dragleave","drop"]) drop.addEventListener(eventName, event => {
  event.preventDefault();
  drop.classList.remove("dragging");
});
drop.addEventListener("drop", event => openFile(event.dataTransfer.files?.[0]));
$("wireframe").addEventListener("change", event => {
  for (const lines of edgeHelpers) lines.visible = event.target.checked;
});
$("fit-button").addEventListener("click", fitView);
$("export-button").addEventListener("click", async () => {
  if (!parsed?.objects.length) return;
  const button = $("export-button");
  button.disabled = true;
  button.textContent = "Writing 3DM…";
  try {
    const bytes = await exportMesh3dm(parsed);
    download(bytes, currentName.replace(/\.ma$/i,"") + ".3dm", "application/octet-stream");
    safeText($("status"), "Exported and verified .3dm (" + (bytes.length / 1024).toFixed(1) + " KB)");
    $("status").dataset.kind = "ok";
  } catch (error) {
    safeText($("status"), error.message || String(error));
    $("status").dataset.kind = "error";
  } finally {
    button.disabled = !parsed?.objects.length;
    button.textContent = "Export .3dm";
  }
});
$("script-button").addEventListener("click", async () => {
  try {
    const result = await fetch("./rhino-subd.py");
    if (!result.ok) throw new Error("Could not load the Rhino script.");
    download(await result.text(), "maya_meshes_to_subd.py", "text/x-python");
  } catch (error) {
    safeText($("status"), error.message || String(error));
    $("status").dataset.kind = "error";
  }
});
const resize = () => {
  const {width,height} = canvas.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width,height,false);
  camera.aspect = width/height;
  camera.updateProjectionMatrix();
};
new ResizeObserver(resize).observe(canvas);
resize();
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();

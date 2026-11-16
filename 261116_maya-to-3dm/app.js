import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {parseMayaAscii} from "./maya-parser.js";
import {exportMesh3dm} from "./rhino-export.js";
import {prepareMeshes} from "./subdivide.js";

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
let parsed = null, baked = null, sourceText = "", currentName = "maya-geometry.ma";
let edgeHelpers = [];

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
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(object.vertices.flat(),3));
  const indices=[],edges=new Set(),lines=[];
  for(const face of object.faces) {
    for(let i=1;i<face.length-1;i++)indices.push(face[0],face[i],face[i+1]);
    if($("wireframe").checked)for(let i=0;i<face.length;i++){
      const a=face[i],b=face[(i+1)%face.length];
      const id=Math.min(a,b)+":"+Math.max(a,b);
      if(edges.has(id))continue;
      edges.add(id);
      lines.push(...object.vertices[a],...object.vertices[b]);
    }
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
    color:0x8aa5b3,side:THREE.DoubleSide,metalness:0.04,
    roughness:0.82,flatShading:false
  }));
  mesh.name=object.name;
  modelGroup.add(mesh);
  if(lines.length){
    const wire=new THREE.BufferGeometry();
    wire.setAttribute("position",new THREE.Float32BufferAttribute(lines,3));
    const helper=new THREE.LineSegments(wire,new THREE.LineBasicMaterial({
      color:0x16252f,transparent:true,opacity:0.8
    }));
    edgeHelpers.push(helper);
    modelGroup.add(helper);
  }
}
function fitView() {
  if (!modelGroup.children.length) return;
  const bounds = new THREE.Box3().setFromObject(modelGroup);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 0.01);
  camera.position.copy(center).add(new THREE.Vector3(radius*1.7, -radius*2, radius*1.3));
  camera.near = Math.max(radius / 10000, 0.0001);
  camera.far = Math.max(radius * 2000, 1000);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function renderObjects() {
  clearModel();
  if (!baked) return;
  for (const object of baked.objects) addMesh(object);
  fitView();
}

function safeText(element, value) { element.textContent = String(value); }

function showResults() {
  const objects = baked.objects;
  safeText($("object-count"), objects.length);
  safeText($("face-count"), objects.reduce((s,o) => s + o.faces.length, 0));
  safeText($("quad-count"), objects.reduce((s,o) => s + o.faces.filter(f=>f.length===4).length, 0));
  safeText($("unit-label"), baked.unit);
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
    detail.textContent = object.vertices.length + " vertices · " + object.faces.length + " faces";
    body.append(name, detail);
    const flag = document.createElement("span");
    flag.className = "chip";
    flag.textContent = baked.levels + "× smooth";
    row.append(dot, body, flag);
    $("objects").append(row);
  }
  if (!objects.length) $("objects").textContent = "No supported mesh cages found.";
  $("warnings").hidden = baked.warnings.length === 0;
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
    "Subdivided meshes ready · export .3dm" : "No geometry found in this Maya file.");
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
    sourceText = await file.text();
    refreshAxis();
  } catch (error) {
    parsed = null; baked = null;
    clearModel();
    $("empty").hidden = false;
    safeText($("status"), error.message || String(error));
    $("status").dataset.kind = "error";
  }
}

function rebuild(){
  if(!parsed)return;
  baked=prepareMeshes(parsed,Number($("detail").value));
  renderObjects();
  showResults();
}
function refreshAxis(){
  if(!sourceText)return;
  parsed=parseMayaAscii(sourceText,{upAxis:$("axis").value});
  rebuild();
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
$("wireframe").addEventListener("change",renderObjects);
$("detail").addEventListener("change",rebuild);
$("axis").addEventListener("change",refreshAxis);
$("fit-button").addEventListener("click", fitView);
$("export-button").addEventListener("click", async () => {
  if (!baked?.objects.length) return;
  const button = $("export-button");
  button.disabled = true;
  button.textContent = "Writing 3DM…";
  try {
    const {bytes,exported,skipped} = await exportMesh3dm(baked);
    download(bytes, currentName.replace(/\.ma$/i,"") + ".3dm", "application/octet-stream");
    safeText($("status"), "Exported "+exported+" meshes · "+skipped.length+" skipped · "+(bytes.length/1024).toFixed(1)+" KB");
    $("status").dataset.kind = skipped.length ? "warning" : "ok";
    if(skipped.length){baked.warnings.push(...skipped); showResults(); safeText($("status"),"Exported "+exported+" meshes · "+skipped.length+" skipped");}
  } catch (error) {
    safeText($("status"), error.message || String(error));
    $("status").dataset.kind = "error";
  } finally {
    button.disabled = !baked?.objects.length;
    button.textContent = "Export .3dm";
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

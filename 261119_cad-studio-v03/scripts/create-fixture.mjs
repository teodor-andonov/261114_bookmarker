import rhino3dm from 'rhino3dm';import {writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const r=await rhino3dm(),doc=new r.File3dm();
const settings=doc.settings();settings.modelUnitSystem=r.UnitSystem.Millimeters;
function layer(name,color){const l=new r.Layer();l.name=name;l.color=color;return doc.layers().add(l);}
const baseLayer=layer('Structure',{r:125,g:163,b:184,a:255}),roofLayer=layer('Envelope',{r:202,g:164,b:112,a:255});
function addMesh(name,layerIndex,points,faces){const mesh=new r.Mesh(),v=mesh.vertices(),f=mesh.faces();for(const p of points)v.add(...p);for(const q of faces){if(q.length===3)f.addTriFace(...q);else f.addQuadFace(...q);}const a=new r.ObjectAttributes();a.name=name;a.layerIndex=layerIndex;a.setUserString('purpose','New CAD Studio test fixture');doc.objects().add(mesh,a);}
function box(x,y,z,w,d,h){return [[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];}
const faces=[[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
addMesh('Base mass',baseLayer,box(-600,-400,0,1200,800,400),faces);
addMesh('Roof mass',roofLayer,box(-700,-450,500,1400,900,120),faces);
const bytes=doc.toByteArray();const check=r.File3dm.fromByteArray(bytes);assert.equal(check.objects().count,2);
const target=process.argv[2]||fileURLToPath(new URL('../demo/fixture.3dm',import.meta.url));await writeFile(target,bytes,{flag:'wx'});console.log('Created and re-read real 3DM fixture: '+target+' ('+bytes.length+' bytes)');

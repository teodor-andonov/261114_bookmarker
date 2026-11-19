import * as CAD from 'replicad';
import opencascade from 'replicad-opencascadejs/src/replicad_single.js';
import wasm from 'replicad-opencascadejs/src/replicad_single.wasm?url';
let shapes=[],ready=false;
const send=(kind,data={})=>postMessage({kind,...data});
const safeLog=(...args)=>send('log',{text:args.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v);}catch{return String(v);}}).join(' ')});
async function init(){if(ready)return;safeLog('Loading OpenCascade WASM…');CAD.setOC(await opencascade({locateFile:()=>wasm}));ready=true;safeLog('OpenCascade ready');}
self.onmessage=async({data:m})=>{try{
 if(m.kind==='build'){
  await init();safeLog('Evaluating explicitly authorized source');
  const console={log:safeLog,info:safeLog,warn:safeLog,error:safeLog};
  const main=new Function('console','"use strict";\n'+m.code+'\n;return typeof main==="function"?main:null;')(console);
  if(!main)throw Error('Source must define function main(cad, params)');
  const result=await main(CAD,Object.freeze({...m.params}));
  if(!Array.isArray(result)||!result.length)throw Error('main must return a nonempty array of named objects');
  const ids=new Set(),objects=[];shapes=[];
  for(const object of result){if(typeof object.id!=='string'||!object.id||ids.has(object.id)||!object.shape?.mesh||!object.shape?.blobSTEP)throw Error('Each result requires a unique semantic id and precise Replicad shape');ids.add(object.id);shapes.push({id:object.id,shape:object.shape});safeLog('Tessellating '+object.id);
   const mesh=object.shape.mesh({tolerance:.1,angularTolerance:.15});const positions=new Float32Array(mesh.vertices),indices=new Uint32Array(mesh.triangles);if(!positions.length||!indices.length)throw Error('Empty mesh: '+object.id);
   const part={kind:'mesh',positions,indices};if(mesh.normals?.length===positions.length)part.normals=new Float32Array(mesh.normals);
   objects.push({id:object.id,name:object.name||object.id,group:object.group||'Objects',type:'BRep',color:object.color||'#a8bdcd',properties:object.properties||{},geometry:{native:{type:'runtime-brep',objectId:object.id},display:[part]}});
  }
  send('built',{objects});safeLog('Build complete: '+objects.length+' objects');
 }else if(m.kind==='export'){
  if(!shapes.length)throw Error('No evaluated shapes');
  const files=[];for(const s of shapes){const blob=await s.shape.blobSTEP();const contents=await blob.text();if(!contents.includes('ISO-10303-21')||contents.length<100)throw Error('Invalid/empty STEP output for '+s.id);
   let verified=false;try{if(CAD.importSTEP){const imported=await CAD.importSTEP(blob);verified=!!imported;imported?.delete?.();}}catch(e){safeLog('STEP reimport failed: '+e.message);}
   files.push({id:s.id,blob,verified});}
  send('exported',{files});
 }
}catch(e){send('error',{message:e?.stack||e?.message||String(e)});}};

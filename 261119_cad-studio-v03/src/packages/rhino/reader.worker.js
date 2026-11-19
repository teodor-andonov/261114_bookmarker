import rhino3dm from 'rhino3dm';
import wasm from 'rhino3dm/rhino3dm.wasm?url';
const started=rhino3dm({locateFile:()=>wasm});
function xyz(v){return Array.isArray(v)||ArrayBuffer.isView(v)?[v[0],v[1],v[2]]:[v.x,v.y,v.z];}
function rgb(c){if(!c)return '#a8bdcd';const a=Array.isArray(c)?c:[c.r,c.g,c.b];return a.slice(0,3).every(Number.isFinite)?'#'+a.slice(0,3).map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join(''):'#a8bdcd';}
function meshPart(m){const v=m.vertices(),f=m.faces(),positions=[],indices=[];for(let i=0;i<v.count;i++)positions.push(...xyz(v.get(i)));for(let i=0;i<f.count;i++){const q=f.get(i);const a=q[0]??q.a,b=q[1]??q.b,c=q[2]??q.c,d=q[3]??q.d;indices.push(a,b,c);if(d!==undefined&&d!==c)indices.push(a,c,d);}v.delete?.();f.delete?.();if(!positions.length||!indices.length||!positions.every(Number.isFinite)||!indices.every(Number.isInteger))return null;return {kind:'mesh',positions:new Float32Array(positions),indices:new Uint32Array(indices)};}
function display(r,g){
 if(g instanceof r.Mesh)return [meshPart(g)].filter(Boolean);
 if(g instanceof r.Brep){const out=[],faces=g.faces();for(let i=0;i<faces.count;i++){const face=faces.get(i);try{const mesh=face.getMesh(r.MeshType.Render);if(mesh){const p=meshPart(mesh);if(p)out.push(p);mesh.delete?.();}}finally{face.delete?.();}}faces.delete?.();return out;}
 if(g instanceof r.Extrusion){const mesh=g.getMesh?.(r.MeshType.Render);if(mesh){const p=meshPart(mesh);mesh.delete?.();return [p].filter(Boolean);}return [];}
 if(g instanceof r.Curve){if(g instanceof r.LineCurve)return [{kind:'line',positions:new Float32Array([...xyz(g.pointAtStart),...xyz(g.pointAtEnd)])}];const d=g.domain,a=d[0]??d.t0,b=d[1]??d.t1;if(!Number.isFinite(a)||!Number.isFinite(b))return [];const p=[];for(let i=0;i<=128;i++)p.push(...xyz(g.pointAt(a+(b-a)*i/128)));return [{kind:'line',positions:new Float32Array(p)}];}
 if(g instanceof r.Point)return [{kind:'points',positions:new Float32Array(xyz(g.location))}];
 return [];
}
function units(r,doc){const u=doc.settings().modelUnitSystem;const scaleBy={Microns:.000001,Millimeters:.001,Centimeters:.01,Decimeters:.1,Meters:1,Kilometers:1000,Inches:.0254,Feet:.3048,Yards:.9144,Miles:1609.344};
 for(const [name,scale] of Object.entries(scaleBy)){const e=r.UnitSystem?.[name];if(e!==undefined&&(u===e||(u?.value!==undefined&&u.value===e.value)))return {units:name,unitScale:scale};}
 return {units:'Unknown',unitScale:1};
}
self.onmessage=async e=>{let doc;try{const r=await started;doc=r.File3dm.fromByteArray(e.data.bytes);if(!doc)throw Error('Invalid 3DM file');const layers=doc.layers(),table=doc.objects(),objects=[],layerList=[],warnings=[];
 for(let i=0;i<layers.count;i++){const l=layers.get(i);layerList.push({id:String(l.id),parent:String(l.parentLayerId),name:l.name,fullPath:l.fullPath,color:rgb(l.color),visible:l.visible!==false,index:l.index??i});l.delete?.();}
 const pathFor=(l,seen=new Set())=>{if(!l)return 'Objects';if(l.fullPath)return l.fullPath;if(seen.has(l.id))return l.name;seen.add(l.id);const parent=layerList.find(x=>x.id===l.parent);return parent?pathFor(parent,seen)+'/'+l.name:l.name;};
 for(let i=0;i<table.count;i++){
  const entry=table.get(i),a=entry.attributes(),g=entry.geometry(),id=String(a.id),layer=layerList.find(l=>l.index===a.layerIndex)||layerList[a.layerIndex];let parts=[];
  try{parts=display(r,g);}catch(err){warnings.push(id+': '+err.message);}
  parts=parts.filter(p=>p.positions?.length&&Array.from(p.positions).every(Number.isFinite));
  const type=g.constructor?.name||'Geometry',group=pathFor(layer);let strings=[];try{strings=a.getUserStrings?.()||[];}catch{}
  let material=null;try{if(a.materialIndex>=0){const m=doc.materials().get(a.materialIndex);if(m){material={name:m.name,diffuse:rgb(m.diffuseColor)};m.delete?.();}}}catch{}
  const fromObject=r.ObjectColorSource?.ColorFromObject;const useObject=fromObject!==undefined&&(a.colorSource===fromObject||a.colorSource?.value===fromObject?.value);
  objects.push({id,name:a.name||type,group,type,color:useObject?rgb(a.objectColor):layer?.color||'#a8bdcd',nativeVisible:a.visible!==false&&layer?.visible!==false,properties:{guid:id,layerIndex:a.layerIndex,materialIndex:a.materialIndex,userStrings:strings,material},geometry:{native:{type:'3dm-object',source:e.data.path,guid:id},display:parts.length?parts:null}});
  if(!parts.length)warnings.push((a.name||type)+' ('+id+'): no supported display geometry');
  g.delete?.();a.delete?.();entry.delete?.();
 }
 const u=units(r,doc);if(u.units==='Unknown')warnings.push('Unknown units; displayed as metres without conversion.');
 const result={objects,...u,warning:warnings.length?warnings.length+' display/reading issues: '+warnings.slice(0,15).join('; '):''};postMessage({ok:true,...result});table.delete?.();layers.delete?.();
 }catch(err){postMessage({ok:false,error:err.message||String(err)});}finally{doc?.delete?.();}};

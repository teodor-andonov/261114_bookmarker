import {el,button,choose,action,download} from '../../core/dom.js';
import {modelId,publish} from '../model/index.js';import {parseParameters,sidecar,validate} from './parameters.js';
const request='replicad.openRequest';
const template='function main(cad, params) {\n  return [{ id: "solid", name: "Box", shape: cad.makeBaseBox(500, 350, 250) }];\n}\n';
function recordFor(ws,source){
 const id=modelId('replicad',source);let record=ws.state.get('runner:'+id);if(record)return record;
 record={id,source,token:0,worker:null,pending:null,events:new Set(),logs:[],status:'Ready — manual Run required',trusted:null,watch:[],timer:null};
 record.emit=()=>{for(const fn of record.events)fn();};record.log=t=>{record.logs.push(t);if(record.logs.length>200)record.logs.shift();record.emit();};
 record.stale=message=>{record.status=message;const m=ws.resources.get(id);if(m)ws.resources.publish(id,{...m,stale:true});record.emit();};
 const cleanup=()=>{record.token++;clearTimeout(record.timer);record.pending?.terminate();record.worker?.terminate();record.worker=null;record.pending=null;record.watch.forEach(f=>f());record.watch=[];record.status='Model closed';record.emit();ws.state.delete('runner:'+id);};
 ws.state.set('runner:'+id,record);ws.state.set('cleanup:'+id,cleanup);ws.cleanups.push(cleanup);return record;
}
async function readParams(ws,source){try{const f=await ws.files.text(sidecar(source));return {data:parseParameters(f.text),revision:f.revision};}catch(e){if(e.status===404)return {data:{definitions:[],values:{}},revision:null};throw e;}}
async function run(ws,source,manual=true){
 const r=recordFor(ws,source),token=++r.token;clearTimeout(r.timer);r.pending?.terminate();r.pending=null;r.logs=[];r.status='Reading saved source…';r.emit();
 try{
 if(ws.files.isDirty(source)||ws.files.isDirty(sidecar(source)))throw Error('Save or discard dirty source/parameter edits before building');
 const f=await ws.files.text(source),params=await readParams(ws,source);if(token!==r.token)return;
 if(r.trusted!==f.revision){if(!manual){r.stale('Source changed — Run to authorize new revision');return;}if(!confirm('Execute trusted local source '+source+'? Only run code you trust.')){r.status='Execution not authorized';r.emit();return;}r.trusted=f.revision;}
 r.watch.forEach(x=>x());r.watch=[ws.files.watch(source,f.revision,()=>{r.token++;clearTimeout(r.timer);r.pending?.terminate();r.pending=null;r.stale('Source changed — Run to authorize new revision');})];
 if(params.revision)r.watch.push(ws.files.watch(sidecar(source),params.revision,()=>{r.token++;clearTimeout(r.timer);r.pending?.terminate();r.pending=null;r.stale('Parameters changed — rebuild required');}));
 const worker=new Worker(new URL('./runner.worker.js',import.meta.url),{type:'module'});r.pending=worker;r.status='Building…';r.emit();const old=ws.resources.get(r.id);if(old)ws.resources.publish(r.id,{...old,stale:true});
 function fail(message){if(token!==r.token)return;clearTimeout(r.timer);worker.terminate();r.pending=null;r.stale('Build failed — '+message);r.log(message);}
 r.timer=setTimeout(()=>fail('Worker timed out after 120 seconds'),120000);
 worker.onerror=e=>fail(e.message||'Worker initialization failed');
 worker.onmessage=async e=>{if(token!==r.token)return;const m=e.data;
  if(m.kind==='log'){r.log(m.text);return;}
  if(m.kind==='error'){fail(m.message);return;}
  if(m.kind==='built'){
   clearTimeout(r.timer);
   try{const current=await ws.files.text(source),currentParams=await readParams(ws,source);if(token!==r.token)return;if(current.revision!==f.revision||currentParams.revision!==params.revision){fail('Files changed during build');return;}
    const revision=f.revision+':'+(params.revision||'none');publish(ws,{type:'model@1',id:r.id,source,handler:'replicad',name:source.split('/').pop(),units:'mm',unitScale:.001,revision,objects:m.objects});r.worker?.terminate();r.worker=worker;r.pending=null;r.status='Built — '+m.objects.length+' objects';r.emit();
    worker.onmessage=event=>{const d=event.data;if(d.kind==='log')r.log(d.text);if(d.kind==='error')r.log('Export failed: '+d.message);if(d.kind==='exported'){for(const file of d.files){download(source.split('/').pop().replace(/\.js$/,'')+'-'+file.id+'.step',file.blob);r.log('STEP '+file.id+': '+(file.verified?'engine reimport succeeded':'header checked; reimport not verified'));}}};
    worker.onerror=event=>r.log('Worker error: '+event.message);
   }catch(err){fail(err.message);}
  }
 };
 worker.postMessage({kind:'build',code:f.text,params:params.data.values});
 }catch(e){if(token===r.token){r.stale('Build failed — '+e.message);r.log(e.message);}}
}
function mount(ws,root,settings){
 const bar=el('div',{class:'toolbar'}),sourceLabel=el('div',{class:'status'}),body=el('div',{class:'panecontent'}),controls=el('div'),logs=el('pre',{class:'muted'});body.append(controls,el('hr'),el('strong',{text:'Build output'}),logs);root.append(bar,sourceLabel,body);
 let source=settings.source||'',record=null,paramWatch=()=>{},closed=false,generation=0,renderVersion=0,paramData=null;
 function update(){if(closed||!record)return;sourceLabel.textContent=source+' — '+record.status;logs.textContent=record.logs.join('\n');}
 async function params(){const version=++renderVersion,s=source;try{const p=await readParams(ws,s);if(closed||s!==source||version!==renderVersion)return;paramData=p;controls.replaceChildren();
 if(!p.data.definitions.length)controls.append(el('p',{class:'muted',text:'No parameter definitions. Optional companion: '+sidecar(s)}));
 for(const d of p.data.definitions){const value=p.data.values[d.id],label=d.label||d.id,field=el('div',{class:'field'},el('span',{text:label+(d.units?' ('+d.units+')':'')}));let input;
 const commit=action(ws,async v=>{if(!record||source!==s||paramData!==p)throw Error('Parameter view changed; retry');if(ws.files.isDirty(sidecar(s))||ws.files.isDirty(s))throw Error('Save or discard editor edits before changing parameters');validate(d,v);const next=structuredClone(p.data);next.values[d.id]=v;await ws.files.writeText(sidecar(s),JSON.stringify(next,null,2)+'\n',p.revision);await params();if(record.trusted)await run(ws,s,false);else record.stale('Parameters saved — Run to evaluate');});
 if(d.type==='number'){const num=el('input',{type:'number',min:d.min,max:d.max,step:d.step,value,onChange:e=>commit(Number(e.target.value))});input=el('div',{},el('input',{type:'range',min:d.min,max:d.max,step:d.step,value,onInput:e=>num.value=e.target.value,onChange:e=>commit(Number(e.target.value))}),num);}
 else if(d.type==='boolean')input=el('input',{type:'checkbox',checked:value,onChange:e=>commit(e.target.checked)});
 else input=el('select',{onChange:e=>commit(d.options[Number(e.target.value)])},...d.options.map((v,i)=>el('option',{text:String(v),value:i,selected:v===value})));field.append(input);controls.append(field);}
 paramWatch();if(p.revision)paramWatch=ws.files.watch(sidecar(s),p.revision,()=>params());
 }catch(e){if(!closed&&s===source)controls.textContent=e.message;}}
 async function chooseSource(p){if(!p)return;const token=++generation;await ws.files.text(p);if(closed||token!==generation)return;record?.events.delete(update);paramWatch();source=p;settings.source=p;record=recordFor(ws,p);record.events.add(update);update();await params();}
 const off=ws.context.subscribe(request,v=>{if(v?.path&&v.path!==source)chooseSource(v.path).catch(e=>ws.notify(e.message,true));});
 bar.append(button('Source',action(ws,async()=>{const p=choose('Replicad source path',source||'cones.js');if(p)await chooseSource(p);})),button('New script',action(ws,async()=>{const p=choose('New JavaScript model path','model.js');if(!p)return;await ws.files.writeText(p,template,null);await chooseSource(p);})),button('Run / Rebuild',action(ws,async()=>{if(!source)throw Error('Choose source');await ws.invoke('replicad.run',source);})),button('Export STEP',action(ws,()=>{if(!source)throw Error('Choose source');return ws.invoke('replicad.export',source);})),button('Refresh params',()=>params()));
 if(source)chooseSource(source).catch(e=>ws.notify(e.message,true));else sourceLabel.textContent='Choose a source or create a script.';
 return()=>{closed=true;off();paramWatch();record?.events.delete(update);};
}
export default {id:'replicad',requires:['text','model'],channels:[{id:request,default:null}],handlers:[{id:'replicad',type:'model@1'}],operations:[{id:'replicad.open',title:'Choose in Replicad',accepts:p=>/\.js$/i.test(p)&&!p.startsWith('external:'),run:(ws,path)=>ws.context.set(request,{path,request:crypto.randomUUID()})},{id:'replicad.run',run:(ws,path)=>run(ws,path,true)},{id:'replicad.export',run:(ws,path)=>{const r=recordFor(ws,path);if(!r.worker)throw Error('Build a model first');if(ws.resources.get(r.id)?.stale)throw Error('Last good model is stale; rebuild before export');r.worker.postMessage({kind:'export'});}}],tools:[{id:'replicad',title:'Replicad',mount}]};

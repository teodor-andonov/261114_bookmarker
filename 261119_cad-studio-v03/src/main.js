import './style.css';import './session.css';
import {Registry} from './core/registry.js';import {Workspace} from './core/workspace.js';import {Files} from './core/files.js';import {Host} from './core/host.js';import {el,button,choose} from './core/dom.js';
import {catalog,defaults} from './catalog.js';
const app=document.querySelector('#app'),files=new Files(),head=el('header'),root=el('main',{class:'workspace'}),status=el('footer',{class:'status'}),switcher=el('select',{title:'Workspace',onChange:()=>activate(switcher.value)});app.append(head,root,status);
const sessions=new Map();let current;const notify=(message,error=false)=>{status.textContent=String(message);status.classList.toggle('error',error);};
async function guard(fn){try{await fn();}catch(e){notify(e.message,true);}}
function activate(id){const s=sessions.get(id);if(!s)return;if(current)current.container.hidden=true;current=s;s.container.hidden=false;switcher.value=id;notify(s.ws.name);}
async function open(doc={},binding=null){
 const registry=new Registry();
 for(const id of doc.enabledPackages??defaults){const loader=catalog[id];if(!loader){notify('Missing package '+id,true);continue;}try{registry.add((await loader()).default);}catch(e){notify(e.message,true);}}
 const ws=new Workspace(registry,files,doc,notify),container=el('div',{class:'workspace session'}),host=new Host(ws,container,doc),id=crypto.randomUUID();
 root.append(container);sessions.set(id,{ws,host,container,binding,id});switcher.append(el('option',{value:id,text:ws.name}));activate(id);await ws.restore();
}
async function save(){
 if(!current)return;const s=current;const p=choose('Workspace JSON file',s.binding?.path||s.ws.name+'.workspace.json');if(!p)return;
 const expected=s.binding?.path===p?s.binding.revision:null;
 const result=await files.writeText(p,JSON.stringify(s.host.snapshot(),null,2)+'\n',expected);s.binding={path:p,revision:result.revision};notify('Saved '+p);
}
async function close(){if(!current)return;const s=current;if([...s.host.panels.values()].some(p=>p.settings.dirty)&&!confirm('Discard unsaved editor changes?'))return;s.host.dispose();s.ws.dispose();s.container.remove();sessions.delete(s.id);[...switcher.options].find(x=>x.value===s.id)?.remove();current=null;if(sessions.size)activate(sessions.keys().next().value);}
head.append(el('strong',{text:'CAD STUDIO / 0.3'}),switcher,button('New',()=>guard(async()=>{
 const name=choose('Workspace name','Untitled');if(!name)return;const preset=choose('Packages: all, text, or blank','all');if(preset===null)return;if(!['all','text','blank'].includes(preset))throw Error('Choose all, text or blank');await open({name,enabledPackages:preset==='all'?defaults:preset==='text'?defaults.slice(0,4):[],panels:[]});
})),button('Open workspace',()=>guard(async()=>{const p=choose('Project-relative workspace path','parametric.workspace.json');if(!p)return;const f=await files.text(p);await open(JSON.parse(f.text),{path:p,revision:f.revision});})),button('Save',()=>guard(save)),button('+ Dock',()=>current?.host.split()),button('Close workspace',()=>guard(close)),el('span',{class:'muted',text:'One context / workspace'}));
guard(async()=>{const project=await files.project();document.title='CAD Studio — '+project.name;const initial=new URLSearchParams(location.search).get('workspace')||'parametric.workspace.json';try{const f=await files.text(initial);await open(JSON.parse(f.text),{path:initial,revision:f.revision});}catch(e){await open({name:'New workspace',enabledPackages:defaults,panels:[{id:'files',tool:'file-explorer'}]});notify('Project: '+project.name+' — '+e.message);}});
window.addEventListener('beforeunload',e=>{if([...sessions.values()].some(s=>[...s.host.panels.values()].some(p=>p.settings.dirty))){e.preventDefault();e.returnValue='';}});

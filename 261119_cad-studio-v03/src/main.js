import './style.css';import './session.css';
import {Registry} from './core/registry.js';import {Workspace} from './core/workspace.js';import {Files} from './core/files.js';import {Host} from './core/host.js';import {el,button,choose} from './core/dom.js';import {catalog,defaults} from './catalog.js';
const app=document.querySelector('#app'),head=el('header'),root=el('main',{class:'workspace'}),status=el('footer',{class:'status'}),switcher=el('select',{title:'Workspace',onChange:()=>activate(switcher.value)}),projectLabel=el('span',{class:'muted',text:'No project folder'});app.append(head,root,status);
let files=null,current=null,busy=false;const sessions=new Map(),projectButtons=[];
const notify=(message,error=false)=>{status.textContent=String(message);status.classList.toggle('error',error);};
async function guard(fn){try{await fn();}catch(e){if(e.name!=='AbortError')notify(e.message,true);}}
function activate(id){const s=sessions.get(id);if(!s)return;if(current)current.container.hidden=true;current=s;s.container.hidden=false;switcher.value=id;notify(s.ws.name);}
function markButtons(){for(const b of projectButtons)b.disabled=!files||busy;folderButton.disabled=busy;}
function dirty(){return [...sessions.values()].some(s=>[...s.host.panels.values()].some(p=>p.settings.dirty));}
function disposeAll(){for(const s of sessions.values()){s.host.dispose();s.ws.dispose();s.container.remove();}sessions.clear();switcher.replaceChildren();current=null;}
async function open(doc={},binding=null){
 if(!files)throw Error('Open a project folder first');const registry=new Registry(),errors=[];
 for(const id of doc.enabledPackages??defaults){const loader=catalog[id];if(!loader){errors.push('Missing package '+id);continue;}try{registry.add((await loader()).default);}catch(e){errors.push(e.message);}}
 const ws=new Workspace(registry,files,doc,notify),container=el('div',{class:'workspace session'}),host=new Host(ws,container,doc),id=crypto.randomUUID();
 root.querySelector('.welcome')?.remove();root.append(container);sessions.set(id,{ws,host,container,binding,id});switcher.append(el('option',{value:id,text:ws.name}));activate(id);await ws.restore();if(errors.length)notify(errors.join('; '),true);
}
const defaultDoc=()=>({name:'Project workspace',enabledPackages:defaults,panels:[{id:'files',tool:'file-explorer'},{id:'editor',tool:'code-editor'},{id:'runner',tool:'replicad'},{id:'viewer',tool:'model-viewer'},{id:'tree',tool:'model-explorer'},{id:'inspector',tool:'object-inspector'}],groups:[{id:'a',tabs:['files'],active:'files',weight:1},{id:'b',tabs:['editor','runner'],active:'editor',weight:1.4},{id:'c',tabs:['viewer'],active:'viewer',weight:2.4},{id:'d',tabs:['tree','inspector'],active:'tree',weight:1}]});
async function openWorkspace(p){const f=await files.text(p);await open(JSON.parse(f.text),{path:p,revision:f.revision});}
async function openFolder(){
 if(dirty()&&!confirm('Discard unsaved source edits and switch project folder?'))return;
 if(!window.showDirectoryPicker)throw Error('Use desktop Chrome or Edge over HTTPS to open project folders.');
 busy=true;markButtons();
 try{const handle=await window.showDirectoryPicker({mode:'readwrite',id:'cad-studio-project'});if(handle.queryPermission&&await handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Read/write permission was not granted. Open the folder again and allow editing.');
 disposeAll();files?.dispose();files=new Files(handle);projectLabel.textContent=handle.name;document.title='CAD Studio — '+handle.name;
 const initial=new URLSearchParams(location.search).get('workspace');if(initial){try{await openWorkspace(initial);return;}catch(e){notify(e.message,true);}}
 const candidates=(await files.list()).filter(f=>!f.directory&&f.name.endsWith('.workspace.json'));
 if(candidates.length===1){try{await openWorkspace(candidates[0].path);return;}catch(e){notify(e.message,true);}}
 await open(defaultDoc());notify('Project: '+handle.name+(candidates.length?' — use Open workspace to restore a saved layout':''));
 }finally{busy=false;markButtons();}
}
async function save(){if(!current)return;const s=current;const p=choose('Workspace JSON file',s.binding?.path||s.ws.name+'.workspace.json');if(!p)return;
 const expected=s.binding?.path===p?s.binding.revision:null;const result=await files.writeText(p,JSON.stringify(s.host.snapshot(),null,2)+'\n',expected);s.binding={path:p,revision:result.revision};notify('Saved '+p);}
async function close(){if(!current)return;const s=current;if([...s.host.panels.values()].some(p=>p.settings.dirty)&&!confirm('Discard unsaved editor changes?'))return;s.host.dispose();s.ws.dispose();s.container.remove();sessions.delete(s.id);[...switcher.options].find(x=>x.value===s.id)?.remove();current=null;if(sessions.size)activate(sessions.keys().next().value);}
async function installExamples(){if(!files)return;if(!confirm('Copy example files into '+files.root.name+'? Existing files will not be overwritten.'))return;busy=true;markButtons();try{
 const url=new URL('./examples/list.json',document.baseURI),r=await fetch(url);if(!r.ok)throw Error('Examples unavailable');const names=await r.json();let added=0,skipped=0;
 for(const name of names){if(await files.existing(name)){skipped++;continue;}const response=await fetch(new URL(name,url));if(!response.ok)throw Error('Unable to load '+name);try{await files.import(name,new Uint8Array(await response.arrayBuffer()));added++;}catch(e){if(e.status===409)skipped++;else throw e;}}
 if(added||skipped){await openWorkspace('parametric.workspace.json');notify('Examples: '+added+' copied, '+skipped+' existing files preserved');}
 }finally{busy=false;markButtons();}}
const folderButton=button('Open Folder',()=>guard(openFolder));
function cmd(label,fn){const b=button(label,()=>guard(fn));projectButtons.push(b);return b;}
head.append(el('strong',{text:'CAD STUDIO / 0.3.1'}),folderButton,projectLabel,switcher,cmd('New workspace',async()=>{const name=choose('Workspace name','Untitled');if(!name)return;const preset=choose('Packages: all, text, or blank','all');if(preset===null)return;if(!['all','text','blank'].includes(preset))throw Error('Choose all, text or blank');await open({name,enabledPackages:preset==='all'?defaults:preset==='text'?defaults.slice(0,4):[],panels:[]});}),cmd('Open workspace',async()=>{const available=(await files.list()).filter(f=>f.name.endsWith('.workspace.json')).map(f=>f.name);const p=choose('Project-relative workspace path\n'+available.join('\n'),available[0]||'parametric.workspace.json');if(p)await openWorkspace(p);}),cmd('Save',save),cmd('+ Dock',()=>current?.host.split()),cmd('Close workspace',close),cmd('Copy examples',installExamples));
root.append(el('section',{class:'welcome'},el('h1',{text:'CAD Studio'}),el('p',{text:'Open a local folder to work with real files. Your project stays on your computer.'}),button('Open Folder',()=>guard(openFolder)),el('p',{class:'muted',text:'Desktop Chromium · read/write access · no backend'})));
markButtons();window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
if(import.meta.env.PROD&&'serviceWorker' in navigator)navigator.serviceWorker.register(new URL('./cad-sw.js',document.baseURI),{scope:'./'}).catch(e=>notify('Offline cache unavailable: '+e.message,true));

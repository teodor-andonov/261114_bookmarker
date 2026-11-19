const enc=new TextEncoder(),dec=new TextDecoder();
const failure=(message,status)=>Object.assign(Error(message),{status});
export function segments(p){if(typeof p!=='string'||p.includes('\\')||p.includes('\0')||p.startsWith('/')||p.split('/').some(x=>x==='.'||x==='..'||!x))throw failure('Invalid project-relative path',400);return p.split('/');}
const missing=e=>e.name==='NotFoundError'||e.status===404;
async function revision(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
export class Files {
 constructor(root){if(!root||root.kind!=='directory')throw Error('Open a project folder first');this.root=root;this.watches=new Map();this.drafts=new Map();this.external=new Map();this.mutation=Promise.resolve();this.closed=false;this.timer=setInterval(()=>this.poll(),1500);}
 async project(){return {name:this.root.name,external:[...this.external.keys()]};}
 async dir(parts){let h=this.root;for(const part of parts)h=await h.getDirectoryHandle(part);return h;}
 async parent(p){const parts=segments(p),name=parts.pop();return {dir:await this.dir(parts),name};}
 async handle(p){if(this.external.has(p))return this.external.get(p);try{const {dir,name}=await this.parent(p);return await dir.getFileHandle(name);}catch(e){if(missing(e))throw failure('Missing file: '+p,404);throw e;}}
 async list(p=''){const d=p?await this.dir(segments(p)):this.root,out=[];for await(const [name,handle] of d.entries()){if(name.startsWith('.'))continue;out.push({name,path:[p,name].filter(Boolean).join('/'),directory:handle.kind==='directory'});}return out.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));}
 async read(p){const file=await (await this.handle(p)).getFile(),bytes=new Uint8Array(await file.arrayBuffer());return {bytes,revision:await revision(bytes)};}
 async text(p){const r=await this.read(p);return {text:dec.decode(r.bytes),revision:r.revision};}
 async existing(p){try{return await this.read(p);}catch(e){if(missing(e))return null;throw e;}}
 serialize(fn){const result=this.mutation.then(()=>{if(this.closed)throw Error('Project closed');return fn();});this.mutation=result.catch(()=>{});return result;}
 async writeInternal(p,bytes,expected){if(this.external.has(p)||p.startsWith('external:'))throw failure('Read-only external reference',403);const {dir,name}=await this.parent(p),before=await this.existing(p);if((before?.revision??null)!==expected)throw failure('File changed externally; reload before saving',409);
  const h=await dir.getFileHandle(name,{create:true});const w=await h.createWritable();try{if(before){const latest=await this.read(p);if(latest.revision!==expected)throw failure('File changed during save',409);}await w.write(bytes);await w.close();}catch(e){try{await w.abort();}catch{}throw e;}
  const rev=await revision(bytes);this.signal(p,rev);return {revision:rev};}
 write(p,bytes,expected){return this.serialize(()=>this.writeInternal(p,bytes,expected));}
 writeText(p,text,expected){return this.write(p,enc.encode(text),expected);}
 import(p,bytes){return this.write(p,bytes,null);}
 async mkdir(p){return this.serialize(async()=>{const {dir,name}=await this.parent(p);for await(const [n] of dir.entries())if(n===name)throw failure('Destination exists',409);await dir.getDirectoryHandle(name,{create:true});});}
 async rename(p,to){return this.serialize(async()=>{if(this.external.has(p)||p.startsWith('external:'))throw failure('Read-only reference',403);if(p===to)return;if(this.isDirty(p))throw failure('Save or discard unsaved edits first',409);const from=await this.parent(p),target=await this.parent(to);for await(const [name] of target.dir.entries())if(name===target.name)throw failure('Destination exists',409);
  let h;try{h=await from.dir.getFileHandle(from.name);}catch(e){if(e.name==='TypeMismatchError')throw failure('Folder rename is not supported by Chromium for local folders; rename in your OS file manager and refresh',400);throw e;}
  const original=await this.read(p);await this.writeInternal(to,original.bytes,null);const latest=await this.read(p);if(latest.revision!==original.revision)throw failure('Source changed; copy retained, original not removed',409);await from.dir.removeEntry(from.name);this.signal(p,'missing');});}
 async authorizeExternal(){if(!window.showOpenFilePicker)throw Error('File picker unavailable');const [h]=await window.showOpenFilePicker({multiple:false});if(!h)return;let key='external:'+h.name;for(let n=2;this.external.has(key);n++)key='external:'+n+'-'+h.name;this.external.set(key,h);return key;}
 isDirty(p,except){return [...(this.drafts.get(p)||[])].some(x=>x!==except);}
 draft(p,id,dirty){if(!p)return;if(!this.drafts.has(p))this.drafts.set(p,new Set());const s=this.drafts.get(p);dirty?s.add(id):s.delete(id);if(!s.size)this.drafts.delete(p);}
 watch(p,rev,fn){const r={revision:rev,fn};if(!this.watches.has(p))this.watches.set(p,new Set());const s=this.watches.get(p);s.add(r);return()=>{s.delete(r);if(!s.size)this.watches.delete(p);};}
 signal(p,rev){if(this.closed)return;for(const w of [...(this.watches.get(p)||[])])if(w.revision!==rev){w.revision=rev;try{Promise.resolve(w.fn(rev)).catch(console.error);}catch(e){console.error(e);}}}
 async poll(){if(this.closed||this.polling)return;this.polling=true;try{for(const p of this.watches.keys()){let rev;try{rev=(await this.read(p)).revision;}catch(e){rev=missing(e)?'missing':'unavailable';}this.signal(p,rev);}}finally{this.polling=false;}}
 dispose(){this.closed=true;clearInterval(this.timer);this.watches.clear();this.drafts.clear();this.external.clear();}
}
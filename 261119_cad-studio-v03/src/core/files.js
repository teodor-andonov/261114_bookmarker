const enc=new TextEncoder(),dec=new TextDecoder();
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
export class Files {
 constructor(){this.capability=new URLSearchParams(location.hash.slice(1)).get('token')||prompt('Paste local server token from terminal')||'';this.watches=new Map();this.drafts=new Map();this.timer=setInterval(()=>this.poll(),1500);}
 async request(op,path='',data){const r=await fetch('/api/'+op+'?path='+encodeURIComponent(path),{method:data===undefined?'GET':'POST',headers:{'X-CAD-Client':this.capability,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});if(!r.ok)throw Object.assign(Error((await r.json()).error),{status:r.status});return r;}
 async json(op,path,data){return (await this.request(op,path,data)).json();}
 project(){return this.json('project');} list(p=''){return this.json('list',p);}
 async read(p){const r=await this.request('read',p);return {bytes:new Uint8Array(await r.arrayBuffer()),revision:r.headers.get('X-Revision')};}
 async text(p){const {bytes,revision}=await this.read(p);return {text:dec.decode(bytes),revision};}
 async write(p,bytes,expected){const r=await this.json('write','',{path:p,base64:base64(bytes),expected});this.signal(p,r.revision);return r;}
 writeText(p,text,expected){return this.write(p,enc.encode(text),expected);}
 mkdir(p){return this.json('mkdir','',{path:p});} rename(p,to){return this.json('rename','',{path:p,to});}
 import(p,bytes){return this.json('import','',{path:p,base64:base64(bytes)});}
 isDirty(p,except){return [...(this.drafts.get(p)||[])].some(x=>x!==except);}
 draft(p,id,dirty){if(!p)return;if(!this.drafts.has(p))this.drafts.set(p,new Set());const s=this.drafts.get(p);dirty?s.add(id):s.delete(id);}
 watch(p,revision,fn){const r={revision,fn};if(!this.watches.has(p))this.watches.set(p,new Set());const s=this.watches.get(p);s.add(r);return()=>{s.delete(r);if(!s.size)this.watches.delete(p);};}
 signal(p,revision){for(const w of this.watches.get(p)||[])if(w.revision!==revision){w.revision=revision;try{w.fn(revision);}catch(e){console.error(e);}}}
 async poll(){if(this.polling)return;this.polling=true;try{for(const p of this.watches.keys()){let revision;try{revision=(await this.json('revision',p)).revision;}catch(e){revision='missing';}this.signal(p,revision);}}finally{this.polling=false;}}
 dispose(){clearInterval(this.timer);}
}
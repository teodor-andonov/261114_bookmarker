import {createServer} from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=await fs.realpath(path.resolve(process.argv[2]||path.join(here,'demo')));
const allowed=new Map();
for(const arg of process.argv.slice(3)){
 const actual=await fs.realpath(path.resolve(arg));
 if(!(await fs.stat(actual)).isFile())throw Error('External reference must be a file');
 allowed.set('external:'+actual,actual);
}
const dist=path.join(here,'dist'), port=4179, capability=randomUUID()+randomUUID();
const hash=b=>createHash('sha256').update(b).digest('hex');
const err=(message,status=400)=>Object.assign(new Error(message),{status});
function lexical(rel){
 if(typeof rel!=='string'||path.isAbsolute(rel)||rel.includes('\\')||rel.includes('\0')||rel.split('/').includes('..'))throw err('Unsafe project path');
 const p=path.resolve(root,rel);
 if(p!==root&&!p.startsWith(root+path.sep))throw err('Outside project');
 return p;
}
async function safe(rel, create=false){
 const p=lexical(rel), current=path.relative(root,p).split(path.sep).filter(Boolean);
 let q=root;
 for(let i=0;i<current.length;i++){
  q=path.join(q,current[i]);
  try{if((await fs.lstat(q)).isSymbolicLink())throw err('Symlinks not permitted',403);}
  catch(e){if(e.code==='ENOENT'&&create&&i===current.length-1)return p;throw e;}
 }
 return p;
}
async function read(rel){const p=allowed.get(rel)||await safe(rel);return fs.readFile(p);}
async function list(rel=''){
 const p=await safe(rel), out=[];
 for(const entry of await fs.readdir(p,{withFileTypes:true})){
  if(entry.isSymbolicLink()||entry.name.startsWith('.'))continue;
  out.push({name:entry.name,path:[rel,entry.name].filter(Boolean).join('/'),directory:entry.isDirectory()});
 }
 return out.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name));
}
async function body(req){
 let parts=[],size=0;
 for await(const chunk of req){size+=chunk.length;if(size>100*1024*1024)throw err('Request too large',413);parts.push(chunk);}
 return JSON.parse(Buffer.concat(parts).toString());
}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
let mutation=Promise.resolve();
function exclusive(fn){const next=mutation.then(fn);mutation=next.catch(()=>{});return next;}
async function write(rel,bytes,expected){
 if(!rel)throw err('File path required');
 const p=await safe(rel,true);
 let before=null;try{before=hash(await fs.readFile(p));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(expected!==before)throw err('File changed externally; reload before saving',409);
 const temp=path.join(path.dirname(p),'.cad-'+randomUUID());
 try{
  await fs.writeFile(temp,bytes,{flag:'wx'});
  let latest=null;try{latest=hash(await fs.readFile(p));}catch(e){if(e.code!=='ENOENT')throw e;}
  if(latest!==before)throw err('File changed during save',409);
  await fs.rename(temp,p);
 }finally{await fs.rm(temp,{force:true});}
 return {revision:hash(bytes)};
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.json':'application/json','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://127.0.0.1:'+port), rel=url.searchParams.get('path')??'';
 if(url.pathname.startsWith('/api/')){
  if(req.headers['x-cad-client']!==capability||(req.headers.origin&&!/^http:\/\/(127\.0\.0\.1|localhost):(?:4179|5173)$/.test(req.headers.origin)))throw err('Local studio requests only',403);
  const op=url.pathname.slice(5);
  if(req.method==='GET'){
   if(op==='project')return json(res,{name:path.basename(root),external:[...allowed.keys()]});
   if(op==='list')return json(res,await list(rel));
   if(op==='read'){const b=await read(rel);res.writeHead(200,{'Content-Type':'application/octet-stream','X-Revision':hash(b),'Cache-Control':'no-store'});return res.end(b);}
   if(op==='revision')return json(res,{revision:hash(await read(rel))});
  }
  if(req.method==='POST'){
   const a=await body(req);
   const value=await exclusive(async()=>{
    if(op==='write')return write(a.path,Buffer.from(a.base64,'base64'),a.expected);
    if(op==='mkdir'){if(!a.path)throw err('Folder path required');await fs.mkdir(await safe(a.path,true));return {};}
    if(op==='rename'){
     if(!a.path||!a.to)throw err('Paths required');
     const from=await safe(a.path),to=await safe(a.to,true);
     try{await fs.lstat(to);throw err('Destination exists',409);}catch(e){if(e.code!=='ENOENT')throw e;}
     await fs.rename(from,to);return {};
    }
    if(op==='import'){return write(a.path,Buffer.from(a.base64,'base64'),null);}
    throw err('Unknown operation',404);
   });
   return json(res,value);
  }
  throw err('Unknown route',404);
 }
 if(req.method!=='GET')throw err('Method not allowed',405);
 const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
 const p=path.resolve(dist,relative);
 if(!p.startsWith(dist+path.sep))throw err('Invalid asset');
 const data=await fs.readFile(p);
 res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream'});res.end(data);
 }catch(e){json(res,{error:e.message},e.status||(e.code==='ENOENT'?404:500));}
}).listen(port,'127.0.0.1',()=>console.log('CAD Studio: http://127.0.0.1:'+port+'/#token='+capability+' | project: '+root+' | dev: http://127.0.0.1:5173/#token='+capability));

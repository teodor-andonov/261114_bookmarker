import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,writeFile,readFile,symlink} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
test('real localhost file API: capability, revisions, import, traversal',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cad-studio-test-'));const child=spawn(process.execPath,['server.mjs',root],{stdio:['ignore','pipe','pipe']});
 try{
 let token;await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),6000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code));});child.stdout.on('data',b=>{const m=String(b).match(/#token=([a-f0-9-]+)/);if(m){token=m[1];clearTimeout(timer);resolve();}});});
 const request=(op,p='',body,authorized=true)=>fetch('http://127.0.0.1:4179/api/'+op+'?path='+encodeURIComponent(p),{method:body===undefined?'GET':'POST',headers:{...(authorized?{'X-CAD-Client':token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await request('project','',undefined,false)).status,403);
 assert.equal((await request('list','../')).status,400);
 const payload={path:'new.txt',base64:Buffer.from('one').toString('base64'),expected:null};let response=await request('write','',payload);assert.equal(response.status,200);const {revision}=await response.json();assert.equal(await readFile(path.join(root,'new.txt'),'utf8'),'one');
 await writeFile(path.join(root,'new.txt'),'external');assert.equal((await request('write','',{...payload,expected:revision})).status,409);
 assert.equal((await request('import','',{path:'copy.txt',base64:Buffer.from('copy').toString('base64')})).status,200);
 await symlink(os.tmpdir(),path.join(root,'escape'));assert.equal((await request('read','escape/not-a-file')).status,403);
 }finally{child.kill();await rm(root,{recursive:true,force:true});}
});

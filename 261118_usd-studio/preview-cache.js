// Exact byte comparison, not name, bounding box or approximate hash alone.
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function hash(bytes){let h=2166136261;for(const v of bytes)h=Math.imul(h^v,16777619);return h>>>0;}
export class PreviewCache{
 constructor(limit=64*1024*1024){this.limit=limit;this.bytes=0;this.entries=new Map();}
 get(bytes,quality){
  const key=quality+":"+bytes.length+":"+hash(bytes),entry=this.entries.get(key);
  if(!entry||!equal(bytes,entry.bytes))return null;
  this.entries.delete(key);this.entries.set(key,entry);return entry.mesh;
 }
 put(bytes,quality,mesh){
  const key=quality+":"+bytes.length+":"+hash(bytes);
  const size=bytes.byteLength+["positions","indices","corners","normals","lines"].reduce((n,k)=>n+(mesh[k]?.byteLength||0),0);
  if(size>this.limit)return;
  const old=this.entries.get(key);if(old){this.bytes-=old.size;this.entries.delete(key);}
  this.entries.set(key,{bytes,mesh,size});this.bytes+=size;
  while(this.bytes>this.limit){const k=this.entries.keys().next().value;this.bytes-=this.entries.get(k).size;this.entries.delete(k);}
 }
}

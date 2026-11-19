export class Registry {
 constructor(){this.packages=new Map();this.tools=new Map();this.types=new Map();this.channels=new Map();this.operations=new Map();this.handlers=new Map();}
 add(p){
  if(this.packages.has(p.id))throw Error('Duplicate package '+p.id);
  for(const id of p.requires||[])if(!this.packages.has(id))throw Error('Missing dependency '+id+' for '+p.id);
  for(const k of ['tools','types','channels','operations','handlers'])for(const d of p[k]||[])if(this[k].has(d.id))throw Error('Duplicate '+k+' '+d.id);
  this.packages.set(p.id,p);
  for(const k of ['tools','types','channels','operations','handlers'])for(const d of p[k]||[])this[k].set(d.id,d);
  return this;
 }
 invoke(id,workspace,...args){const op=this.operations.get(id);if(!op)throw Error('Unsupported operation '+id);return op.run(workspace,...args);}
}
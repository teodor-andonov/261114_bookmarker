export class Resources {
 constructor(){this.entries=new Map();this.listeners=new Map();}
 get(id){return this.entries.get(id);}
 publish(id,value){this.entries.set(id,value);this.notify(id,value);}
 remove(id){this.entries.delete(id);this.notify(id,undefined);}
 notify(id,v){for(const fn of [...(this.listeners.get(id)||[])])fn(v,id);}
 subscribe(id,fn){if(!this.listeners.has(id))this.listeners.set(id,new Set());const s=this.listeners.get(id);s.add(fn);fn(this.get(id),id);return()=>s.delete(fn);}
 clear(){this.entries.clear();this.listeners.clear();}
}
export class Context {
 constructor(channels){this.values=new Map([...channels].map(([id,c])=>[id,structuredClone(c.default)]));this.listeners=new Map();}
 get(id){if(!this.values.has(id))throw Error('Unknown channel '+id);return this.values.get(id);}
 set(id,value){const old=this.get(id);if(Object.is(old,value)||JSON.stringify(old)===JSON.stringify(value))return;this.values.set(id,value);for(const fn of [...(this.listeners.get(id)||[])])fn(value,old);}
 update(id,fn){this.set(id,fn(this.get(id)));}
 subscribe(id,fn){this.get(id);if(!this.listeners.has(id))this.listeners.set(id,new Set());const s=this.listeners.get(id);s.add(fn);fn(this.get(id));return ()=>s.delete(fn);}
 clear(){this.listeners.clear();}
}
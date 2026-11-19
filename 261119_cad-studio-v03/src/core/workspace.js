import {Context} from './context.js';import {Resources} from './resources.js';
export class Workspace {
 constructor(registry,files,doc={},notify=console.log){
  this.registry=registry;this.files=files;this.doc=doc;this.name=doc.name||'Untitled';this.context=new Context(registry.channels);this.resources=new Resources();this.state=new Map();this.cleanups=[];this.notify=notify;
 }
 invoke(id,...args){return this.registry.invoke(id,this,...args);}
 async restore(){for(const p of this.registry.packages.values())if(p.restore)try{await p.restore(this,this.doc.packageState?.[p.id]);}catch(e){this.notify(e.message,true);}}
 snapshot(panels,groups){const packageState={};for(const p of this.registry.packages.values())if(p.save)packageState[p.id]=p.save(this);return {version:1,name:this.name,enabledPackages:[...this.registry.packages.keys()],panels,groups,packageState};}
 dispose(){for(const fn of this.cleanups.splice(0))try{fn();}catch(e){console.error(e);}this.context.clear();this.resources.clear();}
}
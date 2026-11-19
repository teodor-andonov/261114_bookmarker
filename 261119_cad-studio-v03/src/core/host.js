import {el,button,action} from './dom.js';
export class Host {
 constructor(ws,root,doc={}){
  this.ws=ws;this.root=root;this.panels=new Map();this.groups=structuredClone(doc.groups||[]);this.focus=null;this.columns=new Map();
  if(!this.groups.length)this.groups=[{id:crypto.randomUUID(),tabs:[],active:null,weight:1}];
  for(const p of doc.panels||[])this.mount(p);
  for(const g of this.groups){g.tabs=g.tabs.filter(id=>this.panels.has(id));if(!g.tabs.includes(g.active))g.active=g.tabs[0]||null;}
  for(const id of this.panels.keys())if(!this.groups.some(g=>g.tabs.includes(id))){this.groups[0].tabs.push(id);this.groups[0].active=id;}
  this.render();
 }
 mount(p){const tool=this.ws.registry.tools.get(p.tool);const body=el('div',{class:'panelbody'});const instance={...p,settings:p.settings||{},body,dispose:()=>{}};
  this.panels.set(p.id,instance);
  if(!tool){body.append(el('p',{text:'Missing tool: '+p.tool}));return;}
  try{instance.dispose=tool.mount(this.ws,body,instance.settings,p.id)||(()=>{});}catch(e){body.textContent=e.message;this.ws.notify(e.message,true);}
 }
 add(tool,g=this.groups[0]){const id=crypto.randomUUID();this.mount({id,tool,settings:{}});g.tabs.push(id);g.active=id;this.render();}
 remove(id){const p=this.panels.get(id);if(!p)return;if(p.settings.dirty&&!confirm('Discard unsaved changes?'))return;p.dispose();p.body.remove();this.panels.delete(id);for(const g of this.groups){g.tabs=g.tabs.filter(t=>t!==id);if(g.active===id)g.active=g.tabs[0]||null;}this.render();}
 move(id,g){for(const x of this.groups){x.tabs=x.tabs.filter(t=>t!==id);if(x.active===id)x.active=x.tabs[0]||null;}g.tabs.push(id);g.active=id;this.render();}
 render(){
  const next=[];
  this.groups.forEach((g,i)=>{
   let c=this.columns.get(g.id);if(!c){const node=el('section',{class:'dock'}),tabs=el('div',{class:'tabs'}),content=el('div',{class:'dockcontent'});node.append(tabs,content);c={node,tabs,content};this.columns.set(g.id,c);}
   c.node.style.flex=String(g.weight||1)+' 1 0';c.node.hidden=!!this.focus&&this.focus!==g.id;
   c.tabs.replaceChildren();
   for(const id of g.tabs){const p=this.panels.get(id);if(!p)continue;const b=button(this.ws.registry.tools.get(p.tool)?.title||p.tool,()=>{g.active=id;this.render();});b.className=g.active===id?'active':'';b.draggable=true;b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',id));c.tabs.append(b);if(p.body.parentNode!==c.content)c.content.append(p.body);p.body.hidden=g.active!==id;}
   c.node.ondragover=e=>e.preventDefault();c.node.ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain');if(this.panels.has(id))this.move(id,g);};
   const menu=el('select',{title:'Add tool',onChange:e=>{if(e.target.value)this.add(e.target.value,g);e.target.value='';}},el('option',{value:'',text:'+ Tool'}),...[...this.ws.registry.tools.values()].map(t=>el('option',{value:t.id,text:t.title})));
   c.tabs.append(menu,button('□',()=>{this.focus=this.focus===g.id?null:g.id;this.render();}),button('×',()=>g.active&&this.remove(g.active)));
   next.push(c.node);
   if(i<this.groups.length-1){const handle=el('div',{class:'divider'});handle.hidden=!!this.focus;handle.onpointerdown=e=>{const a=g,b=this.groups[i+1],start=e.clientX,total=(a.weight||1)+(b.weight||1),width=c.node.clientWidth+this.columns.get(b.id).node.clientWidth,initial=c.node.clientWidth;handle.setPointerCapture(e.pointerId);handle.onpointermove=ev=>{const f=Math.max(.12,Math.min(.88,(initial+ev.clientX-start)/width));a.weight=total*f;b.weight=total*(1-f);c.node.style.flex=a.weight+' 1 0';this.columns.get(b.id).node.style.flex=b.weight+' 1 0';};handle.onpointerup=()=>{handle.onpointermove=null;};};next.push(handle);}
  });
  for(const n of [...this.root.children])if(!next.includes(n))n.remove();for(let i=0;i<next.length;i++)if(this.root.children[i]!==next[i])this.root.insertBefore(next[i],this.root.children[i]||null);
 }
 split(){this.groups.push({id:crypto.randomUUID(),tabs:[],active:null,weight:1});this.focus=null;this.render();}
 snapshot(){return this.ws.snapshot([...this.panels.values()].map(({id,tool,settings})=>({id,tool,settings:Object.fromEntries(Object.entries(settings).filter(([k])=>k!=='dirty'))})),this.groups);}
 dispose(){for(const p of this.panels.values())p.dispose();this.panels.clear();this.root.replaceChildren();}
}
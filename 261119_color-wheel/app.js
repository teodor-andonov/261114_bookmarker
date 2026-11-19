function wrap(h){return ((h%360)+360)%360;}

function rgb(h,s,l){
  const a=s*Math.min(l,1-l);
  const f=n=>{const k=(n+wrap(h)/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
  return [f(0),f(8),f(4)];
}

function interval(count,span){return count<2?0:span/(span===360?count:count-1);}

function sample(count,offset,s,l,span=360){
  return Array.from({length:count},(_,i)=>{
    const h=wrap(offset+i*interval(count,span)), angle=h*Math.PI/180;
    return {h,t:h/360,s,l,x:250+250*s*Math.sin(angle),y:250-250*s*Math.cos(angle),hex:"#"+rgb(h,s,l).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase()};
  });
}
const $=id=>document.getElementById(id);
const controls=[
  {key:"count",min:1,max:72},
  {key:"offset",min:0,max:360},
  {key:"sat",min:0,max:100},
  {key:"light",min:0,max:100},
  {key:"span",min:0,max:360}
];
const canvas=$("wheel"),ctx=canvas.getContext("2d"),overlay=$("overlay"),ns="http://www.w3.org/2000/svg";
let previousLight=null,currentRows=[],copySequence=0;
const val=k=>Number($(k).value);
const fixed=(n,d=2)=>Number(n.toFixed(d)).toString();
function formatColor(p,format){
  const c=rgb(p.h,p.s,p.l);
  const h=Number(p.h.toFixed(6))%360;
  const t=(Math.round(p.t*1e9)%1e9)/1e9;
  switch(format){
    case "rgb":return "rgb("+c.join(", ")+")";
    case "rgb255":return c.join(", ");
    case "rgb1":return c.map(x=>(x/255).toFixed(6)).join(", ");
    case "hsl":return "hsl("+fixed(h,6)+", "+fixed(p.s*100,3)+"%, "+fixed(p.l*100,3)+"%)";
    case "hsl360":return [fixed(h,6),fixed(p.s*100,3),fixed(p.l*100,3)].join(", ");
    case "hsl1":return [t.toFixed(9),p.s.toFixed(6),p.l.toFixed(6)].join(", ");
    case "hue360":return fixed(h,6);
    case "hue1":return t.toFixed(9);
    default:return p.hex;
  }
}
async function copyText(text,label){
  const seq=++copySequence;
  let ok=false;
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);ok=true;}
  }catch{}
  if(!ok){
    const el=document.createElement("textarea");
    el.value=text;el.setAttribute("readonly","");el.style.position="fixed";el.style.opacity="0";document.body.append(el);
    const focus=document.activeElement;el.select();el.setSelectionRange(0,el.value.length);
    try{ok=document.execCommand("copy");}catch{}
    el.remove();focus?.focus();
  }
  if(seq==copySequence)$("copy-status").textContent=ok?"Copied "+label:"Clipboard unavailable. Select and copy the displayed value manually.";
}
function copySample(p,i){const value=formatColor(p,$("format").value);copyText(value,"sample "+(i+1)+": "+value);}
function set(k,n){
  const c=controls.find(c=>c.key===k);
  n=Math.max(c.min,Math.min(c.max,n));
  $(k).value=n;
  $(k+"Number").value=$(k).value;
}
function circle(x,y,r,attrs){
  const el=document.createElementNS(ns,"circle");
  for(const [k,v] of Object.entries({cx:x,cy:y,r,...attrs}))el.setAttribute(k,v);
  overlay.append(el);return el;
}
function drawWheel(l){
  if(previousLight===l)return;
  previousLight=l;
  const size=canvas.width,center=size/2,im=ctx.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5-center)/center,dy=(y+.5-center)/center,s=Math.hypot(dx,dy);
    if(s>1)continue;
    const h=wrap(Math.atan2(dx,-dy)*180/Math.PI);
    const [r,g,b]=rgb(h,s,l),i=(y*size+x)*4;
    im.data[i]=r;im.data[i+1]=g;im.data[i+2]=b;im.data[i+3]=255;
  }
  ctx.putImageData(im,0,0);
}
function render(){
  const n=val("count"),off=val("offset"),s=val("sat")/100,l=val("light")/100;
  const span=val("span"),rows=sample(n,off,s,l,span);currentRows=rows;
  drawWheel(l);
  const step=interval(n,span);$("step").textContent=fixed(step)+"° / "+(step/360).toFixed(6);
  overlay.replaceChildren();
  if(s>0){
    circle(250,250,250*s,{fill:"none",stroke:"#fff","stroke-width":1,"stroke-opacity":.7,"stroke-dasharray":"3 5"});
    circle(250,250,250*s,{fill:"none",stroke:"#111","stroke-width":1,"stroke-opacity":.6,"stroke-dasharray":"3 5","stroke-dashoffset":4});
  }
  rows.forEach((p,i)=>{
    const line=document.createElementNS(ns,"line");
    for(const [k,v] of Object.entries({x1:250,y1:250,x2:p.x,y2:p.y,stroke:"#222","stroke-opacity":.38,"stroke-width":1}))line.setAttribute(k,v);
    overlay.append(line);
  });
  rows.forEach((p,i)=>{if(s===0&&i>0)return;
    const marker=circle(p.x,p.y,n>24?5:8,{fill:p.hex,stroke:"#fff","stroke-width":2});
    marker.setAttribute("class","marker");
    const t=document.createElementNS(ns,"title");t.textContent="Sample "+(i+1)+" · "+fixed(p.h)+"°";marker.append(t);
    circle(p.x,p.y,n>24?6.5:9.5,{fill:"none",stroke:"#222","stroke-width":1});
    if(n<=24 && (s>0.14||i===0)){
      const label=document.createElementNS(ns,"text"),a=p.h*Math.PI/180;
      const radius=Math.max(18,250*s+20);
      label.setAttribute("x",250+radius*Math.sin(a));label.setAttribute("y",250-radius*Math.cos(a));
      label.setAttribute("class","wheel-label");label.textContent=String(i+1);overlay.append(label);
    }
  });
  renderSamples();
}
function renderSamples(){
  const rows=currentRows,format=$("format").value;
  $("value-heading").textContent=$("format").selectedOptions[0].textContent;
  $("palette").replaceChildren(...rows.map((p,i)=>{
    const chip=document.createElement("button");chip.type="button";
    chip.className="chip";chip.style.background=p.hex;chip.title="Copy sample "+(i+1)+" · "+formatColor(p,format);chip.setAttribute("aria-label",chip.title);chip.addEventListener("click",()=>copySample(p,i));
    return chip;
  }));
  $("samples").replaceChildren(...rows.map((p,i)=>{
    const tr=document.createElement("tr");
    const sw=document.createElement("button");sw.type="button";sw.className="swatch";sw.style.background=p.hex;sw.title="Copy sample "+(i+1);sw.setAttribute("aria-label",sw.title);sw.addEventListener("click",()=>copySample(p,i));
    const first=document.createElement("td");first.append(sw);tr.append(first);
    const cells=[i+1,fixed(p.h,4)+"°",p.t.toFixed(6),fixed(p.s*100)+"%",fixed(p.l*100)+"%"];
    for(const v of cells){const td=document.createElement("td");td.textContent=v;tr.append(td);}
    const value=document.createElement("button");value.type="button";value.className="copy-value";value.textContent=formatColor(p,format);value.title="Copy "+value.textContent;value.addEventListener("click",()=>copySample(p,i));const td=document.createElement("td");td.append(value);tr.append(td);
    return tr;
  }));
}
$("format").addEventListener("change",renderSamples);
$("copy-all").addEventListener("click",()=>copyText(currentRows.map(p=>formatColor(p,$("format").value)).join("\n"),currentRows.length+" colors"));
for(const c of controls){
  const range=$(c.key),number=$(c.key+"Number");
  range.addEventListener("input",()=>{number.value=range.value;render();});
  number.addEventListener("input",()=>{if(number.value!==""&&number.validity.valid){range.value=number.value;render();}});
  number.addEventListener("change",()=>{set(c.key,number.value===""?val(c.key):Number(number.value));render();});
}
const surface=$("surface");
function pick(e){
  const b=surface.getBoundingClientRect(),dx=(e.clientX-b.left-b.width/2)/(b.width/2),dy=(e.clientY-b.top-b.height/2)/(b.height/2);
  const radius=Math.min(1,Math.hypot(dx,dy));
  if(radius>.001)set("offset",Math.round(wrap(Math.atan2(dx,-dy)*180/Math.PI)*10)/10);
  set("sat",Math.round(radius*1000)/10);
  render();
}
surface.addEventListener("pointerdown",e=>{if(e.button!==0)return;surface.setPointerCapture(e.pointerId);pick(e);});
surface.addEventListener("pointermove",e=>{if(surface.hasPointerCapture(e.pointerId))pick(e);});
render();

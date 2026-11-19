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

const SCHEME_TYPE="testlab.color-wheel";
const SCHEME_VERSION=1;
const STORAGE_KEY="testlab:261119_color-wheel:remembered-scheme";
const FORMATS=["hex","rgb","rgb255","rgb1","hsl","hsl360","hsl1","hue360","hue1"];
const DEFAULTS={count:6,offset:0,sat:80,light:50,span:360,format:"hex"};
const LIMITS={count:[1,72],offset:[0,360],sat:[0,100],light:[0,100],span:[0,360]};
const SVG_NS="http://www.w3.org/2000/svg";
function validateScheme(doc){
  if(!doc||typeof doc!=="object"||doc.type!==SCHEME_TYPE)throw Error("Not a Color Wheel scheme.");
  if(doc.version!==SCHEME_VERSION)throw Error("Unsupported scheme version: "+String(doc.version).slice(0,30));
  const src=doc.settings;
  if(!src||typeof src!=="object"||Array.isArray(src))throw Error("Missing scheme settings.");
  const settings={};
  for(const [key,[min,max]] of Object.entries(LIMITS)){
    const v=src[key],mult=key==="count"?1:10;
    if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max||Math.abs(v*mult-Math.round(v*mult))>1e-8)throw Error("Invalid "+key+" setting.");
    settings[key]=Math.round(v*mult)/mult;
  }
  if(!FORMATS.includes(src.format))throw Error("Unknown color format.");
  settings.format=src.format;
  return {type:SCHEME_TYPE,version:SCHEME_VERSION,settings};
}
function schemeJSON(settings){return JSON.stringify(validateScheme({type:SCHEME_TYPE,version:SCHEME_VERSION,settings}),null,2)+"\n";}
function escapeXML(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");}
function schemeSVG(settings){
  const data=validateScheme({type:SCHEME_TYPE,version:SCHEME_VERSION,settings}),p=data.settings;
  const rows=sample(p.count,p.offset,p.sat/100,p.light/100,p.span);
  const columns=Math.min(6,rows.length),cellW=128,cellH=106,pad=24,top=86;
  const width=Math.max(400,columns*cellW+2*pad),height=top+Math.ceil(rows.length/columns)*cellH+pad;
  const txt=(x,y,value,size=12,color="#475569",weight=400)=>'<text x="'+x+'" y="'+y+'" font-family="system-ui, sans-serif" font-size="'+size+'" font-weight="'+weight+'" fill="'+color+'">'+escapeXML(value)+'</text>';
  const rect=(x,y,w,h,fill,rx=0)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+rx+'" fill="'+fill+'"/>';
  const items=rows.map((row,i)=>{
    const x=pad+(i%columns)*cellW,y=top+Math.floor(i/columns)*cellH;
    return '<g id="sample-'+(i+1)+'">'+rect(x,y,cellW-10,68,row.hex,3)+txt(x,y+83,row.hex,12,"#17202a",600)+txt(x,y+98,"H "+hueFixed(row.h,360)+"°",11)+'</g>';
  }).join("\n");
  const description=p.count+" colors · offset "+p.offset+"° · span "+p.span+"° · S "+p.sat+"% · L "+p.light+"%";
  return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="'+SVG_NS+'" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">\n<title>Color Wheel scheme</title>\n<desc>'+escapeXML(description)+'</desc>\n<metadata id="testlab-color-wheel-scheme">'+escapeXML(JSON.stringify(data))+'</metadata>\n'+rect(0,0,width,height,"#ffffff")+txt(pad,32,"COLOR WHEEL",17,"#17202a",650)+txt(pad,57,description,11)+items+'\n</svg>\n';
}
function parseSchemeText(text){
  const trimmed=text.replace(/^\uFEFF/,"").trim();
  if(trimmed.startsWith("{"))return validateScheme(JSON.parse(trimmed));
  if(trimmed.startsWith("<")){
    // Never attach or render imported SVG. Only extract JSON from its metadata.
    if(/<!DOCTYPE|<!ENTITY/i.test(trimmed))throw Error("SVG declarations are not supported.");
    const xml=new DOMParser().parseFromString(trimmed,"image/svg+xml");
    if(xml.getElementsByTagName("parsererror").length||xml.documentElement.localName!=="svg"||xml.documentElement.namespaceURI!==SVG_NS)throw Error("Invalid SVG scheme.");
    const all=Array.from(xml.getElementsByTagNameNS(SVG_NS,"metadata")).filter(el=>el.getAttribute("id")==="testlab-color-wheel-scheme");
    if(all.length!==1)throw Error("SVG has no unique Color Wheel scheme metadata.");
    return validateScheme(JSON.parse(all[0].textContent));
  }
  throw Error("Choose a Color Wheel SVG or JSON file.");
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
const fixed=n=>Number(n.toFixed(3)).toString();
// Hue is cyclic: keep rounded values inside [0, 360) or [0, 1).
const hueFixed=(n,period)=>String(Number(fixed(n))%period);
function formatColor(p,format){
  const c=rgb(p.h,p.s,p.l);
  const h=hueFixed(p.h,360),t=hueFixed(p.t,1);
  switch(format){
    case "rgb":return "rgb("+c.join(", ")+")";
    case "rgb255":return c.join(", ");
    case "rgb1":return c.map(x=>fixed(x/255)).join(", ");
    case "hsl":return "hsl("+h+", "+fixed(p.s*100)+"%, "+fixed(p.l*100)+"%)";
    case "hsl360":return [h,fixed(p.s*100),fixed(p.l*100)].join(", ");
    case "hsl1":return [t,fixed(p.s),fixed(p.l)].join(", ");
    case "hue360":return h;
    case "hue1":return t;
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

let remember=false;
function readSettings(){
  return {...Object.fromEntries(controls.map(c=>[c.key,val(c.key)])),format:$("format").value};
}
function schemeStatus(message,isError=false){
  $("scheme-status").textContent=message;
  $("scheme-status").dataset.error=String(isError);
}
function persist(){
  if(!remember)return;
  try{
    const value=schemeJSON(readSettings());
    localStorage.setItem(STORAGE_KEY,value);
  }catch{
    remember=false;$("remember").checked=false;
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    schemeStatus("Could not save settings in this browser.",true);
  }
}
function applyScheme(doc){
  const checked=validateScheme(doc);
  for(const c of controls)set(c.key,checked.settings[c.key]);
  $("format").value=checked.settings.format;
  render();
}
function restoreRemembered(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(raw!==null){
      const doc=validateScheme(JSON.parse(raw));
      remember=true;$("remember").checked=true;
      applyScheme(doc);
      if(remember)schemeStatus("Restored remembered scheme.");
      return true;
    }
  }catch{
    remember=false;$("remember").checked=false;
    schemeStatus("Saved browser settings could not be restored.",true);
  }
  return false;
}
$("remember").addEventListener("change",()=>{
  remember=$("remember").checked;
  if(remember){
    persist();
    if(remember)schemeStatus("Settings will be remembered in this browser.");
  }else{
    try{localStorage.removeItem(STORAGE_KEY);schemeStatus("Browser memory cleared.");}
    catch{schemeStatus("Browser storage could not be cleared.",true);}
  }
});
function saveScheme(format){
  try{
    const settings=readSettings(),isSVG=format==="svg";
    const blob=new Blob([isSVG?schemeSVG(settings):schemeJSON(settings)],{type:isSVG?"image/svg+xml;charset=utf-8":"application/json;charset=utf-8"});
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download="color-wheel-"+settings.count+"-colors."+format;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    schemeStatus("Exported "+format.toUpperCase()+" scheme.");
  }catch(e){schemeStatus("Export failed: "+e.message,true);}
}
$("save-svg").addEventListener("click",()=>saveScheme("svg"));
$("save-json").addEventListener("click",()=>saveScheme("json"));
$("open-scheme").addEventListener("click",()=>$("scheme-file").click());
let loadSequence=0;
async function loadSchemeFile(file){
  const seq=++loadSequence;
  if(!file)return;
  try{
    if(file.size>2*1024*1024)throw Error("Scheme exceeds the 2 MB size limit.");
    const text=await file.text();
    if(seq!==loadSequence)return;
    const doc=parseSchemeText(text);
    applyScheme(doc);
    schemeStatus("Loaded "+file.name+".");
  }catch(e){
    if(seq===loadSequence)schemeStatus("Could not load scheme: "+e.message,true);
  }
}
$("scheme-file").addEventListener("change",e=>{
  const file=e.target.files[0];
  e.target.value="";
  if(file)loadSchemeFile(file);
});

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
  const step=interval(n,span);$("step").textContent=fixed(step)+"° / "+fixed(step/360);
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
    const t=document.createElementNS(ns,"title");t.textContent="Sample "+(i+1)+" · "+hueFixed(p.h,360)+"°";marker.append(t);
    circle(p.x,p.y,n>24?6.5:9.5,{fill:"none",stroke:"#222","stroke-width":1});
    if(n<=24 && (s>0.14||i===0)){
      const label=document.createElementNS(ns,"text"),a=p.h*Math.PI/180;
      const radius=Math.max(18,250*s+20);
      label.setAttribute("x",250+radius*Math.sin(a));label.setAttribute("y",250-radius*Math.cos(a));
      label.setAttribute("class","wheel-label");label.textContent=String(i+1);overlay.append(label);
    }
  });
  renderSamples();
  persist();
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
    const cells=[i+1,hueFixed(p.h,360)+"°",hueFixed(p.t,1),fixed(p.s*100)+"%",fixed(p.l*100)+"%"];
    for(const v of cells){const td=document.createElement("td");td.textContent=v;tr.append(td);}
    const value=document.createElement("button");value.type="button";value.className="copy-value";value.textContent=formatColor(p,format);value.title="Copy "+value.textContent;value.addEventListener("click",()=>copySample(p,i));const td=document.createElement("td");td.append(value);tr.append(td);
    return tr;
  }));
}
$("format").addEventListener("change",()=>{renderSamples();persist();});
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
if(!restoreRemembered())render();

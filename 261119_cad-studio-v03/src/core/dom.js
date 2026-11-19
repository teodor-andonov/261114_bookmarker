export function el(tag,props={},...children){const n=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k.startsWith('on'))n.addEventListener(k.slice(2).toLowerCase(),v);else if(v!==undefined)n[k]=v;}for(const c of children.flat())if(c!==undefined&&c!==null)n.append(c);return n;}
export function button(text,fn){return el('button',{text,onClick:fn});}
export function action(ws,fn){return async(...args)=>{try{await fn(...args);}catch(e){ws.notify(e.message,true);}};}
export function choose(text,initial=''){const value=prompt(text,initial);return value===null?null:value.trim();}
export function download(filename,blob){const url=URL.createObjectURL(blob),a=el('a',{href:url,download:filename});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

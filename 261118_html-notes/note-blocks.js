// Canonical blocks are inert templates; editor chrome and live frames are never saved.
export function copyNoteBlock(template,doc=document){
 const t=doc.createElement('template');
 t.setAttribute('data-note-block','1');
 t.setAttribute('data-title',(template.getAttribute('data-title')||'Custom block').slice(0,100));
 const height=Number(template.getAttribute('data-height'))||240;
 t.setAttribute('data-height',String(Math.max(100,Math.min(1200,Math.round(height)))));
 t.innerHTML=template.innerHTML;
 return t;
}
export function makeNoteBlock(code,title='Custom block',height=240,doc=document){
 const t=doc.createElement('template');t.setAttribute('data-title',title);t.setAttribute('data-height',String(height));t.innerHTML=code;
 return copyNoteBlock(t,doc);
}
// This function is also serialized into standalone saved notes. Keep it self-contained.
export function mountNoteBlocks(root,options={}){
 const doc=root.ownerDocument;
 const editable=Boolean(options.edit);
 const blockSelector='template[data-note-block="1"]';
 const dom=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 function frameContent(template,active){
  // Work in an inert fragment. These removals apply only to the rendered copy.
  const inert=dom('template');inert.innerHTML=template.innerHTML;
  const clean=fragment=>{
   for(const e of [...fragment.querySelectorAll('base,meta,link,iframe,frame,object,embed,portal,script[src]')])e.remove();
   if(!active)for(const e of [...fragment.querySelectorAll('script')])e.remove();
   for(const e of fragment.querySelectorAll('*')){
    if(e.localName==='template'&&e.content)clean(e.content);
    for(const a of [...e.attributes]){
     const key=a.name.toLowerCase();
     if(key==='ping'||key==='action'||key==='formaction'||key==='target'||key==='srcdoc'||(!active&&key.startsWith('on')))e.removeAttribute(a.name);
     if((key==='href'||key==='xlink:href')&&['a','area'].includes(e.localName)&&!a.value.startsWith('#'))e.removeAttribute(a.name);
    }
   }
  };
  clean(inert.content);
  const policy="default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src "+(active?"'unsafe-inline'":"'none'")+"; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+policy+'"><style>html{color-scheme:light dark}body{margin:12px;font:14px/1.5 system-ui,sans-serif;overflow-wrap:anywhere}svg,img,canvas{max-width:100%}</style></head><body>'+inert.innerHTML+'</body></html>';
 }
 function button(label,symbol,fn){
  const b=dom('button');b.type='button';b.className='note-block-btn';b.title=label;b.setAttribute('aria-label',label);b.textContent=symbol;
  b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',fn);return b;
 }
 for(const template of [...root.querySelectorAll(blockSelector)]){
  if(template.parentElement?.classList.contains('note-block-view'))continue;
  const wrapper=dom('div');wrapper.className='note-block-view';wrapper.contentEditable='false';
  const bar=dom('div');bar.className='note-block-bar';const title=dom('span',template.getAttribute('data-title')||'Custom block');title.className='note-block-title';
  const state=dom('span','Static');state.className='note-block-state';bar.append(title,state);
  let frame=null,active=false,run;
  function render(on){
   active=on;if(frame)frame.remove();
   frame=dom('iframe');frame.className='note-block-frame';frame.title=title.textContent+' preview';
   // Never grant same-origin access, popups, downloads, top navigation or forms.
   frame.setAttribute('sandbox',on?'allow-scripts':'');frame.referrerPolicy='no-referrer';
   frame.setAttribute('allow',"camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; usb 'none'; clipboard-read 'none'; clipboard-write 'none'");
   frame.style.height=Math.max(100,Math.min(1200,Number(template.getAttribute('data-height'))||240))+'px';
   frame.srcdoc=frameContent(template,on);wrapper.append(frame);
   run.textContent=on?'■':'▷';run.title=on?'Stop scripts':'Run scripts (trusted blocks only)';run.setAttribute('aria-label',run.title);state.textContent=on?'Running':'Static';
  }
  run=button('Run scripts (trusted blocks only)','▷',()=>{if(active){render(false);return}if(doc.defaultView.confirm('Run this block’s JavaScript? Only run code you trust. It is isolated from the editor, but may still navigate its own frame or consume resources.'))render(true)});
  bar.append(run);
  if(editable){
   bar.append(button('Edit block source','</>',()=>options.edit(template,wrapper)));
   bar.append(button('Remove block','×',()=>options.remove?.(wrapper)));
  }
  template.replaceWith(wrapper);wrapper.append(template,bar);render(false);
 }
}
export const examples={
 counter:{title:'Interactive counter',height:160,code:'<style>button { padding: 8px 14px; border-radius: 6px; border: 1px solid #8886; cursor: pointer; } strong { margin: 0 14px; font-size: 24px; }</style>\n<h3>Interactive counter</h3>\n<button id="minus">−</button><strong id="count">0</strong><button id="plus">+</button>\n<script>\n  let count = 0;\n  const draw = () => document.getElementById("count").textContent = count;\n  document.getElementById("minus").onclick = () => { count--; draw(); };\n  document.getElementById("plus").onclick = () => { count++; draw(); };\n</script>'},
 diagram:{title:'SVG diagram',height:200,code:'<svg viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Input, process, output">\n  <g fill="#8b72cf22" stroke="#8b72cf" stroke-width="1.5">\n    <rect x="12" y="52" width="120" height="56" rx="8"/><rect x="180" y="52" width="120" height="56" rx="8"/><rect x="348" y="52" width="120" height="56" rx="8"/>\n    <path d="M132 80H180m-8-5 8 5-8 5M300 80H348m-8-5 8 5-8 5" fill="none"/>\n  </g>\n  <g fill="currentColor" font-size="14" text-anchor="middle"><text x="72" y="85">Input</text><text x="240" y="85">Process</text><text x="408" y="85">Output</text></g>\n</svg>'},
 blank:{title:'Custom block',height:180,code:'<div>\n  <h3>Custom HTML</h3>\n  <p>Edit this block to add your own content.</p>\n</div>'}
};

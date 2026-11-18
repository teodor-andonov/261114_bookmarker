const $=id=>document.getElementById(id);
const editor=$('editor'),source=$('source'),palette=$('palette');
const paths={
 folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M12 10v6m-3-3h6"/>',
 new:'<path d="M6 3h8l4 4v14H6zM14 3v5h5m-7 3v7m-3-3h6"/>',open:'<path d="M3 7V5h7l3 3h8l-2 12H3zM3 11h18"/>',
 sidebar:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',source:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-2-14-4 16"/>',
 save:'<path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',commands:'<path d="M5 9V6a2 2 0 1 1 2 2h10a2 2 0 1 1-2-2v12a2 2 0 1 1 2-2H7a2 2 0 1 1-2 2z"/>',
 bold:'<path d="M6 12h8a4 4 0 0 1 0 8H6V4h7a4 4 0 0 1 0 8"/>',italic:'<path d="M10 4h8M6 20h8m2-16-8 16"/>',strike:'<path d="M17 7a5 5 0 0 0-5-3c-3 0-5 1-5 4s3 4 5 4m-6 5c1 2 3 3 6 3 3 0 5-1 5-4m-14-4h18"/>',
 code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5"/>',bullet:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1"/>',number:'<path d="M9 6h12M9 12h12M9 18h12M3 4h1v4M3 12c3-2 3 1 0 3h3M3 18h3l-2 2h2"/>',
 task:'<rect x="3" y="4" width="7" height="7" rx="1"/><path d="m4 7 2 2 4-5m3 3h8M13 17h8"/><rect x="3" y="14" width="7" height="7" rx="1"/>',quote:'<path d="M4 10h6v9H3v-6c0-5 3-7 6-8m7 5h5v9h-7v-6c0-5 3-7 6-8"/>',rule:'<path d="M3 12h18"/>',
 table:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 10h18M3 15h18M12 4v16"/>',row:'<rect x="3" y="3" width="18" height="12" rx="1"/><path d="M3 9h18M12 3v12m0 2v5m-3-2h6"/>',link:'<path d="m10 13 4-4m-7 6-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m2 4 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0)"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 17 5-5 4 4 4-5 5 6"/>',attach:'<path d="m8 13 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L14 1"/>',
 undo:'<path d="M9 7 3 13l6 6m-6-6h12a5 5 0 0 0 0-10"/>',redo:'<path d="m15 7 6 6-6 6m6-6H9A5 5 0 0 1 9 3"/>',file:'<path d="M6 3h8l4 4v14H6zM14 3v5h5"/>',chevron:'<path d="m9 5 7 7-7 7"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',refresh:'<path d="M20 10A8 8 0 1 0 18 18M20 3v7h-7"/>',saveAs:'<path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3m-5 9v6m-3-3h6"/>'
};
const icon=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[k]||paths.file)+'</svg>';
document.querySelectorAll('button[data-action]').forEach(b=>{if(!b.textContent.trim()&&!b.querySelector('svg'))b.innerHTML=icon(b.dataset.action)});
let assets=new Map(),urls=new Map(),handle=null,filename='Untitled.html',dirty=false,roots=[],savedRange=null,sourceMode=false;
const raster=new Set(['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp','image/x-icon','image/vnd.microsoft.icon']);
const supportedTags=new Set('P DIV SPAN BR H1 H2 H3 H4 H5 H6 UL OL LI STRONG B EM I S STRIKE DEL U BLOCKQUOTE PRE CODE HR TABLE THEAD TBODY TFOOT TR TH TD A IMG INPUT SUP SUB MARK FIGURE FIGCAPTION'.split(' '));
const dropTags=new Set('SCRIPT STYLE LINK META IFRAME OBJECT EMBED TEMPLATE NOSCRIPT SVG MATH FORM BUTTON VIDEO AUDIO SOURCE BASE HEAD'.split(' '));
const safeLink=v=>/^(https?:\/\/|mailto:|#)/i.test(v||'');
function status(s){$('message').textContent=s}
function info(){editor.dataset.empty=String(!editor.textContent.trim()&&!editor.querySelector('img,table,input,hr,a[data-asset]'));const text=sourceMode?source.value:editor.textContent;const words=text.trim()?text.trim().split(/\s+/).length:0;$('filename').textContent=filename;$('dirty').textContent=dirty?'•':'';$('stats').textContent=words+' words · '+assets.size+' assets';document.title=(dirty?'* ':'')+filename+' — HTML Notes'}
let infoFrame=0;
function changed(){dirty=true;editor.dataset.empty=String(!editor.textContent.trim()&&!editor.querySelector('img,table,input,hr,a[data-asset]'));$('dirty').textContent='•';if(!infoFrame)infoFrame=requestAnimationFrame(()=>{infoFrame=0;info()})}
function revoke(){for(const url of urls.values())URL.revokeObjectURL(url);urls.clear()}
function blobURL(id){if(urls.has(id))return urls.get(id);const a=assets.get(id);if(!a)return '';try{const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:raster.has(a.mime)?a.mime:'application/octet-stream'}));urls.set(id,url);return url}catch{return ''}}
function dom(tag,txt){const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;return e}
function scrub(html) {
 const template=document.createElement('template');template.innerHTML=html;
 const output=document.createElement('template');
 function copy(n,parent){
  if(n.nodeType===3){parent.append(document.createTextNode(n.textContent));return}
  if(n.nodeType!==1||dropTags.has(n.tagName))return;
  if(!supportedTags.has(n.tagName)){for(const child of n.childNodes)copy(child,parent);return}
  const e=dom(n.tagName.toLowerCase()),id=n.getAttribute('data-asset');
  if(n.tagName==='IMG'){if(!id||!assets.has(id)||!raster.has(assets.get(id).mime)){
    const alt=n.getAttribute('alt');if(alt)parent.append(document.createTextNode('[Image: '+alt+']'));return
   }e.setAttribute('data-asset',id);e.alt=n.getAttribute('alt')||assets.get(id).name}
  if(n.tagName==='A'){if(id&&assets.has(id)){e.setAttribute('data-asset',id);e.setAttribute('download',assets.get(id).name)}
    else if(safeLink(n.getAttribute('href')))e.setAttribute('href',n.getAttribute('href'))}
  if(n.tagName==='INPUT'){if(n.getAttribute('type')!=='checkbox')return;e.type='checkbox';if(n.checked||n.hasAttribute('checked'))e.setAttribute('checked','');e.setAttribute('contenteditable','false')}
  if(['TD','TH'].includes(n.tagName))for(const a of ['colspan','rowspan']){const v=Number(n.getAttribute(a));if(Number.isInteger(v)&&v>1&&v<=50)e.setAttribute(a,String(v))}
  if(n.tagName==='OL'){const v=Number(n.getAttribute('start'));if(v>1&&Number.isInteger(v))e.setAttribute('start',String(v))}
  for(const child of n.childNodes)copy(child,e);parent.append(e)
 }
 for(const n of template.content.childNodes)copy(n,output.content);
 return output.innerHTML;
}
function hydrate(){editor.querySelectorAll('[data-asset]').forEach(e=>{const id=e.dataset.asset,a=assets.get(id);if(!a)return;const u=blobURL(id);if(e.tagName==='IMG'&&raster.has(a.mime))e.src=u;else if(e.tagName==='A'){e.href=u;e.download=a.name}})}
function canonical(){const clone=editor.cloneNode(true);const live=editor.querySelectorAll('input[type=checkbox]');clone.querySelectorAll('input[type=checkbox]').forEach((e,i)=>e.toggleAttribute('checked',live[i].checked));return scrub(clone.innerHTML)}
function bodySource(){return sourceMode?scrub(source.value):canonical()}
function setSource(on){if(on===sourceMode)return;closeSlash();savedRange=null;if(on){source.value=canonical();editor.hidden=true;source.hidden=false;source.focus()}else{editor.innerHTML=scrub(source.value)||'<p><br></p>';hydrate();source.hidden=true;editor.hidden=false;editor.focus()}sourceMode=on;document.querySelector('[data-action=source]').classList.toggle('active',on);info()}
function remember(){const selection=getSelection();if(selection?.rangeCount&&editor.contains(selection.anchorNode)&&editor.contains(selection.focusNode))savedRange=selection.getRangeAt(0).cloneRange()}
function restore(){if(sourceMode)setSource(false);editor.focus();const selection=getSelection();if(savedRange&&editor.contains(savedRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(savedRange)}else{const r=document.createRange();r.selectNodeContents(editor);r.collapse(false);selection.removeAllRanges();selection.addRange(r)}}
function execute(command,value=null){restore();document.execCommand('styleWithCSS',false,false);document.execCommand('defaultParagraphSeparator',false,'p');document.execCommand(command,false,value);remember();changed();updateFormatting()}
function insert(html){execute('insertHTML',html);hydrate()}
function resetDocument(name,content,newAssets,newHandle){closeSlash();revoke();assets=newAssets;handle=newHandle;filename=name;dirty=false;savedRange=null;sourceMode=false;source.hidden=true;editor.hidden=false;document.querySelector('[data-action=source]').classList.remove('active');editor.innerHTML=scrub(content)||'<p><br></p>';hydrate();info()}
function safeToReplace(){return !dirty||confirm('Discard unsaved changes?')}
function importDocument(text,name,newHandle){
 const t=document.createElement('template');t.innerHTML=text;
 const assetNode=t.content.querySelector('script#html-notes-assets[type="application/json"]');
 const next=new Map();
 if(assetNode){const records=JSON.parse(assetNode.textContent);if(!Array.isArray(records))throw new Error('Invalid asset section');for(const a of records){if(typeof a.id==='string'&&/^[a-z0-9-]{1,80}$/i.test(a.id)&&typeof a.name==='string'&&typeof a.mime==='string'&&typeof a.data==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(a.data)&&a.data.length%4===0)next.set(a.id,{name:a.name,mime:a.mime,data:a.data})}}
 const note=t.content.querySelector('article#html-notes-body');
 const bodyMatch=text.match(/<body(?:\s[^>]*)?>([\s\S]*?)<\/body\s*>/i);
 const body=document.createElement('template');body.innerHTML=note?note.innerHTML:(bodyMatch?bodyMatch[1]:text);
 for(const img of body.content.querySelectorAll('img:not([data-asset])')){const match=(img.getAttribute('src')||'').match(/^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/i);if(!match||!raster.has(match[1].toLowerCase())||match[2].length%4!==0)continue;const id=crypto.randomUUID();next.set(id,{name:img.getAttribute('alt')||'Image',mime:match[1].toLowerCase(),data:match[2]});img.setAttribute('data-asset',id)}
 resetDocument(name,body.innerHTML,next,newHandle);
 status(note?'Opened local note':'Imported HTML as editable content; scripts, styling and remote images removed');
}
async function openFile(file,newHandle=null){if(!safeToReplace())return;try{importDocument(await file.text(),file.name,newHandle)}catch(e){status('Open failed: '+e.message)}}
async function pickOpen(){if(window.showOpenFilePicker){try{const [h]=await showOpenFilePicker({types:[{description:'HTML notes',accept:{'text/html':['.html','.htm']}}]});if(h)await openFile(await h.getFile(),h)}catch(e){if(e.name!=='AbortError')status('Open failed: '+e.message)}}else $('openInput').click()}
function viewerResolve(){
 const rasterTypes=new Set(['image/png','image/jpeg','image/gif','image/webp','image/avif','image/bmp','image/x-icon','image/vnd.microsoft.icon']);
 const records=JSON.parse(document.getElementById('html-notes-assets').textContent);
 const map=new Map(records.map(x=>[x.id,x]));
 const urls=new Map();
 for(const e of document.querySelectorAll('#html-notes-body [data-asset]')){
  const id=e.dataset.asset,a=map.get(id);if(!a)continue;
  try{if(!urls.has(id)){const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));urls.set(id,URL.createObjectURL(new Blob([bytes],{type:rasterTypes.has(a.mime)?a.mime:'application/octet-stream'})))}
   if(e.tagName==='IMG'&&rasterTypes.has(a.mime))e.src=urls.get(id);
   else if(e.tagName==='A'){e.href=urls.get(id);e.download=a.name}
  }catch{}
 }
}
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
function exportHTML(){const body=bodySource();const t=document.createElement('template');t.innerHTML=body;
 const used=new Set([...t.content.querySelectorAll('[data-asset]')].map(e=>e.dataset.asset));
 const records=[...assets].filter(([id])=>used.has(id)).map(([id,a])=>({id,...a}));
 const title=t.content.querySelector('h1')?.textContent||filename.replace(/\.html?$/i,'');
 // Put each binary record on its own line at the end. JSON is inert, and escaping < prevents closing its script tag.
 const json='[\n'+records.map(a=>JSON.stringify(a).replace(/</g,'\\u003c')).join(',\n')+'\n]';
 const readable=body.replace(/><(?=\/?(?:p|div|h[1-6]|ul|ol|li|table|thead|tbody|tr|blockquote|pre|hr|figure)\b)/gi,'>\n<');
 return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="html-notes-format" content="1">\n<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src blob: data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'">\n<title>'+escapeHTML(title)+'</title>\n<style>html{color-scheme:light dark}body{font:16px/1.65 system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 22px;overflow-wrap:anywhere}h1,h2,h3{line-height:1.25}img{max-width:100%;height:auto;display:block}table{border-collapse:collapse;width:100%}td,th{border:1px solid #9998;padding:7px 10px}pre{white-space:pre-wrap;background:#8882;padding:12px}blockquote{border-left:3px solid #888;padding-left:1em;margin-left:0}li:has(>input[type=checkbox]){list-style:none}a[data-asset]{display:inline-block;border:1px solid #8888;padding:4px 8px;border-radius:4px}</style>\n</head>\n<body>\n<article id="html-notes-body">\n'+readable+'\n</article>\n<!-- Asset section: binary payloads are below. The note above can be read independently. -->\n<script type="application/json" id="html-notes-assets">\n'+json+'\n</script>\n<script>('+viewerResolve.toString()+')();</script>\n</body>\n</html>\n';
}
async function save(as=false){try{let target=as?null:handle;if(!target&&window.showSaveFilePicker)target=await showSaveFilePicker({suggestedName:filename,types:[{description:'HTML note',accept:{'text/html':['.html']}}]});
 if(target){const w=await target.createWritable();await w.write(exportHTML());await w.close();handle=target;filename=target.name;dirty=false;info();status('Saved to '+filename);return}
 const url=URL.createObjectURL(new Blob([exportHTML()],{type:'text/html'}));const a=dom('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);status('Export downloaded; original file not overwritten');dirty=false;info();
 }catch(e){if(e.name!=='AbortError')status('Save failed: '+e.message)}}
const readData=f=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]||'');r.onerror=()=>reject(r.error);r.readAsDataURL(f)});
async function embed(files,imagesOnly=false){restore();for(const f of files){try{if(imagesOnly&&!raster.has(f.type)){status('Unsupported inline image; attach it as a file instead');continue}if(f.size>25*1024*1024&&!confirm('Embed '+f.name+' ('+Math.round(f.size/1024/1024)+' MB)? Large notes may be slow.'))continue;
 const id=crypto.randomUUID(),data=await readData(f);assets.set(id,{name:f.name,mime:f.type||'application/octet-stream',data});let e;if(raster.has(f.type)&&imagesOnly){e=dom('img');e.alt=f.name;e.src=blobURL(id)}else{e=dom('a',f.name);e.download=f.name;e.href=blobURL(id)}e.dataset.asset=id;
 insert(e.outerHTML+'<p><br></p>');status('Embedded '+f.name)
 }catch(e){status('Embed failed: '+e.message)}}info()}
function treeButton(label,k,click){const b=dom('button');b.innerHTML=/^h[123]$/.test(k)?'<span class="command-symbol">'+k.toUpperCase()+'</span>':k==='paragraph'?'<span class="command-symbol">¶</span>':icon(k);b.append(dom('span',label));b.title=label;b.onclick=click;return b}
function fileRow(name,open){const row=dom('div');row.className='tree-item';const btn=treeButton(name,'file',async()=>{const before=handle;await open();if(handle!==before||(!handle&&!dirty&&filename===name)){document.querySelectorAll('.tree-item [aria-current]').forEach(x=>x.removeAttribute('aria-current'));btn.setAttribute('aria-current','page');if(innerWidth<680)$('sidebar').hidden=true}});row.append(btn);return row}
function dirRow(name,load,remove=null){const outer=dom('div'),row=dom('div'),children=dom('div');row.className='tree-item';children.className='children';children.hidden=true;let opened=false;
 const toggle=treeButton(name,'open',async()=>{children.hidden=!children.hidden;if(!children.hidden&&!opened){opened=true;children.replaceChildren(dom('p','Loading…'));try{const nodes=await load();children.replaceChildren(...nodes);if(!nodes.length)children.append(dom('p','No HTML files'));}catch(e){children.textContent='Cannot read folder: '+e.message;opened=false}}});
 toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>toggle.setAttribute('aria-expanded',String(!children.hidden)));row.append(toggle);if(remove){const b=dom('button');b.className='remove';b.innerHTML=icon('close');b.title='Remove folder';b.setAttribute('aria-label','Remove folder');b.onclick=remove;row.append(b)}outer.append(row,children);return outer}
async function listDirectory(h){const all=[];for await(const [,entry] of h.entries())all.push(entry);all.sort((a,b)=>(a.kind===b.kind?0:a.kind==='directory'?-1:1)||a.name.localeCompare(b.name));return all.filter(e=>e.kind==='directory'||/\.html?$/i.test(e.name)).map(e=>e.kind==='directory'?dirRow(e.name,()=>listDirectory(e)):fileRow(e.name,async()=>openFile(await e.getFile(),e)))}
function browseFallback(files){const groups=new Map();for(const f of files){const parts=(f.webkitRelativePath||f.name).split('/');const root=parts.shift();if(!groups.has(root))groups.set(root,{dirs:new Map(),files:[]});if(!/\.html?$/i.test(f.name))continue;let n=groups.get(root);for(const part of parts.slice(0,-1)){if(!n.dirs.has(part))n.dirs.set(part,{dirs:new Map(),files:[]});n=n.dirs.get(part)}n.files.push(f)}
 const nodes=n=>[...n.dirs].sort(([a],[b])=>a.localeCompare(b)).map(([name,child])=>dirRow(name,async()=>nodes(child))).concat(n.files.sort((a,b)=>a.name.localeCompare(b.name)).map(f=>fileRow(f.name,()=>openFile(f))));
 for(const [name,n] of groups)roots.push({name,load:async()=>nodes(n)});renderRoots();status('Read-only folder selection; Save downloads a copy')}
function renderRoots(){const host=$('folders');host.replaceChildren();if(!roots.length){const p=dom('p','Open a folder to browse HTML notes.');p.className='muted';host.append(p)}for(const root of roots)host.append(dirRow(root.name,root.load,()=>{roots=roots.filter(r=>r!==root);renderRoots()}));}
async function pickFolder(){if(window.showDirectoryPicker){try{const h=await showDirectoryPicker({mode:'readwrite'});for(const r of roots)if(r.handle&&await h.isSameEntry(r.handle)){status('Folder already open');return;}roots.push({name:h.name,handle:h,load:()=>listDirectory(h)});renderRoots();status('Folder added: '+h.name)}catch(e){if(e.name!=='AbortError')status('Folder failed: '+e.message)}}else $('folderInput').click()}
function newNote(){if(!safeToReplace())return;resetDocument('Untitled.html','<p><br></p>',new Map(),null);editor.focus();placeCaret(editor.firstElementChild,false);status('New note')}
function setLink(){restore();const selected=getSelection()?.toString();const url=prompt('Link URL','https://');if(!url||!safeLink(url))return;restore();if(selected)execute('createLink',url);else insert('<a href="'+escapeHTML(url)+'">'+escapeHTML(url)+'</a>')}
function insertTable(){const n=3,rows=2,before=new Set(editor.querySelectorAll('table'));insert('<table><thead><tr>'+Array.from({length:n},(_,i)=>'<th>Heading '+(i+1)+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:rows},()=>'<tr>'+'<td><br></td>'.repeat(n)+'</tr>').join('')+'</tbody></table><p><br></p>');const table=[...editor.querySelectorAll('table')].find(t=>!before.has(t));if(table?.rows[0]?.cells[0])placeCaret(table.rows[0].cells[0])}
function addRow(){restore();const sel=getSelection()?.anchorNode;const row=(sel?.nodeType===1?sel:sel?.parentElement)?.closest('tr');if(!row||!editor.contains(row)){status('Place cursor inside a table first');return;}const next=dom('tr');for(const cell of row.cells){const td=dom('td');td.append(dom('br'));next.append(td)}if(row.parentElement.tagName==='THEAD'){const table=row.closest('table');(table.tBodies[0]||table.createTBody()).prepend(next)}else row.after(next);placeCaret(next.cells[0]);changed()}
let imagePick=false;function pickAssets(images){remember();imagePick=images;$('assetInput').accept=images?'image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp':'';$('assetInput').click()}
const actions={new:['New note',newNote],open:['Open HTML file',pickOpen],folder:['Add folder',pickFolder],refresh:['Refresh folders',()=>{renderRoots();status('Folders refreshed')}],save:['Save',()=>save()],saveAs:['Save as',()=>save(true)],sidebar:['Toggle sidebar',()=>$('sidebar').hidden=!$('sidebar').hidden],source:['Toggle body source',()=>setSource(!sourceMode)],commands:['Command palette',()=>showCommands()],insert:['Insert block',()=>{restore();const s=getSelection(),node=s.anchorNode,prior=node?.nodeType===3?node.data.slice(0,s.anchorOffset):'';execute('insertText',prior&&!/\s$/.test(prior)?' /':'/');refreshSlash()}],paragraph:['Paragraph',()=>execute('formatBlock','p')],h1:['Heading 1',()=>execute('formatBlock','h1')],h2:['Heading 2',()=>execute('formatBlock','h2')],h3:['Heading 3',()=>execute('formatBlock','h3')],bold:['Bold',()=>execute('bold')],italic:['Italic',()=>execute('italic')],strike:['Strikethrough',()=>execute('strikeThrough')],code:['Code block',()=>execute('formatBlock','pre')],bullet:['Bullet list',()=>execute('insertUnorderedList')],number:['Numbered list',()=>execute('insertOrderedList')],task:['Task list',makeTask],quote:['Blockquote',()=>execute('formatBlock','blockquote')],rule:['Divider',()=>execute('insertHorizontalRule')],table:['Insert table',insertTable],row:['Add table row',addRow],link:['Insert link',setLink],image:['Embed image',()=>pickAssets(true)],attach:['Embed attachment',()=>pickAssets(false)],undo:['Undo',()=>execute('undo')],redo:['Redo',()=>execute('redo')]};

const slashMenu=$('slashMenu'),slashList=$('slashList');
const slashTools=[
 ['paragraph','Text','p normal paragraph'],['h1','Heading 1','h1 title'],['h2','Heading 2','h2 subtitle'],['h3','Heading 3','h3 subheading'],
 ['bullet','Bullet list','ul unordered bullets'],['number','Numbered list','ol ordered numbers'],['task','Task list','todo checkbox checklist'],
 ['quote','Quote','blockquote'],['code','Code block','pre code'],['rule','Divider','hr separator'],
 ['table','Table','grid columns'],['row','Add table row','table row'],['image','Image','picture photo paste'],['attach','Attachment','file pdf embed'],['link','Link','url hyperlink'],
 ['bold','Bold','strong'],['italic','Italic','em'],['strike','Strikethrough','strike delete']
];
let slashItems=[],slashIndex=0,slashQuery='',slashSuppressed=null;
function placeCaret(el,end=false){const s=getSelection(),r=document.createRange();r.selectNodeContents(el);r.collapse(!end);s.removeAllRanges();s.addRange(r);remember()}
function taskCheckbox(){const cb=dom('input');cb.type='checkbox';cb.setAttribute('contenteditable','false');return cb}
function makeTask(){restore();const s=getSelection();let el=s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement;let li=el?.closest('li');if(!li){execute('insertUnorderedList');el=s.anchorNode?.nodeType===1?s.anchorNode:s.anchorNode?.parentElement;li=el?.closest('li')}
 if(!li){insert('<ul><li><input type="checkbox" contenteditable="false"> <br></li></ul>');return}
 if(!li.querySelector(':scope > input[type=checkbox]')){li.prepend(taskCheckbox(),document.createTextNode(' '));if(!li.textContent.trim())placeCaret(li,true);changed()}
}
function slashMatch(){
 if(sourceMode||document.activeElement!==editor)return null;
 const s=getSelection();if(!s?.isCollapsed||s.anchorNode?.nodeType!==3||!editor.contains(s.anchorNode))return null;
 const node=s.anchorNode,offset=s.anchorOffset;
 if(node.parentElement?.closest('pre,code'))return null;
 const prefix=node.data.slice(0,offset),match=prefix.match(/(?:^|\s)\/([a-zA-Z0-9 -]{0,32})$/);
 if(!match)return null;
 const start=offset-match[1].length-1,r=document.createRange();r.setStart(node,start);r.setEnd(node,offset);
 return {range:r,query:match[1].toLowerCase().trim(),raw:match[1],node,start,end:offset}
}
function closeSlash(){slashMenu.hidden=true;slashItems=[];editor.removeAttribute('aria-controls');editor.removeAttribute('aria-activedescendant')}
function refreshSlash(){
 const m=slashMatch();if(!m){slashSuppressed=null;closeSlash();return}
 if(slashSuppressed&&slashSuppressed.node===m.node&&slashSuppressed.start===m.start&&slashSuppressed.raw===m.raw)return;
 slashSuppressed=null;
 const q=m.query;
 const entries=slashTools.filter(([key,label,keywords])=>q.split(/\s+/).every(w=>(key+' '+label+' '+keywords).toLowerCase().includes(w)));
 if(slashMenu.hidden||q!==slashQuery)slashIndex=0;slashQuery=q;slashItems=entries;
 slashIndex=Math.min(slashIndex,Math.max(0,entries.length-1));
 slashList.replaceChildren(...entries.map(([key,label],i)=>{const b=treeButton(label,key,()=>chooseSlash(entries[i]));b.id='slash-option-'+i;b.setAttribute('role','option');b.onpointerenter=()=>{slashIndex=i;paintSlash(false)};b.onmousedown=e=>e.preventDefault();return b}));
 if(!entries.length){editor.removeAttribute('aria-activedescendant');const p=dom('p','No matching commands');p.className='slash-empty';slashList.append(p)}
 slashMenu.hidden=false;editor.setAttribute('aria-controls','slashList');positionSlash(m);paintSlash();
}
function paintSlash(scroll=true){[...slashList.querySelectorAll('button')].forEach((b,i)=>{const active=i===slashIndex;b.classList.toggle('selected',active);b.setAttribute('aria-selected',String(active));if(active){editor.setAttribute('aria-activedescendant',b.id);if(scroll)b.scrollIntoView({block:'nearest'})}})}
function moveSlash(delta){if(!slashItems.length)return;slashIndex=(slashIndex+delta+slashItems.length)%slashItems.length;paintSlash()}
function positionSlash(m=slashMatch()){if(!m||slashMenu.hidden)return;const caret=m.range.cloneRange();caret.collapse(false);let rect=caret.getBoundingClientRect();if(!rect.height)rect=m.range.getBoundingClientRect();const w=slashMenu.offsetWidth,h=slashMenu.offsetHeight;
 slashMenu.style.left=Math.max(8,Math.min(rect.left,innerWidth-w-8))+'px';
 slashMenu.style.top=Math.max(8,Math.min(innerHeight-h-8,rect.bottom+h+8>innerHeight?rect.top-h-7:rect.bottom+7))+'px';
}
function chooseSlash(item){const m=slashMatch();if(!m||!item){closeSlash();return}
 const s=getSelection();s.removeAllRanges();s.addRange(m.range);closeSlash();document.execCommand('delete');remember();actions[item[0]][1]();changed();
}
function updateFormatting(){const s=getSelection();if(sourceMode||!s?.anchorNode||!editor.contains(s.anchorNode))return;
 for(const [key,command] of [['bold','bold'],['italic','italic'],['strike','strikeThrough']]){const b=document.querySelector('.toolbar [data-action="'+key+'"]');if(b){const on=document.queryCommandState(command);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))}}
}
document.addEventListener('pointerdown',e=>{if(!slashMenu.contains(e.target)&&!editor.contains(e.target))closeSlash()});
$('canvas').addEventListener('scroll',()=>positionSlash(),{passive:true});window.addEventListener('resize',()=>positionSlash());

function showCommands(){closeSlash();remember();$('filter').value='';renderCommands();palette.showModal();$('filter').focus()}
function renderCommands(){const q=$('filter').value.toLowerCase();$('commands').replaceChildren(...Object.entries(actions).filter(([k,[name]])=>k!=='commands'&&name.toLowerCase().includes(q)).map(([k,[name,fn]])=>{const b=treeButton(name,k,()=>{palette.close();fn()});return b}))}
$('filter').oninput=renderCommands;$('filter').onkeydown=e=>{if(e.key==='Enter'){$('commands').querySelector('button')?.click();e.preventDefault()}};
document.querySelectorAll('[data-action]').forEach(b=>{b.addEventListener('mousedown',e=>{remember();if(b.closest('.toolbar'))e.preventDefault()});b.onclick=()=>actions[b.dataset.action]?.[1]()});
document.addEventListener('selectionchange',()=>{remember();updateFormatting();if(!slashMenu.hidden&&!slashMatch())closeSlash()});editor.addEventListener('input',e=>{changed();if(!e.isComposing)refreshSlash()});editor.addEventListener('compositionend',refreshSlash);source.addEventListener('input',changed);
editor.addEventListener('change',e=>{if(e.target.matches('input[type=checkbox]')){e.target.toggleAttribute('checked',e.target.checked);changed()}});
editor.addEventListener('click',e=>{const a=e.target.closest('a');if(a){e.preventDefault();if(e.ctrlKey||e.metaKey){if(a.dataset.asset){const download=dom('a');download.href=blobURL(a.dataset.asset);download.download=assets.get(a.dataset.asset).name;download.click()}else if(safeLink(a.getAttribute('href')))window.open(a.href,'_blank','noopener,noreferrer')}else status('Ctrl+click to open/download link')}});
editor.addEventListener('paste',e=>{e.preventDefault();const images=[...e.clipboardData.files].filter(f=>raster.has(f.type));if(images.length){embed(images,true);return}const html=e.clipboardData.getData('text/html');if(html)insert(scrub(html));else execute('insertText',e.clipboardData.getData('text/plain'))});
editor.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()});editor.addEventListener('drop',e=>{e.preventDefault();const files=[...e.dataTransfer.files];if(files.length){const r=document.caretRangeFromPoint?.(e.clientX,e.clientY);if(r&&editor.contains(r.startContainer)){savedRange=r;restore()}embed(files.filter(f=>raster.has(f.type)),true).then(()=>embed(files.filter(f=>!raster.has(f.type)),false))}});
editor.addEventListener('keydown',e=>{
 if(e.isComposing)return;
 if(!slashMenu.hidden){
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();moveSlash(e.key==='ArrowDown'?1:-1);return}
  if(e.key==='Escape'){e.preventDefault();slashSuppressed=slashMatch();closeSlash();return}
  if((e.key==='Enter'||e.key==='Tab')&&slashItems.length){e.preventDefault();chooseSlash(slashItems[slashIndex]);return}
 }
 const s=getSelection(),node=s?.anchorNode,el=node?.nodeType===1?node:node?.parentElement,li=el?.closest('li');
 if(e.key==='Tab'){
  const cell=el?.closest('td,th');if(cell){e.preventDefault();const table=cell.closest('table'),cells=[...table.querySelectorAll('td,th')],i=cells.indexOf(cell),next=cells[i+(e.shiftKey?-1:1)];if(next)placeCaret(next);else if(!e.shiftKey)addRow();return}
  if(li){e.preventDefault();execute(e.shiftKey?'outdent':'indent');return}
 }
 if(e.key==='Enter'&&!e.shiftKey&&s?.isCollapsed&&li?.querySelector(':scope > input[type=checkbox]')){
  e.preventDefault();
  const list=li.parentElement;
  if(!li.textContent.trim()){
   const p=dom('p');p.append(dom('br'));
   if(li.nextElementSibling){const tail=list.cloneNode(false);while(li.nextElementSibling)tail.append(li.nextElementSibling);list.after(tail);tail.before(p)}else list.after(p);
   li.remove();if(!list.children.length)list.remove();placeCaret(p);changed();return
  }
  const next=dom('li'),cb=taskCheckbox(),range=s.getRangeAt(0).cloneRange();
  range.setEnd(li,li.childNodes.length);const tail=range.extractContents();
  const space=document.createTextNode(' ');next.append(cb,space,tail);li.after(next);const caret=document.createRange();caret.setStart(space,1);caret.collapse(true);s.removeAllRanges();s.addRange(caret);remember();changed();return
 }
});
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey))return;const k=e.key.toLowerCase();if(k==='s'){e.preventDefault();save(e.shiftKey)}else if(k==='k'){e.preventDefault();if(palette.open)palette.close();else showCommands()}else if(k==='o'){e.preventDefault();pickOpen()}});
$('openInput').onchange=async e=>{const f=e.target.files[0];if(f)await openFile(f);e.target.value=''};
$('folderInput').onchange=e=>{browseFallback([...e.target.files]);e.target.value=''};
$('assetInput').onchange=async e=>{await embed([...e.target.files],imagePick);e.target.value=''};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
if(innerWidth<680)$('sidebar').hidden=true;
info();
updateFormatting();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>status('Offline shell unavailable'));

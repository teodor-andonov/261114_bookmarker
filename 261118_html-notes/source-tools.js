// Local, dependency-free HTML source tools. Never evaluate source.
const voidTags=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const rawTags=new Set(['script','style','textarea','title','pre']);
const blockTags=new Set('address article aside blockquote div dl dt dd figure figcaption footer form h1 h2 h3 h4 h5 h6 header hr main nav ol p pre section template table caption colgroup thead tbody tfoot tr td th ul li details summary'.split(' '));
const containers=new Set('root article aside blockquote div dl figure footer header main nav ol section table colgroup thead tbody tfoot tr ul li td th details'.split(' '));
const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
export function tokenizeHTML(source){
 const tokens=[];let pos=0,raw=null;
 while(pos<source.length){
  if(raw){const re=new RegExp('</'+raw+'\\s*>','ig');re.lastIndex=pos;const match=re.exec(source);const end=match?match.index:source.length;if(end>pos)tokens.push({kind:'raw',text:source.slice(pos,end)});pos=end;raw=null;if(pos===source.length)break}
  const rest=source.slice(pos);
  let match=rest.match(/^<!--[\s\S]*?(?:-->|$)/);
  if(match){tokens.push({kind:'comment',text:match[0]});pos+=match[0].length;continue}
  match=rest.match(/^<![a-z][^>]*>/i);
  if(match){tokens.push({kind:'declaration',text:match[0]});pos+=match[0].length;continue}
  match=rest.match(/^<\/?([a-z][\w:.-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/i);
  if(match){const text=match[0],name=match[1].toLowerCase(),close=text.startsWith('</'),single=voidTags.has(name)||/\/>$/.test(text);
   tokens.push({kind:'tag',text,name,close,single});pos+=text.length;if(!close&&!single&&rawTags.has(name))raw=name;continue}
  // Unrecognised or unfinished markup stays literal; always consume input.
  const next=source.indexOf('<',pos+1),end=next<0?source.length:next;tokens.push({kind:'text',text:source.slice(pos,end)});pos=end;
 }
 return tokens;
}
export function highlightHTML(source){
 const span=(cls,s)=>'<span class="syn-'+cls+'">'+escape(s)+'</span>';
 const tag=t=>{
  const lead=t.match(/^<\/?[\w:.-]+/)[0];let out=span('tag',lead);
  const tail=t.slice(lead.length);
  const re=/("[^"]*"|'[^']*')|([^\s=/<>"']+)(?=\s*=)|([^\s=/<>"']+)|([=/>]+)|(\s+)|./gs;
  for(const m of tail.matchAll(re))out+=m[1]?span('value',m[0]):m[2]||m[3]?span('attr',m[0]):m[4]?span('tag',m[0]):escape(m[0]);
  return out;
 };
 return tokenizeHTML(source).map(t=>t.kind==='tag'?tag(t.text):t.kind==='comment'?span('comment',t.text):t.kind==='declaration'?span('tag',t.text):t.kind==='raw'?span('raw',t.text):escape(t.text)).join('');
}
export function formatHTML(source){
 // Keep mixed inline content, raw text, attributes and tag spelling exactly as written.
 // Only reindent a structurally balanced fragment with block-level children.
 const root={name:'root',children:[]},stack=[root];
 for(const t of tokenizeHTML(source)){
  const parent=stack[stack.length-1];
  if(t.kind!=='tag'){parent.children.push(t);continue}
  if(t.close){
   if(stack.length===1||parent.name!==t.name)return source;
   parent.end=t.text;stack.pop();
  }else{
   const n={name:t.name,start:t.text,end:'',children:[]};parent.children.push(n);if(!t.single)stack.push(n)
  }
 }
 if(stack.length!==1)return source;
 const original=n=>n.start!==undefined?n.start+n.children.map(original).join('')+n.end:n.text;
 const isWhitespace=n=>n.kind==='text'&&!n.text.trim();
 const isBlock=n=>n.start!==undefined&&blockTags.has(n.name)||n.kind==='comment'||n.kind==='declaration';
 const format=(n,depth)=>{
  if(n.start===undefined&&n.name!=='root')return n.text;
  const children=n.children.filter(x=>!isWhitespace(x));
  const pad='  '.repeat(depth);
  if(!containers.has(n.name)||!children.length||!children.every(isBlock))return n.name==='root'?n.children.map(original).join(''):original(n);
  if(n.name==='root')return children.map(x=>format(x,0)).join('\n');
  return n.start+'\n'+children.map(x=>pad+'  '+format(x,depth+1)).join('\n')+'\n'+pad+n.end;
 };
 return format(root,0);
}

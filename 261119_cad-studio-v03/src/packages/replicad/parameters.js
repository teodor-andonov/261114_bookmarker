export const sidecar=source=>source+'.params.json';
export function parseParameters(text){
 const p=JSON.parse(text);if(!p||!Array.isArray(p.definitions)||!p.values||typeof p.values!=='object')throw Error('Expected definitions[] and values{}');
 const ids=new Set();for(const d of p.definitions){if(typeof d.id!=='string'||!d.id||ids.has(d.id))throw Error('Invalid/duplicate parameter ID');ids.add(d.id);validate(d,p.values[d.id]);}return p;
}
export function validate(d,value){if(d.type==='number'){if(!Number.isFinite(value)||!Number.isFinite(d.min)||!Number.isFinite(d.max)||d.min>d.max||!Number.isFinite(d.step)||d.step<=0||value<d.min||value>d.max)throw Error('Invalid numeric parameter '+d.id);}else if(d.type==='boolean'){if(typeof value!=='boolean')throw Error('Invalid boolean '+d.id);}else if(d.type==='choice'){if(!Array.isArray(d.options)||!d.options.includes(value))throw Error('Invalid choice '+d.id);}else throw Error('Unsupported parameter type '+d.type);return value;}

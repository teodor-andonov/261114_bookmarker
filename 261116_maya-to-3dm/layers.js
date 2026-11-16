// Maya's DAG is a hierarchy of transforms and shapes. One Rhino layer is
// created for every source transform path, with its original parent nesting.
const PALETTE=[
  [117,165,185],[183,150,120],[145,173,142],[159,148,191],
  [194,152,163],[121,175,174],[183,177,127],[151,169,181]
];
export function objectLayerKey(object){
  const parts=String(object?.path||"").split("|").filter(Boolean);
  const parents=parts.slice(0,-1);
  return parents.length?"|"+parents.join("|"):"|Ungrouped";
}
export function layerColor(key){
  let hash=2166136261;
  for(const ch of key){hash=Math.imul(hash ^ ch.charCodeAt(0),16777619);}
  const rgb=PALETTE[(hash>>>0)%PALETTE.length];
  return {r:rgb[0],g:rgb[1],b:rgb[2]};
}
export function layerCatalog(objects){
  const map=new Map();
  for(const object of objects){
    const key=objectLayerKey(object);
    const tokens=key.split("|").filter(Boolean);
    let parent=null;
    for(let i=0;i<tokens.length;i++){
      const id="|"+tokens.slice(0,i+1).join("|");
      if(!map.has(id))map.set(id,{
        id,name:tokens[i],parent,depth:i,directCount:0,count:0,
        color:layerColor(id)
      });
      map.get(id).count++;
      if(i===tokens.length-1)map.get(id).directCount++;
      parent=id;
    }
  }
  return [...map.values()];
}
export function visibleOnLayer(key,visibility={}){
  const parts=key.split("|").filter(Boolean);
  for(let i=0;i<parts.length;i++){
    const id="|"+parts.slice(0,i+1).join("|");
    if(visibility instanceof Map?visibility.get(id)===false:visibility[id]===false)return false;
  }
  return true;
}

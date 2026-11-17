// Maya display layers are flat sets, distinct from the scene's DAG hierarchy.
// Colours are read from Maya RGB overrides where present, otherwise seeded
// pseudo-randomly per layer name so reimports have predictable colours.
const PALETTE=[
  [117,165,185],[183,150,120],[145,173,142],[159,148,191],
  [194,152,163],[121,175,174],[183,177,127],[151,169,181],
  [192,153,116],[139,175,163],[160,158,206],[197,166,137]
];
export function objectLayerKey(object){
  return object?.layerName||"Default";
}
export function layerColor(key){
  if(key==="Default")return {r:150,g:157,b:165};
  let hash=2166136261;
  for(const ch of String(key))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
  const rgb=PALETTE[(hash>>>0)%PALETTE.length];
  return {r:rgb[0],g:rgb[1],b:rgb[2]};
}
export function layerCatalog(objects,declaredLayers=[]){
  const map=new Map();
  for(const layer of declaredLayers){
    if(!layer?.name||layer.name==="defaultLayer")continue;
    map.set(layer.name,{
      id:layer.name,name:layer.name,parent:null,depth:0,
      directCount:0,count:0,color:layer.color||layerColor(layer.name),
      visible:layer.visible!==false
    });
  }
  for(const object of objects){
    const id=objectLayerKey(object);
    if(!map.has(id))map.set(id,{
      id,name:id,parent:null,depth:0,directCount:0,count:0,
      color:object.layerColor||layerColor(id),visible:true
    });
    const entry=map.get(id);
    entry.count++;entry.directCount++;
  }
  return [...map.values()];
}
export function visibleOnLayer(key,visibility={}){
  return visibility instanceof Map ? visibility.get(key)!==false : visibility[key]!==false;
}

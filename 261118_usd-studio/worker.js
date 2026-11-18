import {build,roundTrip} from "./model.js";
self.onmessage = ({data}) => {
  try {
    const result = build(data.source,data.includeMesh);
    const checked = roundTrip(result.usda);
    if(checked.length!==result.meshes.length) throw new Error("USDA round-trip changed the object count.");
    for(let i=0;i<checked.length;i++){
      const original=result.meshes[i], recovered=checked[i];
      if(original.volume!==null && (!Number.isFinite(recovered.volume) || Math.abs(recovered.volume-original.volume)>Math.max(1e-5,Math.abs(original.volume)*1e-5))) throw new Error("USDA round-trip volume mismatch on object "+(i+1));
    }
    const transfers = result.meshes.flatMap(m=>[m.positions.buffer,m.indices.buffer,...(m.normals?[m.normals.buffer]:[])]);
    self.postMessage({id:data.id,...result,checked},transfers);
  } catch(error) {self.postMessage({id:data.id,error:String(error?.message||error)});}
};

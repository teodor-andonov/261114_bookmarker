// Rhino mesh export with genuine nested layers copied from Maya DAG paths.
// This module is synchronous so it can be tested in Node and run in a Worker.
import {layerCatalog,objectLayerKey} from "./layers.js";

const unitNames={
  mm:"Millimeters",millimeter:"Millimeters",millimeters:"Millimeters",
  cm:"Centimeters",centimeter:"Centimeters",centimeters:"Centimeters",
  m:"Meters",meter:"Meters",meters:"Meters",km:"Kilometers",
  in:"Inches",inch:"Inches",ft:"Feet",foot:"Feet",yd:"Yards"
};
function populate(mesh,object,triangles=false){
  const vertices=mesh.vertices();
  for(const p of object.vertices){
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))
      throw new Error("Non-finite vertex coordinates");
    vertices.add(p[0],p[1],p[2]);
  }
  const faces=mesh.faces();
  for(const polygon of object.faces){
    if(!Array.isArray(polygon)||polygon.length<3)continue;
    if(polygon.some(index=>!Number.isInteger(index)||index<0||index>=object.vertices.length))
      throw new Error("Face references an invalid vertex");
    if(!triangles&&polygon.length===4)faces.addQuadFace(...polygon);
    else if(!triangles&&polygon.length===3)faces.addTriFace(...polygon);
    else for(let i=1;i<polygon.length-1;i++)
      faces.addTriFace(polygon[0],polygon[i],polygon[i+1]);
  }
  mesh.normals().computeNormals();
  mesh.compact();
}
export function createMesh3dmSession(meta,rhino){
  const doc=new rhino.File3dm();
  doc.applicationName="Testlab Maya Mesh Converter";
  doc.settings().modelUnitSystem=rhino.UnitSystem[unitNames[meta.unit]||"Centimeters"];
  const layerIndices=new Map(),layerIds=new Map(),skipped=[];
  let exported=0,closed=false;
  try{
    for(const item of layerCatalog(meta.objects||[])){
      const layer=new rhino.Layer();
      try{
        layer.name=item.name;
        layer.color=item.color;
        if(item.parent){
          const parentId=layerIds.get(item.parent);
          if(!parentId)throw new Error("Missing Rhino parent layer: "+item.parent);
          layer.parentLayerId=parentId;
        }
        const index=doc.layers().add(layer);
        if(!Number.isInteger(index)||index<0)throw new Error("Cannot add Rhino layer "+item.id);
        const created=doc.layers().get(index);
        layerIndices.set(item.id,index);
        layerIds.set(item.id,created.id);
      }finally{layer.destroy?.();}
    }
  }catch(error){doc.destroy();throw error;}

  return {
    addObject(object){
      if(closed)throw new Error("Export session already completed");
      const layerIndex=layerIndices.get(objectLayerKey(object));
      if(layerIndex===undefined){
        skipped.push(object.name+": missing Maya group layer");return false;
      }
      let errorText="Invalid mesh geometry";
      for(const triangulate of [false,true]){
        const mesh=new rhino.Mesh();
        try{
          populate(mesh,object,triangulate);
          if(!mesh.isValid)continue;
          const attrs=new rhino.ObjectAttributes();
          attrs.name=object.name;
          attrs.layerIndex=layerIndex;
          const id=doc.objects().add(mesh,attrs);
          if(!id)throw new Error("Rhino could not add mesh");
          exported++;return true;
        }catch(error){errorText=error.message||String(error);}
        finally{mesh.destroy?.();}
      }
      skipped.push(object.name+": "+errorText);
      return false;
    },
    finish(){
      if(closed)throw new Error("Export session already completed");
      if(!exported)throw new Error("No valid Rhino meshes to export.");
      const bytes=doc.toByteArray();
      if(!bytes||bytes.byteLength<100)throw new Error("Empty Rhino 3DM output.");
      const loaded=rhino.File3dm.fromByteArray(bytes);
      if(!loaded)throw new Error("3DM read-back failed");
      try{
        if(loaded.objects().count!==exported)
          throw new Error("Missing geometry after 3DM read-back.");
      }finally{loaded.destroy();}
      return {bytes,exported,skipped:[...skipped],layers:layerIndices.size};
    },
    dispose(){if(!closed){closed=true;doc.destroy();}}
  };
}
export function buildMesh3dm(model,rhino){
  if(!model?.objects?.length)throw new Error("There is no geometry to export.");
  const session=createMesh3dmSession(model,rhino);
  try{
    for(const object of model.objects)session.addObject(object);
    return session.finish();
  }finally{session.dispose();}
}

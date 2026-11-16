// Geometry-only Rhino polygon-mesh export.
// Invalid objects are isolated and reported instead of aborting the whole scene.
const unitNames={
  mm:"Millimeters",millimeter:"Millimeters",millimeters:"Millimeters",
  cm:"Centimeters",centimeter:"Centimeters",centimeters:"Centimeters",
  m:"Meters",meter:"Meters",meters:"Meters",km:"Kilometers",
  in:"Inches",inch:"Inches",ft:"Feet",foot:"Feet",yd:"Yards"
};
function populate(mesh,object,triangles=false) {
  const v=mesh.vertices();
  for(const p of object.vertices){
    if(!p?.every(Number.isFinite))throw new Error("Non-finite vertex.");
    v.add(p[0],p[1],p[2]);
  }
  const faces=mesh.faces();
  for(const polygon of object.faces){
    if(polygon.length<3)continue;
    if(!triangles&&polygon.length===4)faces.addQuadFace(...polygon);
    else if(!triangles&&polygon.length===3)faces.addTriFace(...polygon);
    else for(let i=1;i<polygon.length-1;i++)
      faces.addTriFace(polygon[0],polygon[i],polygon[i+1]);
  }
  mesh.normals().computeNormals();
  mesh.compact();
}
export function buildMesh3dm(model,rhino) {
  if(!model?.objects?.length)throw new Error("There is no geometry to export.");
  const doc=new rhino.File3dm();
  doc.applicationName="Testlab Maya Mesh Converter";
  doc.settings().modelUnitSystem=rhino.UnitSystem[unitNames[model.unit]||"Centimeters"];
  const skipped=[];
  let exported=0;
  try{
    for(const object of model.objects){
      let completed=false;
      for(const fallbackTriangles of [false,true]){
        const mesh=new rhino.Mesh();
        try{
          populate(mesh,object,fallbackTriangles);
          if(!mesh.isValid)continue;
          const attr=new rhino.ObjectAttributes();
          attr.name=object.name;
          const id=doc.objects().add(mesh,attr);
          if(!id)throw new Error("Rhino object insert failed.");
          exported++;completed=true;
          break;
        }catch(error){
          if(fallbackTriangles)skipped.push(object.name+": "+error.message);
        }finally{
          mesh.destroy?.();
        }
      }
      if(!completed&&!skipped.some(s=>s.startsWith(object.name+":")))
        skipped.push(object.name+": Rhino rejected mesh topology.");
    }
    if(!exported)throw new Error("Rhino rejected every mesh. No file was created.");
    const bytes=doc.toByteArray();
    if(!bytes||bytes.byteLength<100)throw new Error("Empty Rhino document.");
    const verify=rhino.File3dm.fromByteArray(bytes);
    if(!verify)throw new Error("Could not re-open exported Rhino document.");
    try{
      if(verify.objects().count!==exported)
        throw new Error("Rhino file did not contain all exported meshes.");
    }finally{verify.destroy();}
    return {bytes,exported,skipped};
  }finally{doc.destroy();}
}

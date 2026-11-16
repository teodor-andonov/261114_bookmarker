// Incremental worker protocol: one mesh at a time keeps the UI responsive,
// avoids cloning the complete scene at once and permits real progress/cancel.
export function exportMesh3dm(model,{onProgress=()=>{},signal}={}){
  if(!model?.objects?.length)return Promise.reject(new Error("No meshes to export"));
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL("./export.worker.js",import.meta.url),{type:"module"});
    let next=0,settled=false;
    const cleanup=()=>{
      if(settled)return false;
      settled=true;
      signal?.removeEventListener("abort",onAbort);
      worker.terminate();
      return true;
    };
    const fail=error=>{if(cleanup())reject(error);};
    const onAbort=()=>fail(new DOMException("Export cancelled","AbortError"));
    if(signal?.aborted){onAbort();return;}
    signal?.addEventListener("abort",onAbort,{once:true});
    worker.onerror=event=>{
      event.preventDefault();
      fail(new Error(event.message||"3DM export worker failed"));
    };
    const sendNext=()=>{
      if(next<model.objects.length){
        const object=model.objects[next++];
        worker.postMessage({type:"mesh",object:{
          name:object.name,path:object.path,vertices:object.vertices,faces:object.faces
        }});
      }else worker.postMessage({type:"finish"});
    };
    worker.onmessage=({data})=>{
      if(settled)return;
      if(data.type==="ready")sendNext();
      else if(data.type==="progress"){
        onProgress(next,model.objects.length);
        sendNext();
      }else if(data.type==="done"){
        if(cleanup())resolve(data.result);
      }else if(data.type==="error")fail(new Error(data.message));
    };
    worker.postMessage({type:"start",meta:{
      unit:model.unit,objects:model.objects.map(o=>({path:o.path,name:o.name}))
    }});
  });
}

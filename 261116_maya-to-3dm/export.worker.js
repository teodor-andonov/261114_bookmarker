import initRhino from "rhino3dm/rhino3dm.module.js";
import wasmURL from "rhino3dm/rhino3dm.wasm?url";
import {createMesh3dmSession} from "./rhino-core.js";

let rhinoPromise=null,session=null;
function reportError(error){
  session?.dispose();
  session=null;
  self.postMessage({type:"error",message:error?.message||String(error)});
}
self.onmessage=async ({data})=>{
  try{
    if(data.type==="start"){
      if(session)throw new Error("Export already started");
      if(!rhinoPromise)rhinoPromise=initRhino({locateFile:()=>wasmURL});
      const rhino=await rhinoPromise;
      session=createMesh3dmSession(data.meta,rhino);
      self.postMessage({type:"ready"});
    }else if(data.type==="mesh"){
      if(!session)throw new Error("Export not started");
      const success=session.addObject(data.object);
      self.postMessage({type:"progress",success});
    }else if(data.type==="finish"){
      if(!session)throw new Error("Export not started");
      const result=session.finish();
      session.dispose();
      session=null;
      self.postMessage({type:"done",result},[result.bytes.buffer]);
    }
  }catch(error){reportError(error);}
};

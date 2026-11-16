import initRhino from "rhino3dm/rhino3dm.module.js";
import wasmUrl from "rhino3dm/rhino3dm.wasm?url";
import {buildMesh3dm} from "./rhino-core.js";
let instance;
export async function exportMesh3dm(model) {
  if(!instance)instance=initRhino({locateFile:()=>wasmUrl}).catch(error=>{
    instance=null;throw error;
  });
  return buildMesh3dm(model,await instance);
}

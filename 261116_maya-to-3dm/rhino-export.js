import initRhino from "rhino3dm/rhino3dm.module.js";
import wasmUrl from "rhino3dm/rhino3dm.wasm?url";

let modulePromise;
async function getRhino() {
  if (!modulePromise) {
    modulePromise = initRhino({locateFile: () => wasmUrl}).catch(error => {
      modulePromise = null;
      throw error;
    });
  }
  return modulePromise;
}

import {buildMesh3dm} from "./rhino-core.js";

export async function exportMesh3dm(parsed) {
  return buildMesh3dm(parsed, await getRhino());
}

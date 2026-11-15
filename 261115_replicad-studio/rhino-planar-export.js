// Rhino's openNURBS/WebAssembly 9.2 beta provides the topology-building API
// required by our tested closed planar-solid converter. Loaded only when a
// user requests 3DM export; there is no Rhino installation or backend.
import initRhino from "rhino3dm-beta/rhino3dm.module.js";
import rhinoWasmURL from "rhino3dm-beta/rhino3dm.wasm?url";
import { createExactPlanar3dm } from "./rhino-planar-core.js";
import { createGeneralNurbs3dm } from "./rhino-general-core.js";

let initPromise;

export async function exportPlanarRhino3dm(entries) {
  if (!initPromise) {
    initPromise = initRhino({ locateFile: () => rhinoWasmURL }).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  const rhino = await initPromise;
  return createExactPlanar3dm(entries, rhino);
}

/** Preferred general CAD-to-Rhino B-rep exporter. */
export async function exportGeneralRhino3dm(entries, oc) {
  if (!initPromise) {
    initPromise = initRhino({ locateFile: () => rhinoWasmURL }).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  return createGeneralNurbs3dm(entries, await initPromise, oc);
}

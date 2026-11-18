// Install diagnostics before starting the asynchronous WASM module import.
let engine, currentId = null;
const send = (type, fields={}) => self.postMessage({type,id:currentId,...fields});
const detail = value => {
  if(value instanceof Error) return value.stack || value.message;
  if(typeof value === "string") return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
};
const log = (message,level="info") => send("log",{message,level});
for(const level of ["log","info","warn","error","debug"]){
  const original=console[level].bind(console);
  console[level]=(...args)=>{original(...args);log(args.map(detail).join(" "),level);};
}
self.addEventListener("unhandledrejection",e=>send("fatal",{error:detail(e.reason)}));
self.addEventListener("error",e=>send("fatal",{error:e.message||"Worker runtime error"}));
self.onmessage = ({data}) => {
  currentId=data.id;
  if(!engine){send("result",{error:"Kernel not initialized"});return;}
  const started=performance.now();
  const progress=message=>send("progress",{message,elapsed:Math.round(performance.now()-started)});
  try {
    const result = engine.build(data.source,data.includeMesh,progress);
    progress("Reopening USDA with strict topology validation");
    const checked = engine.roundTrip(result.usda);
    if(checked.length!==result.meshes.length) throw new Error("USDA round-trip changed the object count.");
    for(let i=0;i<checked.length;i++){
      const original=result.meshes[i], recovered=checked[i];
      if(original.volume!==null && (!Number.isFinite(recovered.volume) || Math.abs(recovered.volume-original.volume)>Math.max(1e-5,Math.abs(original.volume)*1e-5))) throw new Error("USDA round-trip volume mismatch on object "+(i+1));
    }
    progress("Round-trip validation passed; sending preview");
    const transfers = result.meshes.flatMap(m=>[m.positions.buffer,m.indices.buffer,...(m.normals?[m.normals.buffer]:[])]);
    self.postMessage({type:"result",id:data.id,...result,checked,elapsed:Math.round(performance.now()-started)},transfers);
  } catch(error) {
    log(detail(error),"error");send("result",{error:String(error?.message||error)});
  } finally {currentId=null;}
};
(async()=>{
  try{
    log("Worker started; loading SMLib WebAssembly module");
    const start=performance.now();
    engine=await import("./model.js");
    engine.installWarnings(message=>log(message,"warn"));
    log("SMLib WASM initialized in "+Math.round(performance.now()-start)+" ms");
    send("ready");
  }catch(error){send("fatal",{error:detail(error)});}
})();

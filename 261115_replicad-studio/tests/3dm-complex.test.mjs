import test from "node:test";
import assert from "node:assert/strict";
import initOC from "replicad-opencascadejs";
import initRhino from "rhino3dm-beta";
import * as replicad from "replicad";
import { DEMOS } from "../examples.js";
import {convertGeneralNurbsBrep} from "../occt-to-rhino-general.js";

test("actual filleted and Boolean-unioned complex demo exports ONE closed Rhino NURBS Brep", {timeout:120000},async()=>{
 const rh=await initRhino();const oc=await initOC();replicad.setOC(oc);
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const brep=convertGeneralNurbsBrep(shape,rh,oc);
 assert.ok(brep,"must create general Brep");
 console.log("COMPLEX RESULT",{
   faces:brep.faces.count,edges:brep.edges.count,loops:brep.loops.count,
   trims:brep.trims.count,solid:brep.isSolid,
   validTopology:brep.isValidTopology(),validGeometry:brep.isValidGeometry()
 });
 assert.equal(brep.isSolid,true);
 assert.equal(brep.isValidTopology()[0],true);
 assert.equal(brep.isValidGeometry()[0],true);
 assert.equal(brep.faces.count,63);
 const doc=new rh.File3dm();doc.objects.addBrep(brep);
 const bytes=doc.toByteArray();
 const reread=rh.File3dm.fromByteArray(bytes);
 assert.ok(reread);
 const imported=[...reread.objects][0].geometry;
 assert.ok(imported instanceof rh.Brep);
 assert.equal(imported.isSolid,true);
 assert.equal(imported.isValidTopology()[0],true);
 console.log("Filleted Boolean demo exact Rhino geometry preserved in .3dm",bytes.length,"bytes");
});

import test from "node:test";
import initOC from "replicad-opencascadejs";
import * as replicad from "replicad";
import initRhino from "rhino3dm-beta";
import { DEMOS } from "../examples.js";
test("probe exact OCCT analytic -> NURBS primitives and rhino constructors", {timeout:120000},async()=>{
 const oc=await initOC();replicad.setOC(oc);const rh=await initRhino();
 const demo=DEMOS.find(x=>x.id==="booleans");
 const {main,defaultParams}=new Function("replicad",demo.source+"\nreturn {main,defaultParams};")(replicad);
 const shape=main(replicad,defaultParams);
 const types=new Map();const pcTypes={};const cTypes={};
 for(const face of shape.faces){
   if(!types.has(face.geomType))types.set(face.geomType,face);else face.delete();
   for(const wire of face.wires){
      for(const edge of wire.edges){
       try{const adaptor=new oc.BRepAdaptor_Curve2d(edge.wrapped,face.wrapped);
         const typ=adaptor.GetType();
         pcTypes[typ]=(pcTypes[typ]||0)+1;adaptor.delete();
       }catch(e){console.log("pcurve adaptor error",e.message)}
       edge.delete();
      }wire.delete();
   }
 }
 for(const edge of shape.edges){cTypes[edge.geomType]=(cTypes[edge.geomType]||0)+1;edge.delete();}
 console.log("Pcurve types",JSON.stringify(pcTypes),"edge types",JSON.stringify(cTypes));
 console.log("Geom_TrimmedCurve constructor",!!oc.Geom_TrimmedCurve,"Geom_BSplineSurface",!!oc.Geom_BSplineSurface);
 for(const [kind,face] of types){
   const geom=oc.BRep_Tool.Surface(face.wrapped);
   const b=face.UVBounds;
   for(const location of [[b.uMin,b.vMin],[b.uMax,b.vMax]]){
     try{const p=geom.Value(...location);console.log(kind,"geom corner",location,[p.X(),p.Y(),p.Z()]);}
     catch(e){console.log(kind,"geom corner ERROR",String(e))}
   }
   if(kind==="CYLINDRE"){
     const props=["Radius","Position","Cylinder","Axis","Location"];
     for(const prop of props){try{const q=geom[prop]();console.log("cylinder",prop,typeof q,q?.constructor?.name);}catch(e){console.log("cylinder",prop,"error",e.message)}}
   }
   if(kind==="SPHERE"||kind==="TORUS"){
     const bs=oc.GeomConvert.SurfaceToBSplineSurface(geom);
     console.log(kind,"U count degree",bs.NbUPoles(),bs.UDegree(),"V",bs.NbVPoles(),bs.VDegree());
     const p=bs.Pole(1,1);console.log(kind,"pole1",p.X(),p.Y(),p.Z(),"weight",bs.Weight(1,1));
   }
   face.delete();
 }
 for(const x of shape.edges.slice(0,10)){
  const data=oc.BRep_Tool.Curve(x.wrapped);
  const {returnValue:base,First:first,Last:last}=data;
  if(x.geomType!=="LINE"){
   console.log("curve",x.geomType,"range",first,last,"base",base?.constructor?.name);
   try {
     const t=new oc.Geom_TrimmedCurve(base,first,last);
     console.log("Geom_TrimmedCurve OK",t?.constructor?.name);
     const bs=oc.GeomConvert.CurveToBSplineCurve(t);
     console.log("trimmed curve to bs",bs.NbPoles(),bs.Degree(),bs.NbKnots());
   } catch(e){console.log("TrimmedCurve FAIL",String(e?.message||e))}
  }
  x.delete();
 }
 const keys=o=>{let s=new Set();for(let q=o,i=0;q&&i<4;q=Object.getPrototypeOf(q),i++)for(let n of Object.getOwnPropertyNames(q))s.add(n);return [...s].sort().filter(x=>/surface|curve|closest|interpol|from|create|projection|revolution|nurbs|point|knot/i.test(x)).join(" ").slice(0,1000)};
 for(let typ of ["NurbsSurface","NurbsCurve","Curve","Surface","Arc","Torus","Sphere","RevSurface","Cylinder","PolylineCurve"])console.log("RHINO TYPE",typ,typeof rh[typ],keys(rh[typ]));
 const n=new rh.NurbsCurve(3,true,3,3);console.log("NurbsCurve ctor",n.degree,n.points?.count,n.knots?.count,n.points?.setPoint?.toString?.().slice(0,100));
});

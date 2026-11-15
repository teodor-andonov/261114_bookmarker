// Build one joined Rhino/openNURBS B-rep from arbitrary supported OCCT
// NURBS geometry, including analytic fillet faces and degenerate pole trims.
// No meshes are involved. 3D curves/surfaces are exact rational NURBS;
// nonaffine 2D UV trim reparameterizations are tolerance-controlled degree-1
// NURBS (not mathematically exact for those trim segments).
import {makeNurbsFace,makeNurbsEdge,makeCircularUvCurve,exactUvPolyline,sampleTrim} from "./occt-nurbs-geometry.js";

const TOL=1e-6;
const point3=a=>({X:a[0],Y:a[1],Z:a[2]});
const xyz=p=>[p.X(),p.Y(),p.Z()];
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const hash=a=>a.map(x=>Math.round(x/TOL)).join(",");
const uvAt=(a,t)=>{const p=a.Value(t);return [p.X(),p.Y()];};
const near=(a,b)=>dist(a,b)<TOL*10;
const signedArea=points=>points.reduce((sum,p,i)=>{
 const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];
},0)*.5;

function orderedWireInUV(edges,face,oc) {
  const pending=edges.map(edge=>{
    const adaptor=new oc.BRepAdaptor_Curve2d(edge.wrapped,face.wrapped);
    const from=adaptor.FirstParameter(),to=adaptor.LastParameter();
    if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from)
      throw new Error("Invalid OpenCascade face trimming curve interval");
    return {edge,adaptor,from,to,a:uvAt(adaptor,from),b:uvAt(adaptor,to)};
  });
  // On a periodic surface, 3D seam points can coincide at *different*
  // UV parameters. Link loops in native 2D UV, not by 3D vertex positions.
  let searchVisits=0;
  const makeOrder=(first,flip)=>{
    const initial=pending[first],start=flip?initial.b:initial.a;
    const result=[{...initial,reverse:flip}];
    const unused=new Set(pending.map((_,i)=>i));unused.delete(first);
    const search=(end)=>{
      // Avoid exponential ambiguity for a malformed or multi-seam wire.
      if(++searchVisits>25000)return false;
      if(!unused.size)return near(end,start);
      for(const i of unused){
        const e=pending[i];
        for(const reverse of [false,true]){
          const entry=reverse?e.b:e.a;
          const exit=reverse?e.a:e.b;
          if(!near(end,entry))continue;
          unused.delete(i);
          result.push({...e,reverse});
          if(search(exit))return true;
          result.pop();unused.add(i);
        }
      }
      return false;
    };
    return search(flip?initial.a:initial.b)?result:null;
  };
  for(let i=0;i<pending.length;i++)for(const reversed of [false,true]){
    const order=makeOrder(i,reversed);
    if(order)return order;
  }
  pending.forEach(e=>e.adaptor.delete?.());
  throw new Error("OpenCascade face wire has disconnected UV trim curves");
}

function buildTrim(item,face,faceData,rhino) {
  const {adaptor,from,to}=item,kind=adaptor.GetType();
  let curve,points;
  const uvMap=t=>faceData.map(uvAt(adaptor,t));
  if(faceData.type==="PLANE"&&kind==="GeomAbs_Circle"){
    const b=face.UVBounds;
    const affine=([u,v])=>[(u-b.uMin)/(b.uMax-b.uMin),(v-b.vMin)/(b.vMax-b.vMin)];
    curve=makeCircularUvCurve(rhino,adaptor,from,to,affine);
    const subdivisions=Math.max(32,Math.ceil(Math.abs(to-from)/(Math.PI/16)));
    points=Array.from({length:subdivisions+1},(_,i)=>uvMap(from+(to-from)*i/subdivisions));
  }else if(faceData.type==="PLANE"&&kind==="GeomAbs_Line"){
    points=[uvMap(from),uvMap(to)];
    curve=new rhino.LineCurve(point3([...points[0],0]),point3([...points[1],0]));
  }else{
    ({curve,points}=sampleTrim(adaptor,faceData,face,rhino));
  }
  if(item.reverse){
    if(!curve.reverse())throw new Error("Could not reverse Rhino UV trim curve");
    points.reverse();
  }
  return {curve,points};
}

function isoFor(points,data,rhino) {
 const [[u0,u1],[v0,v1]]=data.domain;
 const all=(index,value)=>points.every(p=>Math.abs(p[index]-value)<1e-6);
 if(all(0,u0))return rhino.IsoStatus.West;
 if(all(0,u1))return rhino.IsoStatus.East;
 if(all(1,v0))return rhino.IsoStatus.South;
 if(all(1,v1))return rhino.IsoStatus.North;
 return rhino.IsoStatus.None;
}

export function convertGeneralNurbsBrep(shape,rhino,oc) {
 const solids=shape.solids,faces=shape.faces,edges=shape.edges;
 const resources=[];
 try{
  if(solids.length!==1)throw new Error("3DM exporter needs one closed OCCT solid per part");
  const brep=new rhino.Brep();
  const vertices=new Map(),edgeMap=new Map();
  const vertexAt=coords=>{
    const key=hash(coords);
    if(vertices.has(key))return vertices.get(key);
    const vertex=brep.vertices.add(point3(coords),TOL);
    if(!vertex)throw Error("Could not add Rhino B-rep vertex");
    const index=brep.vertices.count-1;
    vertices.set(key,index);return index;
  };

  // Shared topological edges must be created once, before faces and trims.
  for(const edge of edges){
    const key=String(edge.hashCode);
    const spec=makeNurbsEdge(edge,rhino,oc);
    resources.push(spec.curve);
    const a=vertexAt(spec.a),b=vertexAt(spec.b);
    if(spec.singular){
      edgeMap.set(key,{singular:true,vertexIndex:a,xyz:spec.a});
      continue;
    }
    const curveIndex=brep.addEdgeCurve(spec.curve);
    if(curveIndex<0)throw Error("Could not add Rhino 3D NURBS edge");
    const target=brep.edges.add(a,b,curveIndex,TOL);
    if(!target)throw Error("Could not attach Rhino B-rep edge");
    edgeMap.set(key,{index:brep.edges.count-1,a:spec.a,b:spec.b});
  }

  for(let fi=0;fi<faces.length;fi++){
    const face=faces[fi];
    console.log("3DM general: processing face",fi+1,"/",faces.length,face.geomType);
    const data=makeNurbsFace(face,rhino,oc);
    resources.push(data.surface);
    const si=brep.addSurface(data.surface);
    if(si<0)throw Error("Could not add Rhino NURBS face surface");
    const rf=brep.faces.add(si);
    if(!rf)throw Error("Could not add Rhino B-rep face");
    rf.orientationIsReversed=face.orientation==="backward";
    const index=brep.faces.count-1;
    const wires=face.wires;
    const outer=face.clone().outerWire();
    try{
      const oi=wires.findIndex(wire=>wire.isSame(outer));
      if(oi<0)throw Error("Cannot locate OCCT face outer loop");
      if(oi!==0)wires.unshift(wires.splice(oi,1)[0]);
      for(let wi=0;wi<wires.length;wi++){
        const loop=brep.loops.add(wi===0?rhino.BrepLoopType.Outer:rhino.BrepLoopType.Inner,rf);
        if(!loop)throw Error("Could not add Rhino face loop");
        const wireEdges=wires[wi].edges;
        let entries=[];
        try{
          entries=orderedWireInUV(wireEdges,face,oc);
          const curves=entries.map(e=>buildTrim(e,face,data,rhino));
          curves.forEach(c=>resources.push(c.curve));
          let areaPoints=curves.flatMap(c=>c.points.slice(0,-1));
          let area=signedArea(areaPoints);
          if(Math.abs(area)<1e-11)throw Error("Degenerate Rhino UV trimming loop");
          if((area>0)!==(wi===0)){
            entries.reverse();
            curves.reverse();
            for(const item of entries)item.reverse=!item.reverse;
            for(const c of curves){if(!c.curve.reverse())throw Error("Unable to reverse UV loop");c.points.reverse();}
            areaPoints=curves.flatMap(c=>c.points.slice(0,-1));
            area=signedArea(areaPoints);
          }
          for(let ti=0;ti<entries.length;ti++){
            const item=entries[ti],info=curves[ti];
            const ci=brep.addTrimCurve(info.curve);
            if(ci<0)throw Error("Could not add a Rhino UV trim curve");
            const e=edgeMap.get(String(item.edge.hashCode));
            if(!e)throw Error("Missing shared edge topology from OCCT");
            let trim;
            if(e.singular){
              const vertex=brep.vertices.get(e.vertexIndex);
              trim=brep.trims.addSingularTrim(vertex,loop,isoFor(info.points,data,rhino),ci);
            }else{
              const start=data.evaluate(item.reverse?item.b:item.a);
              const rev3d=dist(start,e.a)>dist(start,e.b);
              trim=brep.trims.add(brep.edges.get(e.index),rev3d,loop,ci);
            }
            if(!trim)throw Error("Could not attach Rhino trim");
          }
        }finally{
          const entriesUnique=new Set(entries.map(e=>e.adaptor));
          entriesUnique.forEach(a=>a.delete?.());
          wireEdges.forEach(e=>e.delete());
        }
      }
    }finally{outer.delete();wires.forEach(w=>w.delete());}
  }

  brep.setVertices();
  brep.setTolerancesBoxesAndFlags(false,true,true,true,true,true,true,true);
  const [topology,topoReason]=brep.isValidTopology();
  if(!topology)throw new Error("Rhino B-rep topology invalid: "+topoReason);
  const [geometry,geomReason]=brep.isValidGeometry();
  if(!geometry)throw new Error("Rhino B-rep geometry invalid: "+geomReason);
  if(!brep.isSolid)throw new Error("Rhino B-rep is open; expected closed solid");
  return brep;
 }finally{
  resources.forEach(x=>x?.delete?.());
  [...solids,...faces,...edges].forEach(x=>x.delete());
 }
}

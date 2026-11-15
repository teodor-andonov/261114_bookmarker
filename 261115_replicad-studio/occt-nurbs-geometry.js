// Geometry-level OpenCascade -> Rhino rational NURBS bridge.
// 3D surfaces/edges use exact analytic or B-spline representations.
// 2D trims are generated separately because reparameterizing an analytic
// surface as NURBS changes its UV parameterization (not the 3D geometry).
const point3 = ([X,Y,Z]) => ({X,Y,Z});
const position = p => [p.X(),p.Y(),p.Z()];
const take = vector => {try{return vector.toTuple();}finally{vector.delete();}};
const lerp=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const finite=v=>v.every(Number.isFinite);

function makeSplineSurface(rhino,bs) {
  if(bs.IsUPeriodic()) bs.SetUNotPeriodic();
  if(bs.IsVPeriodic()) bs.SetVNotPeriodic();
  const nu=bs.NbUPoles(),nv=bs.NbVPoles();
  const surf=new rhino.NurbsSurface(3,true,bs.UDegree()+1,bs.VDegree()+1,nu,nv);
  for(let u=0;u<nu;u++)for(let v=0;v<nv;v++){
    const w=bs.Weight(u+1,v+1),p=bs.Pole(u+1,v+1);
    // Rhino's rational setPoint() takes *homogeneous* XYZ, not Euclidean XYZ.
    if(!surf.points.setPoint(u,v,{X:p.X()*w,Y:p.Y()*w,Z:p.Z()*w})||
       !surf.points.setWeight(u,v,w)) throw new Error("Failed to transfer NURBS surface control point");
  }
  const expanded=(count,knot,mult)=>Array.from({length:count},(_,i)=>
    Array.from({length:mult(i+1)},()=>knot(i+1))).flat().slice(1,-1);
  const ku=expanded(bs.NbUKnots(),i=>bs.UKnot(i),i=>bs.UMultiplicity(i));
  const kv=expanded(bs.NbVKnots(),i=>bs.VKnot(i),i=>bs.VMultiplicity(i));
  if(ku.length!==surf.knotsU.count||kv.length!==surf.knotsV.count)
    throw new Error("OpenCascade and Rhino surface knot vector lengths disagree");
  ku.forEach((k,i)=>surf.knotsU.set(i,k));
  kv.forEach((k,i)=>surf.knotsV.set(i,k));
  if(!surf.isValid)throw new Error("Invalid rational Rhino NURBS surface");
  return surf;
}

function makeAnalyticCircleSweep(face,rhino,bounds) {
  // Exact degree-2 rational circular arcs for cylindrical and conical
  // analytic faces, with a degree-1 linear generatrix in V. Angular slices
  // no greater than 90 degrees avoid approximating a circle with polygons.
  const {uMin,uMax,vMin,vMax}=bounds;
  const n=Math.ceil(Math.abs(uMax-uMin)/(Math.PI/2));
  if(n<1||n>64)throw new Error("Invalid cylindrical/conical angular range");
  const segments=[];
  for(let s=0;s<n;s++){
    const start=uMin+(uMax-uMin)*s/n;
    const end=uMin+(uMax-uMin)*(s+1)/n;
    const middle=(start+end)/2;
    const w=Math.cos((end-start)/2);
    if(w<=0)throw new Error("Unsupported angular NURBS sweep");
    segments.push({start,end,middle,w});
  }
  const points=[[],[]],weights=[];
  for(let s=0;s<n;s++){
    const {start,end,middle,w}=segments[s];
    const row=[];
    for(const v of [vMin,vMax]){
      const a=take(face.pointOnSurface(start,v));
      const b=take(face.pointOnSurface(middle,v));
      const c=take(face.pointOnSurface(end,v));
      const control=b.map((m,i)=>(2*(1+w)*m-a[i]-c[i])/(2*w));
      row.push([a,control,c]);
    }
    if(s===0){
      points[0].push(row[0][0],row[0][1],row[0][2]);
      points[1].push(row[1][0],row[1][1],row[1][2]);
      weights.push(1,w,1);
    }else{
      points[0].push(row[0][1],row[0][2]);
      points[1].push(row[1][1],row[1][2]);
      weights.push(w,1);
    }
  }
  const nu=2*n+1,surf=new rhino.NurbsSurface(3,true,3,2,nu,2);
  for(let i=0;i<nu;i++)for(let j=0;j<2;j++){
    const p=points[j][i],w=weights[i];
    if(!surf.points.setPoint(i,j,{X:p[0]*w,Y:p[1]*w,Z:p[2]*w})||
       !surf.points.setWeight(i,j,w))throw new Error("Unable to build exact circular NURBS patch");
  }
  const knots=[];
  for(let i=0;i<=n;i++){
    const t=uMin+(uMax-uMin)*i/n;
    knots.push(...Array(i===0||i===n?2:2).fill(t));
  }
  if(knots.length!==surf.knotsU.count)throw Error("Unexpected circle-sweep knot count");
  knots.forEach((t,i)=>surf.knotsU.set(i,t));
  surf.knotsV.set(0,vMin);
  surf.knotsV.set(1,vMax);
  if(!surf.isValid)throw Error("Invalid cylinder/cone NURBS surface");
  return surf;
}

/** Return a genuine Rhino NURBS face surface with an inverse UV mapper. */
export function makeNurbsFace(face,rhino,oc) {
  const bounds=face.UVBounds,type=face.geomType;
  const {uMin,uMax,vMin,vMax}=bounds;
  if(!finite([uMin,uMax,vMin,vMax])||uMax<=uMin||vMax<=vMin)
    throw new Error("OpenCascade face has invalid UV bounds: "+type);
  let surface;
  if(type==="PLANE") {
    surface=new rhino.NurbsSurface(3,false,2,2,2,2);
    for(let i=0;i<2;i++)for(let j=0;j<2;j++){
      const p=take(face.pointOnSurface(i?uMax:uMin,j?vMax:vMin));
      if(!surface.points.setPoint(i,j,point3(p)))throw Error("Planar control point failed");
    }
    for(let i=0;i<2;i++){surface.knotsU.set(i,i);surface.knotsV.set(i,i);}
  }else if(type==="CYLINDRE"||type==="CONE"){
    surface=makeAnalyticCircleSweep(face,rhino,bounds);
  }else{
    const source=oc.BRep_Tool.Surface(face.wrapped);
    const bs=oc.GeomConvert.SurfaceToBSplineSurface(source);
    surface=makeSplineSurface(rhino,bs);
  }
  const du=surface.domain(0),dv=surface.domain(1);
  const domain=[[du.T0,du.T1],[dv.T0,dv.T1]];
  const map=(uv)=>{
    if(type==="PLANE")
      return [(uv[0]-uMin)/(uMax-uMin),(uv[1]-vMin)/(vMax-vMin)];
    const expected=take(face.pointOnSurface(uv[0],uv[1]));
    let u=Math.max(du.T0,Math.min(du.T1,uv[0]));
    let v=Math.max(dv.T0,Math.min(dv.T1,uv[1]));
    const evaluate=(x,y)=>{const p=surface.pointAt(x,y);return [p.X,p.Y,p.Z];};
    const hu=(du.T1-du.T0)*1e-6,hv=(dv.T1-dv.T0)*1e-6;
    for(let iteration=0;iteration<15;iteration++){
      const p=evaluate(u,v),err=expected.map((x,i)=>x-p[i]);
      if(Math.hypot(...err)<2e-8)return [u,v];
      const pu=evaluate(Math.min(u+hu,du.T1),v);
      const mu=evaluate(Math.max(u-hu,du.T0),v);
      const pv=evaluate(u,Math.min(v+hv,dv.T1));
      const mv=evaluate(u,Math.max(v-hv,dv.T0));
      const au=pu.map((x,i)=>(x-mu[i])/(Math.min(u+hu,du.T1)-Math.max(u-hu,du.T0)));
      const av=pv.map((x,i)=>(x-mv[i])/(Math.min(v+hv,dv.T1)-Math.max(v-hv,dv.T0)));
      const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);
      const aa=dot(au,au),bb=dot(av,av),ab=dot(au,av),det=aa*bb-ab*ab;
      if(det<1e-18)break;
      const ru=dot(au,err),rv=dot(av,err);
      const stepU=(ru*bb-rv*ab)/det,stepV=(rv*aa-ru*ab)/det;
      u=Math.max(du.T0,Math.min(du.T1,u+stepU));
      v=Math.max(dv.T0,Math.min(dv.T1,v+stepV));
    }
    const p=evaluate(u,v);
    if(distance(expected,p)>2e-5)
      throw new Error("Could not map OpenCascade "+type+" UV "+JSON.stringify(uv)+
        " to Rhino UV "+JSON.stringify([u,v])+" within tolerance, distance="+distance(expected,p)+
        " target="+JSON.stringify(expected)+" actual="+JSON.stringify(p));
    return [u,v];
  };
  return {surface,map,domain,type};
}

export function makeNurbsEdge(edge,rhino,oc) {
  const start=take(edge.startPoint),end=take(edge.endPoint);
  if(edge.geomType==="LINE")return {curve:new rhino.LineCurve(point3(start),point3(end)),a:start,b:end};
  const info=oc.BRep_Tool.Curve(edge.wrapped);
  if(!info?.returnValue||!finite([info.First,info.Last]))throw new Error(
    "OCCT edge lacks 3D curve ("+edge.geomType+") endpoints "+JSON.stringify([start,end])+
    " param limits "+JSON.stringify([info?.First,info?.Last]));
  const trimmed=new oc.Geom_TrimmedCurve(info.returnValue,info.First,info.Last);
  const bs=oc.GeomConvert.CurveToBSplineCurve(trimmed);
  if(bs.IsPeriodic())bs.SetNotPeriodic();
  const curve=new rhino.NurbsCurve(3,true,bs.Degree()+1,bs.NbPoles());
  for(let i=0;i<bs.NbPoles();i++){
    const p=bs.Pole(i+1),w=bs.Weight(i+1);
    if(!curve.points.setPoint(i,{X:p.X()*w,Y:p.Y()*w,Z:p.Z()*w})||
       !curve.points.setWeight(i,w))throw Error("Cannot assign exact 3D NURBS edge");
  }
  const knots=Array.from({length:bs.NbKnots()},(_,i)=>
    Array.from({length:bs.Multiplicity(i+1)},()=>bs.Knot(i+1))).flat().slice(1,-1);
  if(knots.length!==curve.knots.count)throw Error("OCCT edge knot count mismatch");
  knots.forEach((x,i)=>curve.knots.set(i,x));
  const a=Object.values(curve.pointAtStart),b=Object.values(curve.pointAtEnd);
  if(!finite(a)||!finite(b)||distance(a,b)<0&&false)throw Error("Invalid NURBS edge control net");
  return {curve,a,b};
}

/** Construct rational exact planar circular UV arcs as native Rhino NURBS. */
export function makeCircularUvCurve(rhino,adaptor,start,end,transform) {
  const n=Math.max(1,Math.ceil(Math.abs(end-start)/(Math.PI/2)));
  const poles=[],weights=[];
  const uv=t=>{const p=adaptor.Value(t);return transform([p.X(),p.Y()]);};
  for(let s=0;s<n;s++){
    const a=start+(end-start)*s/n,c=start+(end-start)*(s+1)/n;
    const mid=(a+c)/2,w=Math.cos((c-a)/2);
    const p0=uv(a),pm=uv(mid),p1=uv(c);
    const pc=pm.map((v,i)=>(2*(1+w)*v-p0[i]-p1[i])/(2*w));
    if(s===0){poles.push(p0,pc,p1);weights.push(1,w,1);}
    else {poles.push(pc,p1);weights.push(w,1);}
  }
  const cv=new rhino.NurbsCurve(3,true,3,poles.length);
  for(let i=0;i<poles.length;i++){
    const [u,v]=poles[i],w=weights[i];
    cv.points.setPoint(i,{X:u*w,Y:v*w,Z:0});cv.points.setWeight(i,w);
  }
  const knots=[];
  for(let i=0;i<=n;i++)knots.push(...Array(2).fill(start+(end-start)*i/n));
  knots.forEach((k,i)=>cv.knots.set(i,k));
  return cv;
}

export function exactUvPolyline(rhino,points) {
  const cv=new rhino.NurbsCurve(3,false,2,points.length);
  for(let i=0;i<points.length;i++){
    if(!cv.points.setPoint(i,{X:points[i][0],Y:points[i][1],Z:0}))
      throw new Error("Unable to construct UV NURBS polyline");
    cv.knots.set(i,i);
  }
  return cv;
}

export function sampleTrim(adaptor,faceData,face,rhino,{tolerance=5e-5,maxDepth=9}={}) {
  const first=adaptor.FirstParameter(),last=adaptor.LastParameter();
  if(!finite([first,last])||last<=first)throw Error("Invalid 2D trim domain");
  const mapped=t=>{
    const p=adaptor.Value(t);
    return faceData.map([p.X(),p.Y()]);
  };
  const sourcePoint=t=>{
    const p=adaptor.Value(t);
    return take(face.pointOnSurface(p.X(),p.Y()));
  };
  const sample=(t0,p0,t1,p1,depth)=>{
    const mid=(t0+t1)/2,pm=mapped(mid);
    const between=lerp(p0,p1,.5);
    const point=faceData.surface.pointAt(...between);
    const original=sourcePoint(mid);
    const error=distance([point.X,point.Y,point.Z],original);
    if(error<tolerance)return [p1];
    if(depth>=maxDepth)throw new Error("2D NURBS trimming curve exceeds conversion tolerance");
    return [...sample(t0,p0,mid,pm,depth+1),...sample(mid,pm,t1,p1,depth+1)];
  };
  const p0=mapped(first),p1=mapped(last);
  const points=[p0,...sample(first,p0,last,p1,0)];
  return {points,curve:exactUvPolyline(rhino,points)};
}

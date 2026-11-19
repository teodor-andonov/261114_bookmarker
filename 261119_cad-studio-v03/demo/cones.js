// Explicit semantic IDs. Values live in cones.js.params.json. All dimensions in mm.
function main(cad,p){
  console.log('Building paired circular volumes');
  const lower=cad.drawCircle(p.radius).sketchOnPlane('XY').extrude(p.height,{extrusionProfile:{profile:'linear',endFactor:.6}});
  const upper=cad.drawCircle(p.radius*.6).sketchOnPlane('XY',p.height+p.gap).extrude(p.height*.75,{extrusionProfile:{profile:'linear',endFactor:p.topRatio}});
  return [
   {id:'lower',name:'Lower cone',group:'Tapered volumes',color:'#6f9db8',properties:{radius:p.radius,height:p.height},shape:lower},
   {id:'upper',name:'Upper cone',group:'Tapered volumes',color:'#d8b98a',properties:{gap:p.gap},shape:upper}
  ];
}
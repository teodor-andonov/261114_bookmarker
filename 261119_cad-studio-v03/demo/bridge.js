// Boolean-cut structural concept. Dimensions mm.
function main(cad,p){
 const block=cad.makeBaseBox(p.span,p.depth,p.height);
 const opening=cad.makeBaseBox(p.span*.58,p.depth*2,p.height*.65).translate([0,0,-p.height*.05]);
 let arch=block.cut(opening);
 if(p.round)arch=arch.fillet(p.filletRadius);
 const deck=cad.makeBaseBox(p.span*1.08,p.depth*1.2,p.height*.14).translate([0,0,p.height]);
 return [{id:'pier',name:'Cut structural body',group:'Bridge',color:'#a7b7c5',shape:arch},{id:'deck',name:'Deck plate',group:'Bridge',color:'#d2a875',shape:deck}];
}
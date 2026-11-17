import test from "node:test";
import assert from "node:assert/strict";
import {parseMayaAscii} from "../maya-parser.js";
import {applyMayaAppearance} from "../maya-appearance.js";
import {layerCatalog,objectLayerKey} from "../layers.js";

const mesh=name=>[
  'createNode transform -n "'+name+'";',
  'createNode mesh -n "'+name+'Shape" -p "'+name+'";',
  'setAttr -s 4 ".vt[0:3]" -type "float3" 0 0 0 1 0 0 1 1 0 0 1 0;',
  'setAttr -s 4 ".ed[0:3]" 0 1 1 1 2 1 2 3 1 3 0 1;',
  'setAttr ".fc[0]" -type "polyFaces" f 4 0 1 2 3;'
].join("\n");
const scene=[
  mesh("A"),mesh("B"),
  'createNode displayLayer -n "Facades";',
  'setAttr ".ovrgbf" yes;',
  'setAttr ".ovrgb" -type "float3" 0.1 0.2 0.3;',
  'createNode displayLayer -n "EmptyLayer";',
  'createNode lambert -n "redMat";',
  'setAttr ".c" -type "float3" 0.9 0.2 0.1;',
  'createNode shadingEngine -n "redMatSG";',
  'connectAttr -f "Facades.di" "A.do";',
  'connectAttr -f "redMat.oc" "redMatSG.ss";',
  'connectAttr -na "AShape.iog" "redMatSG.dsm";'
].join("\n");
test("Maya display layers, not transforms, and assigned material RGB",()=>{
  const parsed=applyMayaAppearance(parseMayaAscii(scene),scene);
  assert.equal(parsed.objects.length,2);
  const a=parsed.objects.find(o=>o.name==="A");
  const b=parsed.objects.find(o=>o.name==="B");
  assert.equal(a.layerName,"Facades");
  assert.equal(b.layerName,"Default");
  assert.equal(a.materialName,"redMat");
  assert.deepEqual(a.materialColor,{r:230,g:51,b:26});
  assert.deepEqual(a.layerColor,{r:26,g:51,b:77});
  assert.equal(b.materialName,null);
  const layers=layerCatalog(parsed.objects,parsed.displayLayers);
  assert.deepEqual(layers.map(l=>l.name),["Facades","EmptyLayer","Default"]);
  assert.equal(layers.find(l=>l.name==="Facades").count,1);
  assert.equal(layers.find(l=>l.name==="EmptyLayer").count,0);
});
test("mesh display override connection and standardSurface base colour",()=>{
  const src=mesh("ShapeOwner")+
    '\ncreateNode displayLayer -n "Direct";\n'+
    'createNode standardSurface -n "blueMat";\n'+
    'setAttr ".baseColor" -type "float3" 0.1 0.5 0.9;\n'+
    'createNode shadingEngine -n "blueSG";\n'+
    'connectAttr "Direct.drawInfo" "ShapeOwnerShape.drawOverride";\n'+
    'connectAttr "blueMat.outColor" "blueSG.surfaceShader";\n'+
    'connectAttr "ShapeOwnerShape.instObjGroups[0]" "blueSG.dagSetMembers[0]";';
  const parsed=applyMayaAppearance(parseMayaAscii(src),src);
  assert.equal(parsed.objects[0].layerName,"Direct");
  assert.deepEqual(parsed.objects[0].materialColor,{r:26,g:128,b:230});
});
test("layer RGB fallback and original shader colours remain separate",()=>{
  const src=mesh("A")+
    '\ncreateNode displayLayer -n "Uncoloured";\n'+
    'connectAttr "Uncoloured.di" "A.do";';
  const parsed=applyMayaAppearance(parseMayaAscii(src),src);
  assert.equal(parsed.objects[0].materialColor,null);
  const layers=layerCatalog(parsed.objects,parsed.displayLayers);
  assert.equal(layers.length,1);
  assert.equal(layers[0].name,"Uncoloured");
  assert.ok(layers[0].color.r>=0);
});
test("Maya drawInfo on parent is inherited by child mesh",()=>{
  const src=mesh("A")+
    '\ncreateNode displayLayer -n "ParentLayer";\n'+
    'connectAttr "ParentLayer.di" "A.do";';
  const p=applyMayaAppearance(parseMayaAscii(src),src);
  assert.equal(objectLayerKey(p.objects[0]),"ParentLayer");
});

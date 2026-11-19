// Explicit composition root. The generic core imports no domain packages.
export const catalog={
 file:()=>import('./packages/file/index.js'),text:()=>import('./packages/text/index.js'),
 'file-explorer':()=>import('./packages/file-explorer/index.js'),'code-editor':()=>import('./packages/code-editor/index.js'),
 model:()=>import('./packages/model/index.js'),rhino:()=>import('./packages/rhino/index.js'),
 replicad:()=>import('./packages/replicad/index.js'),'model-explorer':()=>import('./packages/model-explorer/index.js'),
 'model-viewer':()=>import('./packages/model-viewer/index.js'),'object-inspector':()=>import('./packages/object-inspector/index.js'),
 'selection-observer':()=>import('./packages/selection-observer/index.js')
};
export const defaults=Object.keys(catalog).filter(id=>id!=='selection-observer');
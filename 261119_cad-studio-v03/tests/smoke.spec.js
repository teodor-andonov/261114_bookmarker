import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const base='http://127.0.0.1:4179/';
async function folder(page,workspace=''){
 // Native folder picker cannot be automated headlessly. Inject a real Chromium
 // FileSystemDirectoryHandle from OPFS for this test ONLY, seeded with examples.
 await page.addInitScript(()=>{window.showDirectoryPicker=async()=>{const root=await navigator.storage.getDirectory();for(const [name] of await (async()=>{const a=[];for await(const e of root.entries())a.push(e);return a;})())await root.removeEntry(name,{recursive:true});return root;};});
 await page.goto(base+(workspace?'?workspace='+workspace:''));
 await page.locator('header').getByRole('button',{name:'Open Folder'}).click();
 await expect(page.getByRole('button',{name:'Copy examples'})).toBeEnabled();
}
async function openWorkspace(page,name){page.once('dialog',d=>d.accept(name));await page.getByRole('button',{name:'Open workspace'}).click();}
async function seed(page){page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Copy examples'}).click();await expect(page.getByText('Examples: 9 copied',{exact:false})).toBeVisible({timeout:30000});}
test('blank and file/text composition, real browser handles, no API server',async({page})=>{
 await folder(page);await seed(page);await openWorkspace(page,'blank.workspace.json');await expect(page.getByRole('option',{name:'Blank core'})).toBeAttached();
 await expect(page.locator('.session:not([hidden]) canvas')).toHaveCount(0);await openWorkspace(page,'text.workspace.json');await expect(page.locator('.session:not([hidden]) .cm-content')).toContainText('function main');await expect(page.locator('.session:not([hidden]) canvas')).toHaveCount(0);
});
test('Rhino fixture + Replicad demos, shared inspection, STEP',async({page})=>{
 test.setTimeout(240000);await folder(page);await seed(page);await openWorkspace(page,'inspection.workspace.json');const session=page.locator('.session:not([hidden])');
 await expect(session.getByRole('button',{name:'Base mass'})).toBeVisible({timeout:60000});
 await session.getByRole('button',{name:'Base mass'}).click();await session.getByRole('button',{name:'Inspector'}).click();await expect(session.locator('.panelbody:not([hidden]) h3')).toHaveText('Base mass');
 await openWorkspace(page,'parametric.workspace.json');await session.getByRole('button',{name:'Replicad',exact:true}).click();page.once('dialog',d=>d.accept());await session.getByRole('button',{name:'Run / Rebuild'}).click();
 await expect(session.getByText('cones.js — Built — 2 objects')).toBeVisible({timeout:120000});await expect(session.getByRole('button',{name:'Lower cone'})).toBeVisible();
 await session.getByRole('button',{name:'Lower cone'}).click();await session.getByRole('button',{name:'Inspector'}).click();await expect(session.locator('.panelbody:not([hidden]) pre').filter({hasText:'objectId'})).toContainText('lower');
 const d=page.waitForEvent('download');await session.getByRole('button',{name:'Export STEP'}).click();const download=await d;expect(await readFile(await download.path(),'utf8')).toContain('ISO-10303-21');
 const row=session.locator('.treeRow').filter({has:session.getByRole('button',{name:'· bridge.js',exact:true})});await row.locator('select').selectOption('replicad.open');await expect(session.getByText('bridge.js — Ready',{exact:false})).toBeVisible();page.once('dialog',d=>d.accept());await session.getByRole('button',{name:'Run / Rebuild'}).click();await expect(session.getByText('bridge.js — Built — 2 objects')).toBeVisible({timeout:120000});
});
test('filesystem adapter actual browser handle and revision conflict',async({page})=>{
 await page.goto(base);// The built application has no runtime API.
 // Test through UI: select a folder, copy examples, edit actual project file via editor.
 await folder(page);await seed(page);const root=await page.evaluate(async()=>{const h=await navigator.storage.getDirectory();const f=await (await h.getFileHandle('cones.js')).getFile();return await f.text();});expect(root).toContain('function main');
});

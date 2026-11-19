import {test,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdtemp,cp,rm} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
let server,token,root;
test.beforeAll(async()=>{root=await mkdtemp(path.join(os.tmpdir(),'cad-studio-browser-'));await cp('demo',root,{recursive:true});server=spawn(process.execPath,['server.mjs',root],{stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.stdout.on('data',b=>{const m=String(b).match(/#token=([a-f0-9-]+)/);if(m){token=m[1];clearTimeout(timer);resolve();}});server.on('exit',code=>{clearTimeout(timer);reject(Error('Server exit '+code));});});});
test.afterAll(async()=>{server?.kill();if(root)await rm(root,{recursive:true,force:true});});
test('empty and file/text compositions',async({page})=>{await page.goto('http://127.0.0.1:4179/?workspace=blank.workspace.json#token='+token);await expect(page.getByRole('option',{name:'Blank core'})).toBeAttached();await expect(page.locator('canvas')).toHaveCount(0);await page.goto('http://127.0.0.1:4179/?workspace=text.workspace.json#token='+token);await expect(page.locator('.cm-content')).toContainText('function main');await expect(page.locator('canvas')).toHaveCount(0);});
test('Rhino fixture + Replicad demos use shared inspection; STEP downloads',async({page})=>{
 test.setTimeout(240000);page.on('dialog',d=>d.accept());await page.goto('http://127.0.0.1:4179/?workspace=inspection.workspace.json#token='+token);
 await expect(page.getByRole('button',{name:'Base mass'})).toBeVisible({timeout:60000});
 await page.getByRole('button',{name:'Base mass'}).click();await page.getByRole('button',{name:'Inspector'}).click();await expect(page.locator('.panelbody:not([hidden]) pre')).toContainText('Base mass',{timeout:5000});
 await page.getByRole('button',{name:'Model tree'}).click();
 // Open another workspace, this one stays independent.
 await page.goto('http://127.0.0.1:4179/?workspace=parametric.workspace.json#token='+token);
 await page.getByRole('button',{name:'Replicad',exact:true}).click();await page.getByRole('button',{name:'Run / Rebuild'}).click();
 await expect(page.getByText('cones.js — Built — 2 objects')).toBeVisible({timeout:120000});
 await expect(page.getByRole('button',{name:'Lower cone'})).toBeVisible();await page.getByRole('button',{name:'Lower cone'}).click();await page.getByRole('button',{name:'Inspector'}).click();await expect(page.locator('.panelbody:not([hidden]) pre').filter({hasText:'objectId'})).toContainText('lower');
 const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export STEP'}).click();const download=await d;const contents=await readFile(await download.path(),'utf8');expect(contents).toContain('ISO-10303-21');
 await page.getByRole('button',{name:'Source',exact:true}).click(); // accepted default remains current
 // Explicitly open the second source via the registered File Explorer action.
 const row=page.locator('.treeRow').filter({has:page.getByRole('button',{name:'· bridge.js',exact:true})});
 await row.locator('select').selectOption('replicad.open');await expect(page.getByText('bridge.js — Ready', {exact:false})).toBeVisible();await page.getByRole('button',{name:'Run / Rebuild'}).click();await expect(page.getByText('bridge.js — Built — 2 objects')).toBeVisible({timeout:120000});
});

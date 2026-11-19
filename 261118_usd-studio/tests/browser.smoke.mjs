import test from "node:test";
import assert from "node:assert/strict";
import {chromium} from "playwright";
import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname} from "node:path";
const root=resolve("build"),prefix="/261114_testlab/261118_usd-studio/";
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".wasm":"application/wasm",".json":"application/json"};
test("production browser worker initializes, logs stages and exports USDA under Pages subpath",{timeout:200000},async()=>{
  const server=createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url,"http://localhost").pathname;
      if(!pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
      const file=resolve(root,pathname.slice(prefix.length)||"index.html");
      if(!file.startsWith(root+"/")){res.writeHead(403);return res.end();}
      const bytes=await readFile(file);
      res.writeHead(200,{"Content-Type":mime[extname(file)]||"application/octet-stream"});res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  let browser,page;const capture=[];
  try{
    browser=await chromium.launch({args:["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
    page=await browser.newPage();
    page.on("console",m=>capture.push(m.type()+": "+m.text()));
    page.on("pageerror",e=>capture.push("PAGE ERROR: "+e.stack));
    page.on("requestfailed",r=>capture.push("REQUEST FAILED: "+r.url()+" "+r.failure()?.errorText));
    page.on("response",r=>{if(r.status()>=400)capture.push(r.status()+" "+r.url());});
    await page.goto("http://127.0.0.1:"+server.address().port+prefix);
    await page.waitForFunction(()=>document.querySelector("#export").disabled===false,{},{timeout:65000});
    const log=await page.locator("#engineLog").textContent();
    for(const line of ["Worker started","WASM initialized","Running main","Tessellating","Serializing native USDA","Round-trip validation passed","complete"])assert.ok(log.includes(line),line);
    console.log(log);
    assert.match(await page.locator("#usda").textContent(),/BrepArray/);
    await page.click("#stop");
    assert.equal(await page.locator("#export").isDisabled(),true);
    await page.click("#run");
    await page.waitForFunction(()=>document.querySelector("#export").disabled===false,{},{timeout:30000});
    assert.match(await page.locator("#status").textContent(),/Ready/);
    await page.setViewportSize({width:691,height:900});
    await page.click("#commands");await page.locator("#search").fill("Fluid twist tower");
    await page.getByRole("button",{name:"Demo: Fluid twist tower",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector("#export").disabled===false,{},{timeout:60000});
    assert.match(await page.locator("#name").textContent(),/fluid-twist-tower/);
    assert.match(await page.locator("#status").textContent(),/Ready/);
    assert.match(await page.locator("#usda").textContent(),/BrepArray/);
    await page.click("#commands");await page.locator("#search").fill("Galaxy SOHO");
    await page.getByRole("button",{name:"Demo: Galaxy SOHO — architectural study",exact:true}).click();
    await page.waitForFunction(()=>document.querySelector("#export").disabled===false,{},{timeout:95000});
    assert.match(await page.locator("#stats").textContent(),/objects/);
    assert.match(await page.locator("#usda").textContent(),/Tower_A_Rounded_Roof_Crown/);
    console.log("Galaxy browser model:",await page.locator("#stats").textContent());
  }catch(e){console.error(capture.join("\n"));if(page)console.error("ENGINE LOG:",await page.locator("#engineLog").textContent().catch(()=>""),"STATUS:",await page.locator("#status").textContent().catch(()=>""));throw e;}
  finally{await browser?.close();await new Promise(r=>server.close(r));}
});

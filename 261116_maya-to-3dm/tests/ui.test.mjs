import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../style.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../app.js",import.meta.url),"utf8");

test("flat solid viewport with no radial gradient",()=>{
  assert.match(css,/\.viewer\{[^}]*background:\s*#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(css,/radial-gradient/i);
});
test("sidebar height and disclosures allow natural scrolling",()=>{
  assert.match(css,/\.sidebar\{[^}]*overflow-y:auto/);
  assert.doesNotMatch(css,/max-height:calc\(100dvh\s*-\s*66px\)/);
  assert.match(css,/\.details\[open\] summary/);
  assert.match(css,/\.details-body\{/);
});
test("UI uses unique IDs for controls and counters",()=>{
  for(const id of ["layer-list","objects","warnings","layer-filter","export-visible","object-count","face-count","layer-count","unit-label"]){
    assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  }
  assert.doesNotMatch(app,/layer-count-small/);
  assert.doesNotMatch(html,/class="workflow"/);
});

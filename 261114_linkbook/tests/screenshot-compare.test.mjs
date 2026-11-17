import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateScreenshotTarget, thumImageUrl, THUM_DEFAULTS } from '../screenshot-compare.js';

const target = 'https://example.org/articles/architecture?section=3';

test('Thum.io default screenshot captures the first 750 pixels at 1200px viewport', () => {
  assert.deepEqual(THUM_DEFAULTS, {width:600,crop:750,format:'auto',maxAge:24});
  assert.equal(thumImageUrl(target),
    'https://image.thum.io/get/width/600/crop/750/maxAge/24/noanimate/'+target);
});

test('Thum.io controls change output width, capture height, format and cache age', () => {
  assert.equal(
    thumImageUrl(target, {width:400,crop:900,format:'jpg',maxAge:168}),
    'https://image.thum.io/get/width/400/crop/900/maxAge/168/allowJPG/noanimate/'+target
  );
  assert.equal(
    thumImageUrl(target, {width:1200,crop:1200,format:'png',maxAge:0}),
    'https://image.thum.io/get/width/1200/crop/1200/maxAge/0/png/noanimate/'+target
  );
});

test('rejects invalid options instead of sending malformed requests', () => {
  assert.throws(()=>thumImageUrl(target,{width:0}),/Output width/);
  assert.throws(()=>thumImageUrl(target,{crop:1300}),/Capture height/);
  assert.throws(()=>thumImageUrl(target,{format:'gif'}),/format/);
  assert.throws(()=>thumImageUrl(target,{maxAge:-1}),/Cache maximum age/);
});

test('reject local and private hosts and unsafe URL protocols', () => {
  for (const url of [
    'http://localhost:3000/',
    'http://127.0.0.1/',
    'http://10.11.12.13/',
    'http://172.20.5.4/',
    'http://192.168.1.1/',
    'http://169.254.0.1/',
    'http://test.local/',
    'file:///etc/passwd',
    'javascript:alert(1)'
  ]) assert.throws(() => validateScreenshotTarget(url));
  assert.equal(
    validateScreenshotTarget('https://example.org/path?utm_source=x&ok=yes'),
    'https://example.org/path?ok=yes'
  );
});

test('the screenshot preview is activated by one palette command, not toolbar buttons', () => {
  const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.js', import.meta.url),'utf8');
  const adapter=readFileSync(new URL('../screenshot-compare.js', import.meta.url),'utf8');
  assert.match(html,/id="screenshotCompareDialog"/);
  assert.match(html,/id="thumImage"/);
  assert.match(html,/id="thumWidth"/);
  assert.match(html,/id="thumCrop"/);
  assert.match(html,/id="thumFormat"/);
  assert.match(html,/id="thumMaxAge"/);
  assert.match(html,/id="screenshotCompareForm"/);
  assert.match(app,/label:'Preview screenshot with Thum.io'/);
  assert.match(app,/run:openScreenshotPreview/);
  assert.match(app,/function previewScreenshot\(\)/);
  assert.doesNotMatch(html,/<button[^>]*id="screenshot/i);
  assert.doesNotMatch(html+app+adapter,/microlink/i);
});

test('Defuddle extraction continues independently of screenshot preview', () => {
  const app=readFileSync(new URL('../app.js', import.meta.url),'utf8');
  assert.match(app,/getMetadata/);
  assert.match(app,/refreshAllBookmarks/);
  assert.match(app,/contentMarkdown/);
});

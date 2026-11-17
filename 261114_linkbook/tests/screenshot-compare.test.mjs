import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateScreenshotTarget, microlinkRequestUrl, thumImageUrl,
  parseMicrolinkResult, SCREENSHOT_VIEWPORT
} from '../screenshot-compare.js';

const target = 'https://example.org/articles/architecture?section=3';

test('both services are configured to capture the same first viewport only', () => {
  assert.deepEqual(SCREENSHOT_VIEWPORT, {width:1200, height:750});
  const microlink = new URL(microlinkRequestUrl(target));
  assert.equal(microlink.hostname, 'api.microlink.io');
  assert.equal(microlink.searchParams.get('url'), target);
  assert.equal(microlink.searchParams.get('viewport.width'),'1200');
  assert.equal(microlink.searchParams.get('viewport.height'),'750');
  assert.equal(microlink.searchParams.get('viewport.deviceScaleFactor'),'1');
  assert.equal(microlink.searchParams.get('screenshot.fullPage'),'false');
  assert.equal(microlink.searchParams.get('screenshot.type'),'jpeg');
  assert.equal(microlink.searchParams.get('screenshot'),'true');
  assert.equal(microlink.searchParams.get('meta'),'false');

  const thum = thumImageUrl(target);
  assert.equal(thum,'https://image.thum.io/get/width/600/crop/750/noanimate/'+target);
});

test('reject local/private hosts and unsafe protocols without contacting third parties', () => {
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
  assert.equal(validateScreenshotTarget('https://example.org/path?utm_source=x&ok=yes'),
    'https://example.org/path?ok=yes');
});

test('validate Microlink JSON responses and report quota/network errors', () => {
  const image='https://microlink-cdn.s3.amazonaws.com/s/example.jpg';
  assert.deepEqual(parseMicrolinkResult({
    status:'success',data:{screenshot:{url:image,width:1200,height:750,type:'jpg'}}
  }), {url:image,width:1200,height:750,format:'jpg'});
  assert.throws(() => parseMicrolinkResult({status:'success', data:{}}),/did not return/);
  assert.throws(() => parseMicrolinkResult({status:'fail',code:'ERATE',message:'Free limit reached'}),/ERATE/);
  assert.throws(() => parseMicrolinkResult({status:'success',data:{screenshot:{url:'javascript:alert(1)'}}}),/did not return/);
});

test('screenshot comparison is only initiated from a command, with no new toolbar buttons', () => {
  const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
  const app=readFileSync(new URL('../app.js', import.meta.url),'utf8');
  assert.match(html,/id="screenshotCompareDialog"/);
  assert.match(html,/id="microlinkImage"/);
  assert.match(html,/id="thumImage"/);
  assert.match(app,/label:'Compare screenshots: Microlink vs Thum\.io'/);
  assert.match(app,/run:openScreenshotComparison/);
  assert.match(app,/async function compareScreenshots\(\)/);
  assert.match(html,/id="screenshotCompareForm"/);
  assert.match(html,/id="screenshotCompareUrl"/);
  assert.doesNotMatch(html,/<button[^>]*id="screenshot/i);
  assert.match(app,/controller\.signal/);
});

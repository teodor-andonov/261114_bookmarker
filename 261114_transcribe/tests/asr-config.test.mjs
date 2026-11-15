import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_ID, CACHE_KEY, speechWindows, audioStats, isNearlySilent, levelAudio, asrOptions } from '../asr-config.js';
import { TRANSCRIBE_CACHE, OLD_SHARED_CACHE, isOldTranscribeModelRequest, deleteTranscribeModels } from '../model-cache.js';
import { readFileSync } from 'node:fs';

test('Tiny English is the only model and UI has no stale picker', () => {
  assert.equal(MODEL_ID,'onnx-community/whisper-tiny.en');
  assert.equal(CACHE_KEY,TRANSCRIBE_CACHE);
  const html = readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const app = readFileSync(new URL('../app.js',import.meta.url),'utf8');
  assert.match(html,/Whisper Tiny · English/);
  assert.doesNotMatch(html,/modelSelect|languageSelect|Whisper Base · English|Whisper Small · English/);
  assert.match(html,/id="clearModelButton"/);
  assert.match(app,/clearModelButton/);
});
test('decoding configuration avoids timestamp and multilingual restrictions', () => {
  const opts = asrOptions();
  assert.equal(opts.return_timestamps,false);
  for(const forbidden of ['task','language','is_multilingual','chunk_length_s','stride_length_s']) assert.equal(forbidden in opts,false);
});
test('audio segments never overlap, and short tails are merged', () => {
  const samples=new Float32Array(50*16000);
  const windows=speechWindows(samples);
  assert.equal(windows.length,3);
  assert.deepEqual(windows.map(w=>[w.start,w.end]),[[0,24],[24,48],[48,50]]);
  for(let i=1;i<windows.length;i++)assert.equal(windows[i].start,windows[i-1].end);
  assert.deepEqual(speechWindows(new Float32Array(27*16000)).map(x=>[x.start,x.end]),[[0,27]]);
  assert.deepEqual(speechWindows(new Float32Array(10*16000)).map(x=>[x.start,x.end]),[[0,10]]);
});
test('silence detection and quiet-gain correction are controlled', () => {
  const silent=audioStats(new Float32Array(100));
  assert.equal(isNearlySilent(silent),true);
  const quiet=new Float32Array(100).fill(0.008);
  const stats=audioStats(quiet);
  assert.equal(isNearlySilent(stats),false);
  const boosted=levelAudio(quiet,stats);
  assert.ok(boosted.gain>1 && boosted.gain<=4);
  assert.ok(boosted.audio.every(x=>x<=0.95));
  assert.throws(()=>speechWindows(new Float32Array()),/no samples/);
});
test('only known legacy model URLs match; sibling app cache entries stay untouched', () => {
  assert.equal(isOldTranscribeModelRequest('https://huggingface.co/onnx-community/whisper-base.en/resolve/main/onnx/model.onnx'),true);
  assert.equal(isOldTranscribeModelRequest('https://huggingface.co/onnx-community/whisper-tiny.en/resolve/main/config.json'),true);
  assert.equal(isOldTranscribeModelRequest('https://huggingface.co/other/model/resolve/main/onnx/model.onnx'),false);
  assert.equal(isOldTranscribeModelRequest('https://evil.example/onnx-community/whisper-small.en/resolve/main/model.onnx'),false);
});
test('cleanup only deletes our cache and specific old model keys',async()=>{
  const model='https://huggingface.co/onnx-community/whisper-small.en/resolve/main/model.onnx';
  const unrelated='https://huggingface.co/another-app/keep/resolve/main/model.onnx';
  const stores=new Map([[TRANSCRIBE_CACHE,new Set(['some-model-file'])],[OLD_SHARED_CACHE,new Set([model,unrelated])],['testlab-gallery-v2',new Set(['gallery'])]]);
  const fake={
    keys:async()=>[...stores.keys()],
    open:async key=>({
      keys:async()=>[...(stores.get(key)||new Set)].map(url=>({url})),
      delete:async request=>(stores.get(key)||new Set).delete(request.url)
    }),
    delete:async key=>stores.delete(key)
  };
  const result=await deleteTranscribeModels(fake);
  assert.equal(result.removedFiles,2);
  assert.equal(stores.has(TRANSCRIBE_CACHE),false);
  assert.ok(stores.get(OLD_SHARED_CACHE).has(unrelated));
  assert.ok(stores.get('testlab-gallery-v2').has('gallery'));
});

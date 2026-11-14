import test from 'node:test';
import assert from 'node:assert/strict';
import {formatClock,formatSrtClock,sanitizeSegments,makeSrt,safeDownloadStem,formatBytes} from '../transcript-utils.js';
test('clock formatting',()=>{
  assert.equal(formatClock(65.9),'01:05');
  assert.equal(formatClock(3661),'1:01:01');
  assert.equal(formatSrtClock(65.125),'00:01:05,125');
});
test('validates timestamp chunks and makes subtitles',()=>{
  const chunks=[{timestamp:[0,2.5],text:' Hello world '},{timestamp:[2.5,null],text:' Again'},{timestamp:[3,1],text:''},{timestamp:[-1,0],text:'no'}];
  assert.deepEqual(sanitizeSegments(chunks),[{start:0,end:2.5,text:'Hello world'},{start:2.5,end:4.5,text:'Again'}]);
  assert.match(makeSrt(chunks),/00:00:00,000 --> 00:00:02,500/);
  assert.match(makeSrt(chunks),/2\n00:00:02,500 --> 00:00:04,500\nAgain/);
});
test('file utilities',()=>{
  assert.equal(safeDownloadStem('a?b.mp3'),'a_b');
  assert.equal(formatBytes(1200000),'1.2 MB');
  assert.equal(formatBytes(1020),'1 KB');
});

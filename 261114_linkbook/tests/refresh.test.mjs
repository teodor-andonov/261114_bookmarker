import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeEnrichment } from '../refresh.js';

const original = {
  id:'a',url:'https://example.org/a',createdAt:'2026-11-10T12:00:00.000Z',
  updatedAt:'2026-11-11T12:00:00.000Z',
  title:'Old title',image:'https://example.org/old.jpg',notes:'My original notes',
  tags:['Keep me'],coverMode:'custom',coverData:'data:image/png;base64,aGVsbG8=',
  metadataSource:'page'
};

test('refresh changes extracted content but never clobbers personal bookmark data', () => {
  const result=mergeEnrichment(original, {
    title:'New title',description:'New description',image:'https://example.org/new.jpg',
    contentMarkdown:'# Article\nText',metadataSource:'defuddle-api',
    author:'Name',metadataError:'',url:'https://attacker.invalid/',notes:'External notes',
    tags:['Injected'],id:'new-id',createdAt:'bad'
  }, '2026-11-16T12:00:00.000Z');
  assert.equal(result.id,original.id);
  assert.equal(result.url,original.url);
  assert.equal(result.notes,original.notes);
  assert.deepEqual(result.tags,original.tags);
  assert.equal(result.createdAt,original.createdAt);
  assert.equal(result.coverData,original.coverData);
  assert.equal(result.title,'New title');
  assert.equal(result.image,'https://example.org/new.jpg');
  assert.match(result.contentMarkdown,/Article/);
  assert.equal(result.updatedAt,'2026-11-16T12:00:00.000Z');
});

test('failed refresh retains all previous metadata while tracking the error', () => {
  const result=mergeEnrichment(original,{
    metadataSource:'basic',title:'URL slug',image:'',
    metadataCheckedAt:'2026-11-16T13:00:00.000Z',metadataError:'HTTP 429'
  });
  assert.equal(result.title,original.title);
  assert.equal(result.image,original.image);
  assert.equal(result.updatedAt,original.updatedAt);
  assert.equal(result.metadataError,'HTTP 429');
  assert.equal(result.metadataCheckedAt,'2026-11-16T13:00:00.000Z');
});

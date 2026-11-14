import test from 'node:test';
import assert from 'node:assert/strict';
import { coverIdentity, coverImage, isLocalCover } from '../cover.js';

test('simple covers derive domain and page title without colours or patterns', () => {
  const a = coverIdentity({url:'https://www.example.com/one',title:'One interesting article'});
  const b = coverIdentity({url:'https://example.com/two',title:'Another article'});
  assert.equal(a.host, 'example.com');
  assert.equal(a.host, b.host);
  assert.equal(a.title, 'One interesting article');
  assert.equal(b.title, 'Another article');
  assert.deepEqual(Object.keys(a).sort(), ['host', 'title']);
});

test('graphic cover overrides a real remote image', () => {
  const bookmark = {url:'https://example.com',image:'https://example.com/photo.jpg',coverMode:'graphic'};
  assert.equal(coverImage(bookmark),'');
  assert.equal(coverImage({...bookmark,coverMode:'auto'}),'https://example.com/photo.jpg');
});

test('custom cover chooses local image over custom remote image', () => {
  const data='data:image/png;base64,aGVsbG8=';
  assert.ok(isLocalCover(data));
  const b={url:'https://example.com',image:'https://example.com/photo.png',coverMode:'custom',customCoverUrl:'https://cdn.example.com/other.jpg',coverData:data};
  assert.equal(coverImage(b),data);
  assert.equal(coverImage({...b,coverData:''}),'https://cdn.example.com/other.jpg');
});

test('custom cover rejects SVG and scriptable data URLs', () => {
  assert.equal(isLocalCover('data:image/svg+xml;base64,PHN2Zz4='),false);
  assert.equal(isLocalCover('data:text/html;base64,PHA+'),false);
});

test('missing page titles fall back to the domain', () => {
  assert.equal(coverIdentity({url:'https://github.com/org/repo'}).title, 'github.com');
  assert.equal(coverIdentity({url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}).host, 'youtube.com');
});

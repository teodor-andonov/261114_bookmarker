import test from 'node:test';
import assert from 'node:assert/strict';
import { coverIdentity, coverImage, isLocalCover } from '../cover.js';

test('same website has a stable colour identity and distinct page editions', () => {
  const a = coverIdentity({url:'https://example.com/one',title:'One'});
  const b = coverIdentity({url:'https://example.com/two',title:'Two'});
  assert.equal(a.tone,b.tone);
  assert.equal(a.brand, b.brand);
  assert.notEqual(a.edition, b.edition);
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

test('classifies common sources for recognisable cards', () => {
  assert.equal(coverIdentity({url:'https://github.com/org/repo'}).kind,'CODE');
  assert.equal(coverIdentity({url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}).kind,'VIDEO');
  assert.equal(coverIdentity({url:'https://example.com/file.pdf'}).kind,'DOCUMENT');
});

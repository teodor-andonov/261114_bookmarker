import test from 'node:test';
import assert from 'node:assert/strict';
import { coverIdentity, coverImage, isLocalCover } from '../cover.js';

test('simple covers derive domain and title, including old bookmarks', () => {
  const a = coverIdentity({url:'https://www.example.com/one',title:'One interesting article'});
  const b = coverIdentity({url:'https://example.com/two',title:'Another article'});
  assert.equal(a.host, 'example.com');
  assert.equal(a.host, b.host);
  assert.equal(a.title, 'One interesting article');
  assert.equal(b.title, 'Another article');
  assert.deepEqual(Object.keys(a).sort(), ['host', 'title']);
});
test('only the automatically extracted image is used for covers', () => {
  const bookmark = {
    url:'https://example.com',
    image:'https://example.com/automatic.jpg',
    coverMode:'graphic',
    coverData:'data:image/png;base64,aGVsbG8=',
    customCoverUrl:'https://example.com/manual.jpg'
  };
  assert.equal(coverImage(bookmark),'https://example.com/automatic.jpg');
  assert.equal(coverImage({...bookmark, image:''}), '');
});
test('legacy manual image data remains recognisable for backup compatibility', () => {
  assert.equal(isLocalCover('data:image/png;base64,aGVsbG8='),true);
  assert.equal(isLocalCover('data:image/svg+xml;base64,PHN2Zz4='),false);
  assert.equal(isLocalCover('data:text/html;base64,PHA+'),false);
});
test('cover never uses unsafe image protocols', () => {
  assert.equal(coverImage({url:'https://example.com',image:'javascript:alert(1)'}),'');
});
test('missing page titles fall back to the domain', () => {
  assert.equal(coverIdentity({url:'https://github.com/org/repo'}).title, 'github.com');
  assert.equal(coverIdentity({url:'https://www.youtube.com/watch?v=aaaaaaaaaaa'}).host, 'youtube.com');
});

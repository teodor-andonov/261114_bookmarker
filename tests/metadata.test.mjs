import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl, safeImageUrl, fallbackMetadata, youtubeVideoId, parsePublicationDate, urlFromShare, guessTitle } from '../metadata.js';
test('normalizes web links and removes tracking parameters', () => {
  assert.equal(normalizeUrl('https://example.org/posts/a?utm_source=ads&chapter=3#section'), 'https://example.org/posts/a?chapter=3');
  assert.throws(() => normalizeUrl('javascript:alert(1)'), /Only http/);
  assert.throws(() => normalizeUrl('example.org'), /full URL/);
});
test('parses YouTube video thumbnails and rejects malformed IDs', () => {
  const u = new URL('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(youtubeVideoId(u), 'dQw4w9WgXcQ');
  assert.equal(fallbackMetadata(u.href).image, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(youtubeVideoId(new URL('https://youtube.com/watch?v=nope')), '');
});
test('extracts a URL from Android share text', () => {
  assert.equal(urlFromShare({title:'Interesting article', text:'Interesting article https://example.com/page?utm_medium=app.'}), 'https://example.com/page');
  assert.equal(urlFromShare({text:'no link'}), '');
});
test('keeps remote image URLs safe', () => {
  assert.equal(safeImageUrl('//cdn.example.com/image.png','https://example.org/'), 'https://cdn.example.com/image.png');
  assert.equal(safeImageUrl('javascript:alert(1)', 'https://example.org/'), '');
});
test('publication date must be a real calendar date', () => {
  assert.equal(parsePublicationDate('2026-11-14T10:00:00Z'), '2026-11-14');
  assert.equal(parsePublicationDate('2026-02-31'), '');
});
test('guesses a readable title, never claims missing publication data', () => {
  assert.equal(guessTitle('https://example.com/posts/hello-world'), 'hello world');
  assert.equal(fallbackMetadata('https://example.com/').published, '');
});

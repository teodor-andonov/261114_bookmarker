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


test('reads Defuddle frontmatter and ignores the Markdown body', async () => {
  const { parseDefuddleFrontmatter } = await import('../metadata.js');
  const data = parseDefuddleFrontmatter('---\ntitle: "Design: \\"New\\" ideas"\ndomain: "example.org"\nsite: "Example Magazine"\nauthor: "Jane Doe"\npublished: 2026-11-15\ndescription: "An introduction."\n---\n\n# Article\n\ncontent');
  assert.equal(data.title, 'Design: "New" ideas');
  assert.equal(data.domain, 'example.org');
  assert.equal(data.site, 'Example Magazine');
  assert.equal(data.published, '2026-11-15');
  assert.equal(data.content, undefined);
  assert.equal(parseDefuddleFrontmatter('No YAML here'), null);
});

test('one hosted request enriches title, description, author and site but keeps favicon fallback', async () => {
  const { getMetadata } = await import('../metadata.js');
  const previous = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Response('---\ntitle: "Actual Article Title"\ndomain: "example.org"\nsite: "Example Magazine"\nauthor: "Jane Doe"\npublished: 2026-11-15\ndescription: "Useful article"\n---\n\nFull text');
    };
    const data = await getMetadata('https://example.org/news/article');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://defuddle.md/https://example.org/news/article');
    assert.equal(calls[0].options.credentials, 'omit');
    assert.equal(data.title, 'Actual Article Title');
    assert.equal(data.description, 'Useful article');
    assert.equal(data.author, 'Jane Doe');
    assert.equal(data.published, '2026-11-15');
    assert.equal(data.siteName, 'Example Magazine');
    assert.equal(data.favicon, 'https://example.org/favicon.ico');
    assert.equal(data.image, '');
    assert.equal(data.metadataSource, 'defuddle-api');
  } finally { globalThis.fetch = previous; }
});

test('a failed Defuddle API call preserves usable metadata with one request', async () => {
  const { getMetadata } = await import('../metadata.js');
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('rate limited', { status: 429 });
    const fallback = await getMetadata('https://example.org/hello-world');
    assert.equal(fallback.title, 'hello world');
    assert.equal(fallback.metadataSource, 'basic');
  } finally { globalThis.fetch = previous; }
});

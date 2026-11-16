import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const theme = readFileSync(new URL('../testlab-theme.css', import.meta.url), 'utf8');

test('missing image renders an empty preview, without generated graphic content', () => {
  const markup = app.slice(app.indexOf('function coverMarkup('), app.indexOf('function cardHtml('));
  assert.match(markup, /const photo = coverImage\(bookmark\)/);
  assert.match(markup, /: ''\}/);
  assert.doesNotMatch(markup, /simple-cover|favicon|coverIdentity/);
});

test('the title remains present below an empty cover in both grid and list views', () => {
  assert.match(app, /<h3 title=/);
  assert.doesNotMatch(css, /no-cover-image\s+\.bookmark-body\s+h3\s*\{\s*display:\s*none/);
  assert.match(css, /\.bookmark-card \.preview \{background:transparent\}/);
  assert.match(theme, /\.bookmark-card \.preview \{background:transparent\}/);
});

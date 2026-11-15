import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGLISH_MODELS, asrOptions } from '../asr-config.js';

test('offers only English-trained model checkpoints', () => {
  assert.deepEqual(Object.keys(ENGLISH_MODELS), ['base', 'small']);
  assert.equal(ENGLISH_MODELS.base.id, 'onnx-community/whisper-base.en');
  assert.equal(ENGLISH_MODELS.small.id, 'onnx-community/whisper-small.en');
});

test('English-only generation never sets language or task', () => {
  for (const seconds of [8, 28, 29, 30, 65]) {
    const options = asrOptions(seconds * 16000);
    assert.equal('task' in options, false);
    assert.equal('language' in options, false);
    assert.equal('is_multilingual' in options, false);
    assert.equal(options.return_timestamps, true);
  }
});

test('short clips avoid chunk seam duplication', () => {
  const options = asrOptions(12 * 16000);
  assert.equal('chunk_length_s' in options, false);
  assert.equal('stride_length_s' in options, false);
});

test('long clips use smaller overlaps and mild repetition control', () => {
  const options = asrOptions(150 * 16000);
  assert.equal(options.chunk_length_s, 25);
  assert.equal(options.stride_length_s, 2);
  assert.ok(options.repetition_penalty > 1 && options.repetition_penalty < 1.15);
  assert.equal(options.no_repeat_ngram_size, 5);
});

test('empty audio is rejected', () => {
  assert.throws(() => asrOptions(0), /no samples/);
});

test('English model picker matches engine keys and provides model hint', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const picker = html.split('id="modelSelect">')[1]?.split('</select>')[0] || '';
  const optionValues = [...picker.matchAll(/<option value="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(optionValues, Object.keys(ENGLISH_MODELS));
  assert.match(html, /id="modelHint"/);
  assert.doesNotMatch(html, /id="languageSelect"|Whisper Tiny · Multilingual|WHISPER TINY/);
});

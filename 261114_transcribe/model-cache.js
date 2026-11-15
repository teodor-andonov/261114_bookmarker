// Browser Cache Storage is shared across GitHub Pages project repositories.
// Only delete OUR own named cache or exact legacy Whisper model URLs.
export const TRANSCRIBE_CACHE = 'testlab-transcribe-models-v1';
export const OLD_SHARED_CACHE = 'transformers-cache';
const OLD_MODELS = new Set([
  'whisper-tiny', 'whisper-tiny.en', 'whisper-base.en', 'whisper-small.en'
]);

export function isOldTranscribeModelRequest(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname !== 'huggingface.co') return false;
    const pieces = decodeURIComponent(url.pathname).split('/').filter(Boolean);
    return pieces[0] === 'onnx-community' && OLD_MODELS.has(pieces[1]) && pieces[2] === 'resolve';
  } catch {return false;}
}

// Never call caches.delete(OLD_SHARED_CACHE): other apps may use it.
export async function deleteTranscribeModels(cacheStorage) {
  const available = await cacheStorage.keys();
  let removedFiles = 0;
  let removedPrivate = false;
  if (available.includes(TRANSCRIBE_CACHE)) {
    const cache = await cacheStorage.open(TRANSCRIBE_CACHE);
    removedFiles += (await cache.keys()).length;
    removedPrivate = await cacheStorage.delete(TRANSCRIBE_CACHE);
  }
  if (available.includes(OLD_SHARED_CACHE)) {
    const shared = await cacheStorage.open(OLD_SHARED_CACHE);
    for (const request of await shared.keys()) {
      if (isOldTranscribeModelRequest(request.url) && await shared.delete(request)) removedFiles++;
    }
  }
  return {removedFiles, removedPrivate};
}


// Inspect only Transcribe's private cache and the older Transformers.js default.
// File counts are reliable for these named Cache Storage entries; byte sizes and
// copies in the browser's ordinary HTTP cache aren't visible via this API.
export async function inspectTranscribeModels(cacheStorage) {
  const names = await cacheStorage.keys();
  const current = {count:0, exists:names.includes(TRANSCRIBE_CACHE)};
  const previous = Object.fromEntries([...OLD_MODELS].sort().map(name=>[name,0]));
  let previousCount = 0;
  if (current.exists) {
    const dedicated = await cacheStorage.open(TRANSCRIBE_CACHE);
    current.count = (await dedicated.keys()).length;
  }
  if (names.includes(OLD_SHARED_CACHE)) {
    const shared = await cacheStorage.open(OLD_SHARED_CACHE);
    for (const entry of await shared.keys()) {
      if (!isOldTranscribeModelRequest(entry.url)) continue;
      const url = new URL(entry.url);
      const model = decodeURIComponent(url.pathname).split('/').filter(Boolean)[1];
      previous[model]++;
      previousCount++;
    }
  }
  return {
    currentFiles: current.count, legacyFiles: previousCount,
    legacyByModel: previous, totalFiles: current.count + previousCount
  };
}

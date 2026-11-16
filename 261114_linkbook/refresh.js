// Deliberate one-way merge: Defuddle can only replace extracted page fields.
// Never overwrite identity, URL, local notes, tags, or legacy backup fields.
const EXTRACTED_FIELDS = [
  'title','description','author','siteName','published','image','favicon',
  'contentMarkdown','metadataSource','metadataCheckedAt','metadataError'
];

export function mergeEnrichment(current, result, updatedAt = new Date().toISOString()) {
  if (!current || !result) throw new TypeError('Bookmark and metadata are required.');
  if (result.metadataSource !== 'defuddle-api') {
    return {
      ...current,
      metadataCheckedAt: result.metadataCheckedAt || current.metadataCheckedAt || '',
      metadataError: result.metadataError || 'No metadata returned'
    };
  }
  const fields = Object.fromEntries(
    EXTRACTED_FIELDS.filter(key => Object.hasOwn(result, key)).map(key => [key, result[key]])
  );
  return { ...current, ...fields, updatedAt };
}

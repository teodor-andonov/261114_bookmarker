// Minimal text/favicon fallback. No generated colours or patterns.
const LOCAL_COVER_RE = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i;
const LOCAL_COVER_LIMIT = 1_500_000; // characters; keeps JSON backups manageable.

export function isLocalCover(value) {
  return typeof value === 'string' && value.length <= LOCAL_COVER_LIMIT && LOCAL_COVER_RE.test(value);
}

export function coverIdentity(bookmark) {
  const host = new URL(bookmark.url).hostname.replace(/^www\./i, '').toLowerCase();
  return { host, title: String(bookmark.title || host).trim().slice(0, 180) };
}

// Single cover strategy: extracted article image or the neutral favicon/title/domain graphic.
// Legacy manual cover fields remain in IndexedDB/JSON backups but are no longer rendered.
export function coverImage(bookmark) {
  return validHttpImage(bookmark.image, bookmark.url);
}

function validHttpImage(value, baseUrl) {
  try {
    if (!value) return '';
    const u = new URL(String(value), baseUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
}

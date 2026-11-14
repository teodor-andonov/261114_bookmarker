// Covers are rendered from text + CSS. No network access, external service, or stored image is required.
const tones = 8;
const patterns = 6;
const LOCAL_COVER_RE = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/i;
const LOCAL_COVER_LIMIT = 1_500_000; // characters; keeps JSON backups manageable.

export function coverHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function isLocalCover(value) {
  return typeof value === 'string' && value.length <= LOCAL_COVER_LIMIT && LOCAL_COVER_RE.test(value);
}

export function coverIdentity(bookmark) {
  const url = new URL(bookmark.url);
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  const source = host.split('.')[0] || 'WEB';
  const site = String(bookmark.siteName || '').trim();
  const brand = (site && site.toLowerCase() !== host ? site : source.replace(/[-_]/g, ' ')).slice(0, 24);
  let kind = 'WEB PAGE';
  if (/(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com)$/.test(host)) kind = 'VIDEO';
  else if (host === 'github.com' || host === 'gitlab.com') kind = 'CODE';
  else if (/\.(pdf)$/i.test(url.pathname)) kind = 'DOCUMENT';
  else if (/\/(article|story|blog|post|news|journal|read)\//i.test(url.pathname) || /medium\.com|substack\.com/.test(host)) kind = 'ARTICLE';
  const siteHash = coverHash(host);
  const pageHash = coverHash(url.pathname + url.search);
  return {
    host,
    brand: brand.toUpperCase(),
    kind,
    tone: siteHash % tones,
    pattern: pageHash % patterns,
    edition: String(pageHash % 100).padStart(2, '0'),
    title: String(bookmark.title || brand || host).trim().slice(0, 100)
  };
}

export function coverImage(bookmark) {
  const mode = ['auto','graphic','custom'].includes(bookmark.coverMode) ? bookmark.coverMode : 'auto';
  if (mode === 'graphic') return '';
  if (mode === 'custom') {
    if (isLocalCover(bookmark.coverData)) return bookmark.coverData;
    return validHttpImage(bookmark.customCoverUrl, bookmark.url);
  }
  return validHttpImage(bookmark.image, bookmark.url);
}

function validHttpImage(value, baseUrl) {
  try {
    if (!value) return '';
    const u = new URL(String(value), baseUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch { return ''; }
}

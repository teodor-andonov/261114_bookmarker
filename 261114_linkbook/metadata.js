// No proxy or private backend: direct browser requests only. Most external HTML is blocked by CORS.
const HTTP = new Set(['http:', 'https:']);

export function normalizeUrl(raw) {
  let url;
  try { url = new URL(String(raw).trim()); }
  catch { throw new Error('Enter a full URL starting with https:// or http://.'); }
  if (!HTTP.has(url.protocol)) throw new Error('Only http:// and https:// links can be saved.');
  url.hash = '';
  // Remove only common advertising parameters. Keep meaningful query strings intact.
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}

export function safeImageUrl(value, base) {
  if (!value) return '';
  try {
    const url = new URL(String(value), base);
    return HTTP.has(url.protocol) ? url.href : '';
  } catch { return ''; }
}

export function guessTitle(urlString) {
  const url = new URL(urlString);
  const segments = url.pathname.split('/').filter(Boolean);
  let slug = segments.at(-1) || '';
  try { slug = decodeURIComponent(slug); } catch { /* malformed percent encoding */ }
  slug = slug.replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (slug && slug.length > 2 && !/^\d+$/.test(slug)) return slug.slice(0, 120);
  return url.hostname.replace(/^www\./, '');
}

export function fallbackMetadata(urlString, sharedTitle = '') {
  const u = new URL(urlString);
  const siteName = u.hostname.replace(/^www\./, '');
  const yt = youtubeVideoId(u);
  return {
    title: sharedTitle && !/^https?:\/\//i.test(sharedTitle) ? sharedTitle.trim().slice(0, 500) : guessTitle(urlString),
    description: '',
    image: yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '',
    favicon: safeImageUrl('/favicon.ico', u.origin),
    siteName, author: '', published: '', metadataSource: 'basic'
  };
}

export function youtubeVideoId(u) {
  const hostname = u.hostname.replace(/^www\./, '').toLowerCase();
  let id = '';
  if (hostname === 'youtu.be') id = u.pathname.split('/')[1] || '';
  if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else if (/^\/(shorts|live|embed)\//.test(u.pathname)) id = u.pathname.split('/')[2] || '';
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
}

// Defuddle's hosted API returns Markdown with a small, flat YAML frontmatter block.
// Only its metadata is retained; the article body is not saved in Linkbook.
// The public API intentionally does not include image and favicon fields.
export function parseDefuddleFrontmatter(markdown) {
  if (typeof markdown !== 'string' || !markdown.startsWith('---')) return null;
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || match[1].length > 20_000) return null;
  const metadata = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!item) continue;
    let value = item[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    metadata[item[1].toLowerCase()] = value;
  }
  return metadata;
}

export function parsePublicationDate(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{4}-\d{2}-\d{2})(?!\d)/);
  if (!match) return '';
  const date = new Date(`${match[1]}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(match[1]) ? match[1] : '';
}

// One optional hosted metadata provider, with no app-managed backend or API key.
// Failures leave the immediately saved bookmark intact with a readable fallback.
export async function getMetadata(urlString, sharedTitle = '') {
  const basic = fallbackMetadata(urlString, sharedTitle);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('https://defuddle.md/' + urlString, {
      mode: 'cors', credentials: 'omit', signal: controller.signal
    });
    if (!response.ok) throw new Error('Defuddle HTTP ' + response.status);
    const metadata = parseDefuddleFrontmatter(await response.text());
    if (!metadata || ![metadata.title, metadata.description, metadata.author, metadata.site].some(Boolean)) {
      return basic;
    }
    return {
      ...basic,
      title: String(metadata.title || basic.title).trim().slice(0, 500),
      description: String(metadata.description || '').trim().slice(0, 5000),
      author: String(metadata.author || '').trim().slice(0, 300),
      siteName: String(metadata.site || metadata.domain || basic.siteName).trim().slice(0, 200),
      published: parsePublicationDate(metadata.published),
      // The hosted response omits favicon and hero image; preserve local fallbacks.
      metadataSource: 'defuddle-api'
    };
  } catch (error) {
    console.warn('Defuddle metadata unavailable:', error);
    return basic;
  } finally {
    clearTimeout(timeout);
  }
}

export function urlFromShare({ url = '', text = '', title = '' } = {}) {
  for (const candidate of [url, text, title]) {
    const match = String(candidate).match(/https?:\/\/[^\s<>"']+/i);
    if (!match) continue;
    // Sharing apps may append punctuation after URLs.
    const stripped = match[0].replace(/[),.;!?]+$/, '');
    try { return normalizeUrl(stripped); } catch { /* ignore invalid */ }
  }
  return '';
}

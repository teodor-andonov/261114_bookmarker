// Local-first storage. Metadata is optionally fetched from Defuddle's public hosted API.
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

// Defuddle returns YAML frontmatter followed by cleaned article Markdown.
// Image URLs are not separately exposed by its hosted response. We can only
// use pictures included in the extracted article, not guaranteed hero images.
export function parseDefuddleResponse(markdown) {
  if (typeof markdown !== 'string' || !markdown.startsWith('---')) return null;
  const matched = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!matched || matched[1].length > 20_000) return null;
  const metadata = Object.create(null);
  for (const line of matched[1].split(/\r?\n/)) {
    const item = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!item) continue;
    let value = item[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    metadata[item[1].toLowerCase()] = value;
  }
  return {
    metadata,
    contentMarkdown: markdown.slice(matched[0].length).trim().slice(0, 100_000)
  };
}

// Retain the old exported parsing helper for compatibility with prototype tests.
export function parseDefuddleFrontmatter(markdown) {
  return parseDefuddleResponse(markdown)?.metadata || null;
}

export function firstArticleImage(markdown, pageUrl) {
  if (!markdown) return '';
  // Prefer an image from Defuddle's actual cleaned article Markdown.
  const links = /!\[[^\]]{0,200}\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g;
  for (const match of markdown.matchAll(links)) {
    const raw = match[1] || match[2] || '';
    const safe = safeImageUrl(raw, pageUrl);
    if (!safe) continue;
    const pathname = new URL(safe).pathname.toLowerCase();
    if (/\.(?:svg|ico)(?:$|\?)/i.test(pathname) || /(?:favicon|avatar|badge|sprite|tracking|pixel|logo)/i.test(pathname)) continue;
    return safe;
  }
  return '';
}

export function articleExcerpt(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_~`|]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 320);
}

export function parsePublicationDate(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{4}-\d{2}-\d{2})(?!\d)/);
  if (!match) return '';
  const date = new Date(match[1] + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(match[1]) ? match[1] : '';
}

export async function getMetadata(urlString, sharedTitle = '') {
  const basic = fallbackMetadata(urlString, sharedTitle);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch('https://defuddle.md/' + urlString, {
      mode: 'cors', credentials: 'omit', signal: controller.signal
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const parsed = parseDefuddleResponse(await response.text());
    if (!parsed) throw new Error('No readable metadata returned');
    const {metadata, contentMarkdown} = parsed;
    if (![metadata.title, metadata.description, metadata.author].some(Boolean) && !contentMarkdown) {
      throw new Error('No useful article content returned');
    }
    return {
      ...basic,
      title: String(metadata.title || basic.title).trim().slice(0, 500),
      description: String(metadata.description || articleExcerpt(contentMarkdown)).trim().slice(0, 5000),
      author: String(metadata.author || '').trim().slice(0, 300),
      siteName: String(metadata.site || metadata.domain || basic.siteName).trim().slice(0, 200),
      published: parsePublicationDate(metadata.published),
      image: basic.image || firstArticleImage(contentMarkdown, urlString),
      // YouTube's predictable thumbnail remains the only domain-specific fallback.
      contentMarkdown,
      metadataSource: 'defuddle-api',
      metadataCheckedAt: checkedAt,
      metadataError: ''
    };
  } catch (error) {
    const reason = error.name === 'AbortError' ? 'Request timed out' : (error.message || 'Request failed');
    return {...basic, metadataCheckedAt: checkedAt, metadataError: reason};
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

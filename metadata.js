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

const pick = (doc, selectors) => {
  for (const selector of selectors) {
    const el = doc.querySelector(selector);
    const value = el?.getAttribute('content') || el?.getAttribute('href') || '';
    if (value.trim()) return value.trim();
  }
  return '';
};

function ldEntities(payload) {
  if (Array.isArray(payload)) return payload.flatMap(ldEntities);
  if (!payload || typeof payload !== 'object') return [];
  const nested = Array.isArray(payload['@graph']) ? payload['@graph'].flatMap(ldEntities) : [];
  return [payload, ...nested];
}

function jsonLdMetadata(doc) {
  for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const entities = ldEntities(JSON.parse(el.textContent || 'null'));
      const article = entities.find(x => /article|posting|recipe/i.test([].concat(x['@type'] || []).join(','))) || entities[0];
      if (!article) continue;
      const author = Array.isArray(article.author) ? article.author[0] : article.author;
      return {
        author: typeof author === 'string' ? author : author?.name || '',
        published: article.datePublished || '',
        image: Array.isArray(article.image) ? article.image[0] : (typeof article.image === 'object' ? article.image?.url : article.image),
        description: article.description || '',
        title: article.headline || article.name || ''
      };
    } catch { /* invalid JSON-LD is common */ }
  }
  return {};
}

export function extractMetadataFromHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ld = jsonLdMetadata(doc);
  const title = pick(doc, ['meta[property="og:title"]', 'meta[name="twitter:title"]']) || ld.title || doc.querySelector('title')?.textContent?.trim() || '';
  const description = pick(doc, ['meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]']) || ld.description || '';
  const image = pick(doc, ['meta[property="og:image:secure_url"]', 'meta[property="og:image"]', 'meta[name="twitter:image"]']) || ld.image || '';
  const favicon = pick(doc, ['link[rel~="icon"]', 'link[rel="apple-touch-icon"]']);
  const author = pick(doc, ['meta[name="author"]', 'meta[property="article:author"]', 'meta[name="twitter:creator"]']) || ld.author || '';
  const published = pick(doc, ['meta[property="article:published_time"]', 'meta[name="date"]', 'meta[itemprop="datePublished"]']) || ld.published || '';
  const siteName = pick(doc, ['meta[property="og:site_name"]']) || new URL(baseUrl).hostname.replace(/^www\./, '');
  return {
    title: String(title).trim().slice(0, 500),
    description: String(description).trim().slice(0, 5000),
    image: safeImageUrl(typeof image === 'string' ? image : '', baseUrl),
    favicon: safeImageUrl(favicon, baseUrl),
    author: String(author).trim().slice(0, 300),
    published: parsePublicationDate(published),
    siteName: String(siteName).slice(0, 200),
    metadataSource: 'page'
  };
}

export function parsePublicationDate(value) {
  if (!value) return '';
  const match = String(value).match(/(\d{4}-\d{2}-\d{2})(?!\d)/);
  if (!match) return '';
  const date = new Date(`${match[1]}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(match[1]) ? match[1] : '';
}

async function fetchDirectMetadata(urlString, signal) {
  const response = await fetch(urlString, { mode: 'cors', credentials: 'omit', signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!/html|xml/i.test(type)) throw new Error('Page does not expose HTML.');
  const html = await response.text();
  return extractMetadataFromHtml(html.slice(0, 2_000_000), response.url || urlString);
}

async function fetchGitHubRepoMetadata(urlString, signal) {
  const url = new URL(urlString);
  if (url.hostname.toLowerCase() !== 'github.com') return null;
  const [owner, repo, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo || rest.length > 0 || ['topics', 'settings', 'orgs', 'features', 'marketplace', 'login', 'signup'].includes(owner.toLowerCase())) return null;
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo.replace(/\.git$/,''))}`, {
    headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit', signal
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data?.full_name) return null;
  return {
    title: data.full_name,
    description: (data.description || '').slice(0, 5000),
    author: data.owner?.login || '',
    siteName: 'GitHub',
    favicon: 'https://github.com/favicon.ico',
    image: '',
    published: '', // repo creation date is not a publication date
    metadataSource: 'github-api'
  };
}

export async function getMetadata(urlString, sharedTitle = '') {
  const basic = fallbackMetadata(urlString, sharedTitle);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    let enriched = null;
    try { enriched = await fetchGitHubRepoMetadata(urlString, controller.signal); } catch { /* continue */ }
    if (!enriched) enriched = await fetchDirectMetadata(urlString, controller.signal);
    return { ...basic, ...Object.fromEntries(Object.entries(enriched).filter(([key, value]) => key === 'metadataSource' || Boolean(value))) };
  } catch {
    return basic;
  } finally { clearTimeout(timeout); }
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

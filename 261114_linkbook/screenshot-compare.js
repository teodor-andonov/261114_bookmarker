import { normalizeUrl, safeImageUrl } from './metadata.js';

export const SCREENSHOT_VIEWPORT = Object.freeze({ width: 1200, height: 750 });

export function validateScreenshotTarget(rawUrl) {
  const url = normalizeUrl(rawUrl);
  const {hostname} = new URL(url);
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      host === '0.0.0.0' || host === '::1' ||
      /^127\./.test(host) || /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error('Screenshots require a public website URL (not a local or private address).');
  }
  return url;
}

// Screenshot-only request (no duplicate metadata or full-page capture).
export function microlinkRequestUrl(targetUrl) {
  const target = validateScreenshotTarget(targetUrl);
  const api = new URL('https://api.microlink.io/');
  for (const [key, value] of Object.entries({
    url: target,
    screenshot: 'true',
    'screenshot.fullPage': 'false',
    'screenshot.type': 'jpeg',
    'screenshot.quality': '75',
    'viewport.width': String(SCREENSHOT_VIEWPORT.width),
    'viewport.height': String(SCREENSHOT_VIEWPORT.height),
    'viewport.deviceScaleFactor': '1',
    meta: 'false'
  })) api.searchParams.set(key, value);
  return api.href;
}

// Free Thum.io uses a 1200px viewport. crop/750 captures only the first screen,
// width/600 scales it for inexpensive previews, and noanimate waits for the final frame.
export function thumImageUrl(targetUrl) {
  const target = validateScreenshotTarget(targetUrl);
  return 'https://image.thum.io/get/width/600/crop/750/noanimate/' + target;
}

export function parseMicrolinkResult(payload) {
  if (!payload || payload.status !== 'success') {
    const code = String(payload?.code || '');
    const message = String(payload?.message || payload?.data?.message || 'Screenshot unavailable');
    throw new Error([code, message].filter(Boolean).join(' — ').slice(0, 240));
  }
  const image = safeImageUrl(payload.data?.screenshot?.url);
  if (!image) throw new Error('Microlink did not return a screenshot URL.');
  return {
    url: image,
    width: Number(payload.data.screenshot.width) || null,
    height: Number(payload.data.screenshot.height) || null,
    format: String(payload.data.screenshot.type || '')
  };
}

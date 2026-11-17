import { normalizeUrl } from './metadata.js';

// Thum.io free tier uses a fixed 1200px-wide browser viewport.
// width controls the returned image size; crop controls pixels taken from the
// original screen. Neither option changes the rendered responsive breakpoint.
export const THUM_DEFAULTS = Object.freeze({
  width: 600,
  crop: 750,
  format: 'auto',
  maxAge: 24
});

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

function integerOption(value, fallback, min, max, label) {
  const selected = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(selected) || selected < min || selected > max) {
    throw new Error(label + ' must be an integer between ' + min + ' and ' + max + '.');
  }
  return selected;
}

// All configurable options used here are supported by Thum.io's free URL API.
// noanimate returns the final still frame instead of streaming a loader GIF.
export function thumImageUrl(targetUrl, options = {}) {
  const target = validateScreenshotTarget(targetUrl);
  const width = integerOption(options.width, THUM_DEFAULTS.width, 100, 1200, 'Output width');
  const crop = integerOption(options.crop, THUM_DEFAULTS.crop, 100, 1200, 'Capture height');
  const maxAge = integerOption(options.maxAge, THUM_DEFAULTS.maxAge, 0, 8760, 'Cache maximum age');
  const format = options.format ?? THUM_DEFAULTS.format;
  if (!['auto','jpg','png'].includes(format)) throw new Error('Unsupported image format.');
  const modifiers = [
    'width', String(width), 'crop', String(crop), 'maxAge', String(maxAge),
    ...(format === 'jpg' ? ['allowJPG'] : format === 'png' ? ['png'] : []),
    'noanimate'
  ];
  return 'https://image.thum.io/get/' + modifiers.join('/') + '/' + target;
}

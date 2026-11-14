export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}` : `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

export function formatSrtClock(seconds) {
  const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')},${String(millis).padStart(3,'0')}`;
}

export function sanitizeSegments(chunks = []) {
  if (!Array.isArray(chunks)) return [];
  return chunks.map(chunk => {
    const start = Number(chunk?.timestamp?.[0]);
    const end = Number(chunk?.timestamp?.[1]);
    const text = String(chunk?.text || '').trim();
    if (!text || !Number.isFinite(start) || start < 0) return null;
    return {start, end: Number.isFinite(end) && end > start ? end : start + 2, text};
  }).filter(Boolean);
}

export function makeSrt(chunks) {
  return sanitizeSegments(chunks).map((chunk, index) => `${index + 1}\n${formatSrtClock(chunk.start)} --> ${formatSrtClock(chunk.end)}\n${chunk.text}`).join('\n\n') + (sanitizeSegments(chunks).length ? '\n' : '');
}

export function safeDownloadStem(filename) {
  const stem = String(filename || 'transcript').replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N} _.-]/gu, '_').trim().slice(0, 85);
  return stem || 'transcript';
}

export function formatBytes(n) {
  const v = Math.max(0,Number(n) || 0);
  return v >= 1e6 ? `${(v/1e6).toFixed(1)} MB` : v >= 1e3 ? `${(v/1e3).toFixed(0)} KB` : `${v} B`;
}

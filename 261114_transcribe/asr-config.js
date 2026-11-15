// Tiny English only: use straightforward transcription before adding larger models.
// Kept separately for testing without a GPU or external network.
export const MODEL_ID = 'onnx-community/whisper-tiny.en';
export const MODEL_LABEL = 'Whisper Tiny · English';
export const CACHE_KEY = 'testlab-transcribe-models-v1';
export const SAMPLE_RATE = 16000;

// Use non-overlapping <=29 second windows. This prevents decoder timestamp loops
// and accidentally repeated text at sliding-window overlaps.
export function speechWindows(samples, sampleRate = SAMPLE_RATE) {
  if (!(samples instanceof Float32Array) || !samples.length) throw new Error('Audio has no samples.');
  if (!(sampleRate > 0)) throw new Error('Invalid audio sample rate.');
  const maxSamples = Math.floor(29 * sampleRate);
  const desiredSamples = Math.floor(24 * sampleRate);
  const windows = [];
  for (let start = 0; start < samples.length;) {
    let end = Math.min(samples.length, start + desiredSamples);
    // Avoid leaving a tiny final fragment that Whisper may hallucinate over.
    if (samples.length - end > 0 && samples.length - end < 4 * sampleRate
        && samples.length - start <= maxSamples) end = samples.length;
    windows.push({start: start / sampleRate, end: end / sampleRate, audio: samples.subarray(start, end)});
    start = end;
  }
  return windows;
}

export function audioStats(audio) {
  if (!(audio instanceof Float32Array) || !audio.length) throw new Error('Audio has no samples.');
  let sum = 0, peak = 0;
  for (const sample of audio) {
    const v = Number.isFinite(sample) ? sample : 0;
    sum += v * v;
    peak = Math.max(peak, Math.abs(v));
  }
  const rms = Math.sqrt(sum / audio.length);
  return {rms, peak, dbfs: rms > 0 ? Math.round(20 * Math.log10(rms)) : -Infinity};
}

export function isNearlySilent(stats) {
  return stats.rms < 0.00025 || stats.peak < 0.002;
}

export function levelAudio(audio, stats = audioStats(audio)) {
  if (isNearlySilent(stats)) return {audio, gain: 1};
  // Quiet recordings benefit from modest gain; avoid hard clipping/noise boosts.
  const gain = stats.rms < 0.04
    ? Math.min(4, 0.075 / stats.rms, 0.94 / Math.max(stats.peak, 0.001))
    : 1;
  if (gain <= 1.05) return {audio, gain: 1};
  const boosted = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) boosted[i] = audio[i] * gain;
  return {audio: boosted, gain};
}

export function asrOptions() {
  // Language/task are invalid for .en checkpoints.
  // Plain text decoding avoids timestamp-token interactions on short clips.
  // Avoid changing Whisper's native decoding defaults until we have a good baseline.
  return {return_timestamps: false};
}

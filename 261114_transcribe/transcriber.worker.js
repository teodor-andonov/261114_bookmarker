// Whisper runs entirely in this worker. Audio is never sent to an inference server.
import {MODEL_ID, MODEL_LABEL, CACHE_KEY, speechWindows, audioStats, isNearlySilent, levelAudio, asrOptions} from './asr-config.js';

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let loaded = null;
let loadedDevice = '';
let importPromise = null;

function send(jobId, type, data = {}) { self.postMessage({jobId, type, ...data}); }
async function transformers() {
  if (!importPromise) importPromise = import(CDN);
  const library = await importPromise;
  library.env.cacheKey = CACHE_KEY; // Do not mix model downloads with other GitHub Pages apps.
  library.env.useBrowserCache = true;
  return library;
}
async function init(requestedDevice, jobId) {
  const {pipeline} = await transformers();
  let device = requestedDevice === 'webgpu' ? 'webgpu' : 'wasm';
  if (device === 'webgpu' && !self.navigator?.gpu) {
    send(jobId, 'notice', {message: 'WebGPU unavailable: using CPU.'});
    device = 'wasm';
  }
  if (loaded && loadedDevice === device) return {transcriber: loaded, device};
  if (loaded?.dispose) await loaded.dispose();
  loaded = null;
  loadedDevice = '';
  const load = async target => {
    send(jobId, 'status', {message: `Loading ${MODEL_LABEL} (${target.toUpperCase()})…`});
    return pipeline('automatic-speech-recognition', MODEL_ID, {
      device: target,
      dtype: target === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: progress => {
        if (progress?.status === 'progress' && Number.isFinite(progress.progress)) {
          send(jobId, 'download', {percent: Math.round(progress.progress), file: progress.file || ''});
        } else if (['initiate', 'download', 'done'].includes(progress?.status)) {
          send(jobId, 'status', {message: progress.status === 'done' ? 'Preparing model…' : 'Downloading model files…'});
        }
      }
    });
  };
  try {loaded = await load(device);}
  catch (error) {
    if (device !== 'webgpu') throw error;
    send(jobId, 'notice', {message: 'WebGPU failed; using CPU.'});
    device = 'wasm';
    loaded = await load(device);
  }
  loadedDevice = device;
  return {transcriber: loaded, device};
}
self.addEventListener('message', async event => {
  const {type, jobId, audio, device = 'wasm'} = event.data || {};
  if (type !== 'transcribe' || !(audio instanceof ArrayBuffer)) return;
  try {
    const samples = new Float32Array(audio);
    const overall = audioStats(samples);
    send(jobId, 'audio-info', {dbfs: overall.dbfs, silent: isNearlySilent(overall)});
    if (isNearlySilent(overall)) {
      send(jobId, 'result', {text: '', chunks: [], silent: true, device});
      return;
    }
    const {transcriber, device: activeDevice} = await init(device, jobId);
    const segments = [];
    const windows = speechWindows(samples);
    for (let index = 0; index < windows.length; index++) {
      const win = windows[index];
      const stats = audioStats(win.audio);
      if (isNearlySilent(stats)) continue;
      send(jobId, 'status', {message: `Transcribing ${index + 1} of ${windows.length} · ${Math.round(win.start)}–${Math.round(win.end)}s…`});
      const prepared = levelAudio(win.audio, stats);
      const result = await transcriber(prepared.audio, asrOptions());
      const text = String(result?.text || '').trim();
      if (text) segments.push({timestamp: [win.start, win.end], text});
      send(jobId, 'segment-progress', {completed: index + 1, total: windows.length});
    }
    send(jobId, 'result', {
      text: segments.map(segment => segment.text).join(' ').replace(/\s+/g,' ').trim(),
      chunks: segments,
      // Chunk boundaries are estimates, not Whisper word-level timestamps.
      approximateTimestamps: true, silent: false, device: activeDevice
    });
  } catch (error) {
    send(jobId, 'error', {message: error?.message || String(error)});
  }
});

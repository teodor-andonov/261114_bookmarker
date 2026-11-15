// All speech inference happens locally in this Web Worker. The model is fetched once
// from Hugging Face; the audio data is not uploaded to a transcription API.
import {ENGLISH_MODELS, asrOptions} from './asr-config.js';
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
let loaded = null;
let loadedKey = '';
let importPromise = null;

function send(jobId, type, data = {}) { self.postMessage({jobId, type, ...data}); }
async function transformers() {
  if (!importPromise) importPromise = import(CDN);
  return importPromise;
}

async function init(modelKey, requestedDevice, jobId) {
  const model = ENGLISH_MODELS[modelKey];
  if (!model) throw new Error('Unknown English speech model.');
  const {pipeline} = await transformers();
  let device = requestedDevice === 'webgpu' ? 'webgpu' : 'wasm';
  if (device === 'webgpu' && !self.navigator?.gpu) {
    send(jobId, 'notice', {message: 'WebGPU is unavailable here. Using CPU instead.'});
    device = 'wasm';
  }
  const key = `${model.id}|${device}`;
  if (loaded && loadedKey === key) return {transcriber: loaded, device};
  if (loaded?.dispose) await loaded.dispose();
  loaded = null;
  loadedKey = '';

  const load = async target => {
    send(jobId, 'status', {message: `Loading ${model.label} (${target.toUpperCase()})…`});
    return pipeline('automatic-speech-recognition', model.id, {
      device: target,
      dtype: target === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: progress => {
        if (progress?.status === 'progress' && Number.isFinite(progress.progress)) {
          send(jobId, 'download', {percent: Math.max(0,Math.min(100,Math.round(progress.progress))), file: progress.file || ''});
        } else if (['initiate','download','done'].includes(progress?.status)) {
          send(jobId, 'status', {message: progress.status === 'done' ? 'Preparing model…' : 'Downloading model files…'});
        }
      }
    });
  };
  try { loaded = await load(device); }
  catch (error) {
    if (device !== 'webgpu') throw error;
    send(jobId, 'notice', {message: 'GPU model failed to load; falling back to CPU.'});
    device = 'wasm';
    loaded = await load(device);
  }
  loadedKey = `${model.id}|${device}`;
  return {transcriber: loaded, device};
}

self.addEventListener('message', async event => {
  const {type, jobId, audio, modelKey = 'base', device = 'wasm'} = event.data || {};
  if (type !== 'transcribe' || !(audio instanceof ArrayBuffer)) return;
  try {
    const samples = new Float32Array(audio);
    const options = asrOptions(samples.length);
    const {transcriber, device: activeDevice} = await init(modelKey, device, jobId);
    send(jobId, 'status', {message: `Transcribing English on ${activeDevice === 'webgpu' ? 'GPU' : 'CPU'}…`});
    const result = await transcriber(samples, options);
    send(jobId, 'result', {text: String(result?.text || '').trim(), chunks: Array.isArray(result?.chunks) ? result.chunks : [], device: activeDevice});
  } catch (error) {
    send(jobId, 'error', {message: error?.message || String(error)});
  }
});

// Inference runs inside this worker, not on a server or the page's UI thread.
// The JS runtime and model weights come from the CDN/Hugging Face, but audio stays on-device.
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODELS = {
  multilingual: 'onnx-community/whisper-tiny',
  english: 'onnx-community/whisper-tiny.en'
};
let loaded = null;
let loadedKey = '';
let importPromise = null;

function send(jobId, type, data = {}) { self.postMessage({jobId, type, ...data}); }

async function transformers() {
  if (!importPromise) importPromise = import(CDN);
  return importPromise;
}

async function init(modelKey, requestedDevice, jobId) {
  const model = MODELS[modelKey];
  if (!model) throw new Error('Unknown speech model.');
  const {pipeline} = await transformers();
  let device = requestedDevice === 'webgpu' ? 'webgpu' : 'wasm';
  if (device === 'webgpu' && !self.navigator?.gpu) {
    send(jobId, 'notice', {message: 'WebGPU is unavailable in this browser worker. Using CPU instead.'});
    device = 'wasm';
  }
  const key = `${model}|${device}`;
  if (loaded && loadedKey === key) return {transcriber: loaded, device};
  if (loaded && loaded.dispose) await loaded.dispose();
  loaded = null;
  loadedKey = '';

  const load = async target => {
    send(jobId, 'status', {message: `Loading ${modelKey === 'english' ? 'English' : 'multilingual'} model (${target.toUpperCase()})…`});
    return pipeline('automatic-speech-recognition', model, {
      device: target,
      dtype: target === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: progress => {
        if (progress?.status === 'progress' && Number.isFinite(progress.progress)) {
          send(jobId, 'download', {percent: Math.max(0,Math.min(100,Math.round(progress.progress))), file: progress.file || ''});
        } else if (progress?.status === 'initiate' || progress?.status === 'download' || progress?.status === 'done') {
          send(jobId, 'status', {message: progress.status === 'done' ? 'Preparing model…' : 'Downloading model files…'});
        }
      }
    });
  };
  try { loaded = await load(device); }
  catch (error) {
    if (device !== 'webgpu') throw error;
    send(jobId, 'notice', {message: 'GPU setup failed. Falling back to CPU.'});
    device = 'wasm';
    loaded = await load(device);
  }
  loadedKey = `${model}|${device}`;
  return {transcriber: loaded, device};
}

self.addEventListener('message', async event => {
  const {type, jobId, audio, modelKey = 'multilingual', language = 'auto', device = 'wasm'} = event.data || {};
  if (type !== 'transcribe' || !(audio instanceof ArrayBuffer)) return;
  try {
    const {transcriber, device: activeDevice} = await init(modelKey, device, jobId);
    send(jobId, 'status', {message: `Recognising speech on ${activeDevice === 'webgpu' ? 'GPU' : 'CPU'}…`});
    const options = { chunk_length_s: 30, stride_length_s: 5, return_timestamps: true, task: 'transcribe' };
    if (modelKey !== 'english' && language !== 'auto') options.language = language;
    const result = await transcriber(new Float32Array(audio), options);
    send(jobId, 'result', {text: String(result?.text || '').trim(), chunks: Array.isArray(result?.chunks) ? result.chunks : [], device: activeDevice});
  } catch (error) {
    send(jobId, 'error', {message: error?.message || String(error)});
  }
});

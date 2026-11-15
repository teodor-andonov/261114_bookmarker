# Audio → Text — Testlab prototype 02

Standalone browser-based speech transcription using Transformers.js and either `onnx-community/whisper-base.en` (default) or `onnx-community/whisper-small.en` (higher accuracy on capable hardware). This prototype is an ordinary web app, **not a PWA**. It does not register a service worker, manifest, or backend.

## What it does

- Import an audio recording (MP3, WAV, M4A, WebM, etc., depending on the browser codec support).
- Optionally record directly from the microphone (requires user permission).
- Decode and resample to 16 kHz mono in-browser using the Web Audio API.
- Download the Whisper ONNX model from Hugging Face on first use, via Transformers.js v3.8.1 (loaded as an ES module from jsDelivr). Model files may be cached by the browser/library.
- Run inference inside a local Web Worker using WASM, or experimental WebGPU with CPU fallback.
- Show editable text and clickable timestamped segments; export `.txt` or `.srt`.
- Audio and transcripts are **not uploaded to any inference server**. The first run needs internet to retrieve model files. No local persistence; export results before closing.

## Start

Hosted via the Testlab GitHub Pages workflow at:

`https://teodor-andonov.github.io/261114_testlab/261114_transcribe/`

Locally, serve this folder over HTTP (opening `file://` is not supported for module workers):

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173/`.

## Known constraints

- **Experimental**: English-only Whisper Base and Small can still make errors, especially with accents, technical vocabulary and noise. Small can be too slow or memory-intensive on a phone.
- Long recordings are resource intensive in browsers. This prototype limits clips to 15 minutes, and short clips are recommended on phones.
- The first download may involve tens to hundreds of MB, depending on model/device and cached files. Processing speed depends on hardware.
- File compatibility depends on the browser's audio codecs; not every audio file can be decoded even if the extension is listed.
- WebGPU varies by browser/device; CPU is the reliable default. Cancelling terminates the worker immediately.
- The SRT export contains the original time-stamped segments; editing the main text doesn't revise the timing blocks.
- Microphone recording availability and playback vary by browser.

References: [Transformers.js pipeline docs](https://huggingface.co/docs/transformers.js/pipelines), [Whisper Base English ONNX](https://huggingface.co/onnx-community/whisper-base.en), [Whisper Small English ONNX](https://huggingface.co/onnx-community/whisper-small.en).

## Model-picker regression

The `modelSelect` HTML values must match the English keys in `asr-config.js` (`base` and `small`), and `modelHint` must exist for the runtime helper. Run `npm test` after editing this page.

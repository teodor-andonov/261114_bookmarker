# Audio → Text — Tiny English experiment

Standalone, browser-only Whisper transcription on GitHub Pages; not a PWA or backend service.

## Current focus

- Uses only `onnx-community/whisper-tiny.en`, with Transformers.js v3.8.1.
- Uses `return_timestamps: false`; avoids task/language flags rejected by English-only checkpoints.
- Splits longer recordings into **non-overlapping** chunks of about 24 seconds (no duplicate seam text).
- Checks decoded audio RMS/peak, amplifies quiet clips modestly, and distinguishes nearly silent audio from a failed recognition result.
- Builds approximate **chunk-level** timestamps for clickable navigation and SRT. These are **not** word-level or precise subtitle timings.
- Supports file upload, microphone, local export, CPU or experimental WebGPU.
- Larger models are deferred. Browser decoding and inference may still fail or produce inaccurate text for noisy clips.

## Downloaded model storage

The model uses the dedicated Cache Storage key `testlab-transcribe-models-v1` instead of the default shared `transformers-cache`. **Clear downloaded models** first terminates the transcription worker, deletes this app's cache, then deletes only known model-file URLs for our previous Tiny/Base/Small experiments from the old shared cache.

The cleanup **does not** erase IndexedDB, storage from other applications, Testlab's root PWA cache, or the whole shared `transformers-cache`. Another app that uses the exact same model URL may need to re-download it, but its other data is retained. Browser-managed HTTP caches may retain transient copies beyond the Cache API and cannot be selectively deleted by this page.

On desktop Chromium, you can inspect the model cache in **DevTools → Application → Cache Storage**. Avoid clearing all site data for `teodor-andonov.github.io`: multiple GitHub Pages apps share the same browser origin.

## Local development

```bash
python3 -m http.server 4173
# in this folder:
npm test
```

Run from the folder over HTTP (the ES module worker will not work via file URLs).
First model download requires a network connection. Recorded audio is processed on-device and not sent to a transcription service. Export the result before closing the tab.

## Checking previous model downloads

Tap **Check cached models** to inspect the new private cache and the former default `transformers-cache`. It reports known Tiny, multilingual Tiny, Base and Small model files separately. Tap **Clear downloaded models** to remove these entries; the app automatically checks again and reports whether any known files remain.

This is verification for the **two known Cache Storage locations**, not for all browser-managed copies or the operating system's disk usage. Model file count is not a reliable measure of MB/GB. Chrome's generic HTTP cache can retain its own copies and is not independently inspectable or selectively erasable by this web page. Avoid **Clear site data** unless you intend to remove other GitHub Pages projects' origin storage too.

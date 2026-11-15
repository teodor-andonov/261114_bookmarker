// English-only models: base for balanced local use, small for better accuracy on capable devices.
// Keep generation settings separate so accidental multilingual-only options are caught in tests.
export const ENGLISH_MODELS = Object.freeze({
  base: Object.freeze({id: 'onnx-community/whisper-base.en', label: 'Whisper Base English'}),
  small: Object.freeze({id: 'onnx-community/whisper-small.en', label: 'Whisper Small English'})
});

export function asrOptions(sampleCount) {
  if (!Number.isFinite(sampleCount) || sampleCount <= 0) throw new Error('Audio has no samples.');
  const seconds = sampleCount / 16000;
  const options = {
    return_timestamps: true,
    // Gentle decoding controls reduce runaway repeating phrases without rewriting the transcript.
    repetition_penalty: 1.05,
    no_repeat_ngram_size: 5
  };
  // Short files fit entirely in the Whisper 30-second window: avoid seam duplication.
  // Longer files use shorter windows and only a small amount of overlapping context.
  if (seconds > 29) {
    options.chunk_length_s = 25;
    options.stride_length_s = 2;
  }
  // English-only Whisper checkpoints reject task, language and multilingual flags.
  return options;
}

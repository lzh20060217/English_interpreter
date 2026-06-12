/**
 * Audio format conversion utilities.
 * Backend expects: PCM s16le, 16kHz, mono
 * Browser gives: float32 [-1, 1], typically 44.1kHz or 48kHz
 */

/**
 * Convert float32 audio samples ([-1, 1]) to s16le PCM ArrayBuffer.
 */
export function float32ToS16LE(samples: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    // Clamp to [-1, 1] then scale to int16
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return buf;
}

/**
 * Simple linear resampling from any sample rate to target (16kHz).
 * Uses linear interpolation.
 */
export function resample(
  samples: Float32Array,
  sourceRate: number,
  targetRate: number = 16000
): Float32Array {
  if (sourceRate === targetRate) return samples;

  const ratio = sourceRate / targetRate;
  const newLength = Math.floor(samples.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIdx = i * ratio;
    const srcFloor = Math.floor(srcIdx);
    const srcCeil = Math.min(srcFloor + 1, samples.length - 1);
    const frac = srcIdx - srcFloor;
    result[i] = samples[srcFloor] * (1 - frac) + samples[srcCeil] * frac;
  }

  return result;
}

/**
 * Convert a downmixed mono Float32Array to s16le PCM ArrayBuffer,
 * resampled to 16kHz.
 */
export function processAudioChunk(
  samples: Float32Array,
  sourceRate: number
): ArrayBuffer {
  const mono = samples; // Already mono from ScriptProcessor
  const resampled = resample(mono, sourceRate, 16000);
  return float32ToS16LE(resampled);
}

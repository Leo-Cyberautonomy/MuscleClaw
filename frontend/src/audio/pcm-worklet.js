/**
 * AudioWorklet processor for low-latency PCM capture.
 *
 * Converts Float32 mic input to Int16 PCM at the native sample rate
 * and posts buffers to the main thread via MessagePort.
 *
 * This file is registered as an AudioWorklet module — it runs in a
 * separate thread from the main UI, avoiding audio glitches.
 */

class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const float32 = input[0];
    if (!float32 || float32.length === 0) return true;

    // Silence gate: skip very quiet frames to reduce background noise
    // triggering Gemini VAD (which causes false "user interrupt").
    // Threshold must be very low — too high filters real speech.
    let energy = 0;
    for (let i = 0; i < float32.length; i++) {
      energy += float32[i] * float32[i];
    }
    energy /= float32.length;
    if (energy < 0.00005) return true; // Only filter near-silence

    // Convert Float32 [-1, 1] → Int16 [-32768, 32767]
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage(int16.buffer, [int16.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);

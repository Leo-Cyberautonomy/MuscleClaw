/**
 * AudioEngine — manages microphone capture and speaker playback.
 *
 * Capture: AudioWorklet processor converts mic input to 16-bit PCM
 * at 16kHz, posted to main thread via MessagePort for WebSocket send.
 *
 * Playback: Queues incoming 24kHz PCM buffers from Gemini and plays
 * them seamlessly using AudioBufferSourceNode scheduling.
 */

export class AudioEngine {
  // ── Capture ─────────────────────────────────────────────────────
  private captureCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private onPCM: ((pcm: ArrayBuffer) => void) | null = null;

  async startMic(onPCM: (pcm: ArrayBuffer) => void) {
    this.onPCM = onPCM;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Use default sample rate — browser may not support 16kHz.
    // Gemini Live API auto-resamples any input rate.
    this.captureCtx = new AudioContext();
    console.log(`[Audio] Capture sample rate: ${this.captureCtx.sampleRate}Hz`);

    // Register the AudioWorklet module
    const workletUrl = new URL('./pcm-worklet.js', import.meta.url);
    await this.captureCtx.audioWorklet.addModule(workletUrl);

    const source = this.captureCtx.createMediaStreamSource(this.micStream);
    this.workletNode = new AudioWorkletNode(this.captureCtx, 'pcm-processor');

    // Receive PCM buffers from the worklet thread
    this.workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      this.onPCM?.(e.data);
    };

    source.connect(this.workletNode);
    this.workletNode.connect(this.captureCtx.destination);
  }

  /** Actual capture sample rate (may differ from requested 16kHz) */
  get sampleRate(): number {
    return this.captureCtx?.sampleRate ?? 16000;
  }

  // ── Playback ────────────────────────────────────────────────────
  private playCtx: AudioContext | null = null;
  private nextStartTime = 0;

  playPCM(pcm: ArrayBuffer) {
    if (!this.playCtx) {
      this.playCtx = new AudioContext({ sampleRate: 24000 });
    }

    const int16 = new Int16Array(pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buf = this.playCtx.createBuffer(1, float32.length, 24000);
    buf.getChannelData(0).set(float32);

    const source = this.playCtx.createBufferSource();
    source.buffer = buf;
    source.connect(this.playCtx.destination);

    // Schedule seamlessly after the previous buffer
    const now = this.playCtx.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buf.duration;
  }

  // ── Lifecycle ───────────────────────────────────────────────────

  stop() {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.workletNode?.disconnect();
    this.captureCtx?.close().catch(() => {});
    this.playCtx?.close().catch(() => {});

    this.micStream = null;
    this.workletNode = null;
    this.captureCtx = null;
    this.playCtx = null;
    this.nextStartTime = 0;
  }
}

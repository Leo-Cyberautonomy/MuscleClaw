export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private onPCM: ((pcm: ArrayBuffer) => void) | null = null;

  async startMic(onPCM: (pcm: ArrayBuffer) => void) {
    this.onPCM = onPCM;
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
    });
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    const source = this.audioCtx.createMediaStreamSource(this.micStream);

    this.scriptNode = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.scriptNode.onaudioprocess = (e) => {
      const float32 = e.inputBuffer.getChannelData(0);
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
      }
      this.onPCM?.(int16.buffer);
    };
    source.connect(this.scriptNode);
    this.scriptNode.connect(this.audioCtx.destination);
  }

  // Playback context at 24kHz for Gemini output
  private playCtx: AudioContext | null = null;
  private nextStartTime = 0;

  playPCM(pcm: ArrayBuffer) {
    if (!this.playCtx) this.playCtx = new AudioContext({ sampleRate: 24000 });
    const int16 = new Int16Array(pcm);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buf = this.playCtx.createBuffer(1, float32.length, 24000);
    buf.getChannelData(0).set(float32);

    const source = this.playCtx.createBufferSource();
    source.buffer = buf;
    source.connect(this.playCtx.destination);

    const now = this.playCtx.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + buf.duration;
  }

  stop() {
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.scriptNode?.disconnect();
    this.audioCtx?.close();
    this.playCtx?.close();
  }
}

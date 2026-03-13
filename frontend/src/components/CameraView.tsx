import { useRef, useEffect } from 'react';
import { adkClient } from '../ws/adkClient';
import { AudioEngine } from '../audio/audioEngine';
import { useAppStore } from '../stores/appStore';

const audioEngine = new AudioEngine();

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);

  useEffect(() => {
    let animId: number;
    let frameInterval: ReturnType<typeof setInterval>;

    async function init() {
      // Camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Audio → WebSocket
      await audioEngine.startMic((pcm) => adkClient.sendAudio(pcm));

      // WebSocket
      adkClient.connect({
        onAudio: (pcm) => audioEngine.playPCM(pcm),
      });

      // Send 1fps JPEG to Gemini
      frameInterval = setInterval(() => {
        if (!videoRef.current) return;
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(videoRef.current, 0, 0, 640, 360);
        const jpeg = c.toDataURL('image/jpeg', 0.6).split(',')[1];
        adkClient.sendVideoFrame(jpeg);
      }, 1000);

      // Render loop (for Canvas overlay — populated later by MediaPipe)
      function renderLoop() {
        // Canvas rendering will be added in Chunk 3
        animId = requestAnimationFrame(renderLoop);
      }
      renderLoop();
    }

    init().catch(console.error);

    return () => {
      cancelAnimationFrame(animId);
      clearInterval(frameInterval);
      audioEngine.stop();
      adkClient.disconnect();
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        playsInline muted
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {/* Mode indicator */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'var(--color-panel)', backdropFilter: 'var(--blur-panel)',
        border: '1px solid var(--color-border)', borderRadius: 8,
        padding: '6px 14px', fontSize: 13, color: 'var(--color-text-dim)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#00ff80' : '#ff4040',
          boxShadow: connected ? '0 0 6px #00ff80' : '0 0 6px #ff4040',
        }} />
        {mode === 'idle' ? 'MuscleClaw' : mode.replace('_', ' ').toUpperCase()}
      </div>
    </div>
  );
}

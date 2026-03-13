import { useRef, useEffect } from 'react';
import { adkClient } from '../ws/adkClient';
import { AudioEngine } from '../audio/audioEngine';
import { useAppStore } from '../stores/appStore';
import { initMediaPipe, detectPose, detectHands } from '../cv/mediapipe';
import { processFrame as processRep } from '../cv/repCounter';
import { checkSafety } from '../cv/safetyMonitor';
import { detectGesture } from '../cv/gestureDetector';
import { drawSkeleton } from '../render/skeleton';
import { drawAngle } from '../render/angles';
import { POSE } from '../cv/types';
import type { Landmark } from '../cv/types';
import { TrainingHUD } from './TrainingHUD';
import { RestTimer } from './RestTimer';

const audioEngine = new AudioEngine();

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);
  const landmarksRef = useRef<Landmark[] | null>(null);

  useEffect(() => {
    let animId: number;
    let frameInterval: ReturnType<typeof setInterval>;
    let mediaPipeReady = false;
    let frameCount = 0;

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

      // Initialize MediaPipe (async, non-blocking)
      initMediaPipe().then(() => {
        mediaPipeReady = true;
        console.log('[MediaPipe] Ready');
      }).catch((err) => console.warn('[MediaPipe] Init failed:', err));

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

      // Main render + CV loop
      function renderLoop() {
        frameCount++;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
          animId = requestAnimationFrame(renderLoop);
          return;
        }

        // Match canvas resolution to video display size
        const rect = video.getBoundingClientRect();
        if (canvas.width !== rect.width || canvas.height !== rect.height) {
          canvas.width = rect.width;
          canvas.height = rect.height;
        }

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (mediaPipeReady && video.readyState >= 2) {
          const timestamp = performance.now();

          // Alternating frames: even → pose, odd → hands
          if (frameCount % 2 === 0) {
            const landmarks = detectPose(video, timestamp);
            if (landmarks) {
              landmarksRef.current = landmarks;

              // Draw skeleton (mirrored to match video)
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
              drawSkeleton(ctx, landmarks, canvas.width, canvas.height);

              // Draw elbow angles
              drawAngle(ctx, landmarks, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST, canvas.width, canvas.height);
              drawAngle(ctx, landmarks, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST, canvas.width, canvas.height);
              ctx.restore();

              // CV analytics
              const currentMode = useAppStore.getState().mode;
              if (currentMode === 'training') {
                const exerciseId = useAppStore.getState().training.exerciseId || 'bench_press';
                const repEvent = processRep(landmarks, exerciseId);
                if (repEvent) {
                  adkClient.sendCVEvent(repEvent);
                  if (repEvent.type === 'rep_complete') {
                    useAppStore.getState().updateTraining({ reps: repEvent.rep });
                  }
                }
              }

              // Safety check (always active)
              const safetyEvent = checkSafety(landmarks, canvas.height);
              if (safetyEvent) {
                adkClient.sendCVEvent(safetyEvent);
              }
            }
          } else {
            // Hand detection for gestures
            const hands = detectHands(video, timestamp);
            if (hands && hands.length > 0) {
              const gestureEvent = detectGesture(hands);
              if (gestureEvent) {
                adkClient.sendCVEvent(gestureEvent);
              }
            }
          }
        }

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
      <TrainingHUD />
      <RestTimer />
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

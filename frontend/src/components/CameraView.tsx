import { useRef, useEffect } from 'react';
import { adkClient } from '../ws/adkClient';
import { AudioEngine } from '../audio/audioEngine';
import { useAppStore } from '../stores/appStore';
import { useTrainingStore } from '../stores/trainingStore';
import { usePoseStore } from '../stores/poseStore';
import { initMediaPipe, detectPose, detectHands } from '../cv/mediapipe';
import { processFrame as processRep } from '../cv/repCounter';
import { analyzeAngles } from '../cv/angleAnalyzer';
import { checkSymmetry } from '../cv/symmetryChecker';
import { feedFrame as feedPosture, analyzePosture } from '../cv/postureScanner';
import { checkSafety } from '../cv/safetyMonitor';
import { processAirTouch } from '../cv/airTouch';
import { detectGesture } from '../cv/gestureDetector';
import { drawSkeleton } from '../render/skeleton';
import { drawAngle } from '../render/angles';
import { POSE } from '../cv/types';
import type { Landmark } from '../cv/types';
import { BodyPanel } from './BodyPanel';
import { TrainingHUD } from './TrainingHUD';
import { RestTimer } from './RestTimer';

const audioEngine = new AudioEngine();

// Landmark index → muscle group mapping for click detection
const LANDMARK_TO_MUSCLE: Record<number, string> = {
  11: 'chest', 12: 'chest',       // Chest: shoulder landmarks
  13: 'shoulders', 14: 'shoulders', // Shoulders: upper arm
  15: 'arms', 16: 'arms',          // Arms: elbows
  17: 'arms', 18: 'arms',          // Arms: wrists
  23: 'core', 24: 'core',          // Core: hips
  25: 'legs', 26: 'legs',          // Legs: knees
  27: 'legs', 28: 'legs',          // Legs: ankles
};

function findNearestMuscle(clickX: number, clickY: number, landmarks: Landmark[], canvasW: number, canvasH: number): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const [idxStr, muscle] of Object.entries(LANDMARK_TO_MUSCLE)) {
    const idx = parseInt(idxStr);
    const lm = landmarks[idx];
    if (!lm) continue;
    // Mirror X to match camera flip
    const lx = (1 - lm.x) * canvasW;
    const ly = lm.y * canvasH;
    const dist = Math.sqrt((clickX - lx) ** 2 + (clickY - ly) ** 2);
    if (dist < bestDist && dist < 80) { // 80px threshold
      bestDist = dist;
      best = muscle;
    }
  }
  return best;
}

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mode = useAppStore((s) => s.mode);
  const connected = useAppStore((s) => s.connected);

  // Expose videoRef globally for ShowcaseCapture
  (window as any).__videoRef = videoRef;
  const landmarksRef = useRef<Landmark[] | null>(null);
  const canvasSizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    let animId: number;
    // frameInterval removed — video frames disabled for native audio model
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

      // WebSocket — connect first, before mic (mic permission may fail)
      adkClient.connect({
        onAudio: (pcm) => audioEngine.playPCM(pcm),
      });

      // Audio → WebSocket (non-blocking: if mic denied, WS still works)
      try {
        await audioEngine.startMic((pcm) => adkClient.sendAudio(pcm));
        adkClient.setAudioRate(audioEngine.sampleRate);
      } catch (e) {
        console.warn('[Audio] Mic access denied or failed:', e);
      }

      // Browser SpeechRecognition → ToolRouter (ensures voice commands trigger tools)
      // Gemini Live API input_audio_transcription is unreliable with native audio model
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          recognition.onresult = (event: any) => {
            const last = event.results[event.results.length - 1];
            if (last.isFinal) {
              const text = last[0].transcript.trim();
              if (text.length > 2) {
                console.log(`[Speech] Recognized: ${text}`);
                // Send as text to trigger ToolRouter on backend
                adkClient.sendText(text);
              }
            }
          };
          recognition.onerror = (e: any) => {
            if (e.error !== 'no-speech') console.warn('[Speech] Error:', e.error);
          };
          recognition.onend = () => {
            // Auto-restart
            try { recognition.start(); } catch {}
          };
          recognition.start();
          console.log('[Speech] Recognition started');
        }
      } catch (e) {
        console.warn('[Speech] Not available:', e);
      }

      // Initialize MediaPipe (async, non-blocking)
      initMediaPipe().then(() => {
        mediaPipeReady = true;
        console.log('[MediaPipe] Ready');
      }).catch((err) => console.warn('[MediaPipe] Init failed:', err));

      // Note: Video frames disabled — native audio model doesn't support them.
      // Visual understanding relies on CV engine events (text-based).
      // Uncomment when switching to a model with video input support.

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
        canvasSizeRef.current = { w: canvas.width, h: canvas.height };
        usePoseStore.getState().setCanvasSize(canvas.width, canvas.height);

        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Always draw skeleton from last known landmarks (prevents flickering)
        const prevLandmarks = landmarksRef.current;
        if (prevLandmarks) {
          ctx.save();
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          drawSkeleton(ctx, prevLandmarks, canvas.width, canvas.height);
          ctx.restore();
        }

        if (mediaPipeReady && video.readyState >= 2) {
          const timestamp = performance.now();

          // Alternating frames: even → pose, odd → hands
          if (frameCount % 2 === 0) {
            const landmarks = detectPose(video, timestamp);
            if (landmarks) {
              // Lerp smoothing: blend new landmarks with previous (0.4 = responsive but smooth)
              if (landmarksRef.current) {
                const prev = landmarksRef.current;
                const alpha = 0.4;
                for (let i = 0; i < landmarks.length && i < prev.length; i++) {
                  landmarks[i].x = prev[i].x + (landmarks[i].x - prev[i].x) * alpha;
                  landmarks[i].y = prev[i].y + (landmarks[i].y - prev[i].y) * alpha;
                  if (landmarks[i].z !== undefined && prev[i].z !== undefined) {
                    landmarks[i].z = prev[i].z! + (landmarks[i].z! - prev[i].z!) * alpha;
                  }
                }
              }
              landmarksRef.current = landmarks;
              usePoseStore.getState().setLandmarks(landmarks);

              // Redraw skeleton with smoothed landmarks
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.save();
              ctx.translate(canvas.width, 0);
              ctx.scale(-1, 1);
              drawSkeleton(ctx, landmarks, canvas.width, canvas.height);

              // Draw elbow angles
              drawAngle(ctx, landmarks, POSE.LEFT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST, canvas.width, canvas.height);
              drawAngle(ctx, landmarks, POSE.RIGHT_SHOULDER, POSE.RIGHT_ELBOW, POSE.RIGHT_WRIST, canvas.width, canvas.height);

              // Draw knee angles in squat mode
              const currentExercise = useTrainingStore.getState().exerciseId;
              if (currentExercise === 'squat') {
                drawAngle(ctx, landmarks, POSE.LEFT_HIP, POSE.LEFT_KNEE, POSE.LEFT_ANKLE, canvas.width, canvas.height);
                drawAngle(ctx, landmarks, POSE.RIGHT_HIP, POSE.RIGHT_KNEE, POSE.RIGHT_ANKLE, canvas.width, canvas.height);
              }
              ctx.restore();

              // CV analytics based on mode
              const currentMode = useAppStore.getState().mode;

              if (currentMode === 'training') {
                const exerciseId = useTrainingStore.getState().exerciseId || 'bench_press';

                // Rep counting
                const repEvent = processRep(landmarks, exerciseId);
                if (repEvent) {
                  adkClient.sendCVEvent(repEvent);
                  if (repEvent.type === 'rep_complete') {
                    const store = useTrainingStore.getState();
                    store.updateTraining({ reps: repEvent.rep });

                    // Check if set is complete → send set_complete to backend
                    if (repEvent.rep >= store.targetReps && store.targetReps > 0) {
                      adkClient.sendCVEvent({
                        type: 'set_complete',
                        exercise_id: exerciseId,
                        set_number: store.setNumber,
                        reps: repEvent.rep,
                        weight: store.targetWeight,
                      });
                    }
                  }
                }

                // Angle analysis for form correction
                const formEvent = analyzeAngles(landmarks, exerciseId);
                if (formEvent) {
                  adkClient.sendCVEvent(formEvent);
                }

                // Symmetry checking
                const symEvent = checkSymmetry(landmarks, exerciseId);
                if (symEvent) {
                  adkClient.sendCVEvent(symEvent);
                }
              }

              // Posture scanning in posture mode
              if (currentMode === 'posture') {
                usePoseStore.getState().setPostureScanning(true);
                const ready = feedPosture(landmarks);
                if (ready) {
                  const report = analyzePosture();
                  usePoseStore.getState().setPostureReport(report);
                  usePoseStore.getState().setPostureScanning(false);
                }
              }

              // Safety check (always active)
              const safetyEvent = checkSafety(landmarks, canvas.height);
              if (safetyEvent) {
                adkClient.sendCVEvent(safetyEvent);
              }
            }
          } else {
            // Hand detection for gestures + air touch
            const hands = detectHands(video, timestamp);
            if (hands && hands.length > 0) {
              usePoseStore.getState().setHandLandmarks(hands);
              const gestureEvent = detectGesture(hands);
              if (gestureEvent) {
                adkClient.sendCVEvent(gestureEvent);
              }
              // Air Touch: map finger position to screen cursor
              processAirTouch(hands, canvas.width, canvas.height, canvas.getBoundingClientRect());
            } else {
              processAirTouch(null, 0, 0, canvas.getBoundingClientRect());
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
      // clearInterval(frameInterval); — disabled
      audioEngine.stop();
      adkClient.disconnect();
    };
  }, []);

  function handleCameraClick(e: React.MouseEvent) {
    const landmarks = landmarksRef.current;
    if (!landmarks) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const muscle = findNearestMuscle(clickX, clickY, landmarks, rect.width, rect.height);
    if (muscle) {
      // Switch to dashboard and tell AI about the click
      useAppStore.getState().setMode('dashboard');
      adkClient.sendText(`[CLICK] User tapped on ${muscle} muscle group on camera. Tell them about their ${muscle} status.`);
    }
  }

  return (
    <div ref={containerRef} onClick={handleCameraClick} style={{ position: 'relative', width: '100%', height: '100%', cursor: 'crosshair' }}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        playsInline muted
      />
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {/* Floating body cards in body_scan mode */}
      <BodyPanel />
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
        {!mode || mode === 'idle' ? 'MuscleClaw' : mode.replace('_', ' ').toUpperCase()}
      </div>
    </div>
  );
}

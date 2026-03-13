import { PoseLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Landmark } from './types';

let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;

export async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  return { poseLandmarker, handLandmarker };
}

export function detectPose(video: HTMLVideoElement, timestamp: number): Landmark[] | null {
  if (!poseLandmarker) return null;
  const result = poseLandmarker.detectForVideo(video, timestamp);
  if (result.landmarks && result.landmarks.length > 0) {
    return result.landmarks[0] as Landmark[];
  }
  return null;
}

export function detectHands(video: HTMLVideoElement, timestamp: number) {
  if (!handLandmarker) return null;
  const result = handLandmarker.detectForVideo(video, timestamp);
  return result.landmarks;
}

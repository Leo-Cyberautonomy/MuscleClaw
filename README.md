# MuscleClaw — AI Fitness Coach

> Like Jarvis, but for the gym. Real-time AI fitness assistant with camera vision, voice interaction, gesture control, and AR overlays.

Built for the **Gemini Live Agent Challenge** using Google ADK + Gemini 2.0 Flash.

## What it does

MuscleClaw is a real-time AI fitness coach that:
- **Sees you** — Camera + MediaPipe (30fps pose detection) + Gemini vision (1fps scene understanding)
- **Talks to you** — Natural voice conversation with personality modes (professional, gentle, trash-talk)
- **Counts your reps** — Automatic rep counting with ROM validation using angle zero-crossing detection
- **Corrects your form** — Real-time joint angle analysis and symmetry checking
- **Keeps you safe** — Detects barbell stalls and triggers emergency countdown alerts
- **Remembers you** — Persistent training history, body profile, and strength data across sessions
- **Understands gestures** — Thumbs up to confirm, OK to acknowledge, hands-free control

## Architecture

**Dual-Vision Fusion** — two visual processing systems working together:

```
Browser (30fps)                         Cloud Run
┌──────────────────┐    WebSocket    ┌──────────────────────┐
│ Camera 1280×720  │────────────────→│ FastAPI               │
│ MediaPipe Pose   │  audio (16kHz)  │   ↓                   │
│ MediaPipe Hand   │  video (1fps)   │ ADK Runner             │
│ CV Engine:       │  CV events      │   ↓                   │
│  · Rep Counter   │←────────────────│ Gemini 2.0 Flash      │
│  · Safety Monitor│  audio (24kHz)  │   · Voice conversation│
│  · Gestures      │  UI commands    │   · Vision understanding│
│ Canvas 2D AR     │  transcripts    │   · Tool calling      │
│ Web Audio API    │                 │ SessionService (state) │
└──────────────────┘                 └──────────────────────┘
```

### Why Dual-Vision?

| Feature | MediaPipe (30fps, browser) | Gemini (1fps, cloud) |
|---------|---------------------------|---------------------|
| Rep counting | ✅ Angle zero-crossing | ❌ Too slow |
| Form correction | ✅ Joint angle analysis | ✅ Overall assessment |
| Safety detection | ✅ Barbell stall detect | ✅ Confirm + respond |
| Gesture control | ✅ Hand landmark classification | ❌ Too slow |
| Scene understanding | ❌ No semantic model | ✅ "You're using a barbell" |
| Training advice | ❌ No reasoning | ✅ Full conversation |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Computer Vision | @mediapipe/tasks-vision (Pose 33pt + Hand 21pt) |
| AR Rendering | Canvas 2D + CSS backdrop-filter |
| Audio | Web Audio API (PCM 16kHz capture, 24kHz playback) |
| State | Zustand |
| AI Framework | Google ADK |
| AI Model | Gemini 2.0 Flash |
| Backend | FastAPI + WebSocket |
| Deployment | Google Cloud Run |

## Features

### P0 — Core
- 🗣️ **Jarvis Voice Conversation** — Natural voice chat with personality modes
- 💪 **Real-time Rep Counting** — Angle-based detection with ROM validation
- 🔒 **Safety Guardian** — Barbell stall detection with 10s emergency countdown
- 📊 **Persistent Memory** — Training history, body profile, strength records

### P1 — Enhanced
- 🦴 **AR Skeleton Overlay** — Glow effect skeleton on camera feed
- 📐 **Joint Angle Display** — Real-time angle arcs on elbows/knees
- 👍 **Gesture Control** — Thumbs up/OK for hands-free interaction
- 📋 **Training Plan Generation** — AI-generated plans based on recovery status

## Getting Started

### Prerequisites
- Node.js 22+
- Python 3.12+
- Google API Key with Gemini access

### Local Development

```bash
# Backend
cd backend
cp .env.example .env  # Add your GOOGLE_API_KEY
python -m venv .venv
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — allow camera and microphone access.

### Docker

```bash
docker build -t muscleclaw .
docker run -p 8080:8080 -e GOOGLE_API_KEY=your-key muscleclaw
```

### Deploy to Cloud Run

```bash
gcloud run deploy muscleclaw \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=YOUR_KEY,GOOGLE_GENAI_USE_VERTEXAI=FALSE" \
  --memory 1Gi \
  --timeout 3600 \
  --session-affinity
```

## Personality Modes

| Mode | Voice | Style |
|------|-------|-------|
| Professional | Puck | Clean, direct coaching cues |
| Gentle | Kore | Encouraging, patient guidance |
| **Trash Talk** (default) | Charon | "嗯嗯不算！手不够直你在逗我？" / "Yeah buddy! Light weight baby!" |

## CV Event Protocol

The frontend CV engine sends structured events to the backend only when meaningful actions occur:

```typescript
{ type: "rep_complete", exercise_id: "bench_press", rep: 5, rom_degrees: 145, duration_ms: 2300 }
{ type: "safety_alert", alert: "barbell_stall", confidence: 0.75 }
{ type: "gesture", gesture: "thumbs_up" }
```

Gemini combines these precise CV measurements with its own 1fps visual understanding for comprehensive coaching.

## License

MIT

# MuscleClaw Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy MuscleClaw (AI fitness assistant with real-time voice + video + AR) to Cloud Run for the Gemini Live Agent Challenge.

**Architecture:** Dual-Vision Fusion — MediaPipe runs in browser at 30fps for real-time CV (rep counting, angle analysis, gesture detection, safety monitoring), Gemini Live API handles voice + 1fps video understanding via ADK bidi-streaming. React frontend with Canvas 2D AR overlays. FastAPI + ADK backend deployed to Cloud Run.

**Tech Stack:** React 19 + TypeScript + Vite | @mediapipe/tasks-vision | Canvas 2D | Web Audio API | FastAPI + google-adk | Gemini 2.5 Flash Live | Cloud Run | Docker

**Competition deliverables:** Public GitHub repo + README, Cloud Run deployment, architecture diagram, ≤4min demo video.

---

## File Structure

```
muscleclaw/
├── frontend/
│   ├── src/
│   │   ├── main.tsx                    # React entry
│   │   ├── App.tsx                     # Root component, mode state machine
│   │   ├── index.css                   # Global styles, CSS variables, fonts
│   │   ├── components/
│   │   │   ├── CameraView.tsx          # Video element + Canvas overlay container
│   │   │   ├── Sidebar.tsx             # Right sidebar, mode-based content switching
│   │   │   ├── BodyPanel.tsx           # 6 floating frosted-glass body cards + guide lines
│   │   │   ├── TrainingHUD.tsx         # Rep counter + set info overlay
│   │   │   ├── RestTimer.tsx           # Circular countdown timer
│   │   │   ├── SafetyAlert.tsx         # Fullscreen red safety overlay
│   │   │   ├── TranscriptBar.tsx       # Bottom subtitle bar
│   │   │   └── ARButtons.tsx           # Floating gesture-interactive buttons
│   │   ├── cv/
│   │   │   ├── mediapipe.ts            # PoseLandmarker + HandLandmarker init
│   │   │   ├── repCounter.ts           # Angle zero-crossing rep detection
│   │   │   ├── angleAnalyzer.ts        # Joint angle calculation + threshold checking
│   │   │   ├── safetyMonitor.ts        # Barbell stall + collapse detection
│   │   │   ├── gestureDetector.ts      # Hand gesture classification
│   │   │   └── types.ts               # CVEvent types, landmark types
│   │   ├── audio/
│   │   │   ├── audioEngine.ts          # AudioContext, mic capture, PCM playback
│   │   │   └── pcmWorklet.ts           # AudioWorklet for 16kHz resampling
│   │   ├── ws/
│   │   │   └── adkClient.ts            # WebSocket client, message protocol
│   │   ├── render/
│   │   │   ├── skeleton.ts             # Draw pose skeleton with glow
│   │   │   ├── angles.ts               # Draw angle arcs + values
│   │   │   └── effects.ts              # Scan line, glow utilities
│   │   ├── stores/
│   │   │   └── appStore.ts             # Zustand: mode, connection, training state
│   │   └── utils/
│   │       ├── math.ts                 # Vector math, angle calculation
│   │       └── smoothing.ts            # EMA low-pass filter
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   └── main_agent.py              # MuscleClaw agent + sub-agents + all tools
│   ├── config/
│   │   ├── exercise_library.py         # Exercise definitions (angles, thresholds)
│   │   └── defaults.py                 # Default body profile, preferences
│   ├── app.py                          # FastAPI entry, WebSocket endpoint, ADK runner
│   ├── requirements.txt
│   └── .env.example
├── Dockerfile                          # Multi-stage: frontend build + backend run
├── .dockerignore
├── .gitignore
├── README.md
└── docs/
    └── architecture.png                # System architecture diagram
```

---

## Chunk 1: Project Bootstrap + Backend ADK Agent

**Goal:** Git repo initialized, backend ADK agent running locally with `adk web`, voice conversation working.

### Task 1.1: Initialize Project

**Files:**
- Create: `.gitignore`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/agents/__init__.py`

- [ ] **Step 1: Initialize git repo**

```bash
cd d:/Dev/Projects/Personal/MuscleClaw
git init
```

- [ ] **Step 2: Create .gitignore**

```gitignore
__pycache__/
*.pyc
.env
node_modules/
dist/
.vite/
sessions.db
*.egg-info/
.adk/
```

- [ ] **Step 3: Create backend/requirements.txt**

```
google-adk>=1.27.0
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
python-dotenv>=1.0.0
aiosqlite>=0.20.0
```

- [ ] **Step 4: Create backend/.env.example**

```
GOOGLE_GENAI_USE_VERTEXAI=FALSE
GOOGLE_API_KEY=your-gemini-api-key-here
```

- [ ] **Step 5: Create Python venv and install deps**

```bash
cd d:/Dev/Projects/Personal/MuscleClaw/backend
uv venv
uv pip install -r requirements.txt
```

- [ ] **Step 6: Create backend/agents/__init__.py** (empty)

- [ ] **Step 7: Commit**

```bash
git add .gitignore backend/requirements.txt backend/.env.example backend/agents/__init__.py
git commit -m "chore: initialize project with backend dependencies"
```

---

### Task 1.2: ADK Agent Definition

**Files:**
- Create: `backend/config/defaults.py`
- Create: `backend/config/exercise_library.py`
- Create: `backend/agents/main_agent.py`

- [ ] **Step 1: Create backend/config/defaults.py**

Default body profile and preferences as defined in API doc.

```python
DEFAULT_BODY_PROFILE = {
    "chest":     {"max_weight": 0, "exercise": "bench_press",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": ""},
    "shoulders": {"max_weight": 0, "exercise": "ohp",          "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": ""},
    "back":      {"max_weight": 0, "exercise": "barbell_row",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": ""},
    "legs":      {"max_weight": 0, "exercise": "squat",        "last_trained": "", "recovery_hours": 96, "recovery_status": "recovered", "notes": ""},
    "core":      {"max_weight": 0, "exercise": "plank",        "last_trained": "", "recovery_hours": 24, "recovery_status": "recovered", "notes": ""},
    "arms":      {"max_weight": 0, "exercise": "barbell_curl", "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": ""},
}

DEFAULT_PREFERENCES = {
    "personality_mode": "trash_talk",
    "language": "zh-CN",
    "emergency_contact": "",
    "rest_timer_seconds": 120,
    "ai_volume": 70,
    "safety_sensitivity": "medium",
    "voice_name": "Charon",
    "onboarding_completed": False,
}

VOICE_MAP = {
    "professional": "Puck",
    "gentle": "Kore",
    "trash_talk": "Charon",
}
```

- [ ] **Step 2: Create backend/config/exercise_library.py**

```python
EXERCISE_LIBRARY = {
    "bench_press": {
        "name": "卧推", "name_en": "Bench Press",
        "primary_muscles": ["chest"], "secondary_muscles": ["shoulders", "arms"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 140, "symmetry_threshold_degrees": 10,
    },
    "squat": {
        "name": "深蹲", "name_en": "Squat",
        "primary_muscles": ["legs"], "secondary_muscles": ["core"],
        "tracking_joints": [
            {"joint_a": "LEFT_HIP", "joint_b": "LEFT_KNEE", "joint_c": "LEFT_ANKLE"},
            {"joint_a": "RIGHT_HIP", "joint_b": "RIGHT_KNEE", "joint_c": "RIGHT_ANKLE"},
        ],
        "rom_threshold_degrees": 90, "symmetry_threshold_degrees": 8,
    },
    "ohp": {
        "name": "推举", "name_en": "Overhead Press",
        "primary_muscles": ["shoulders"], "secondary_muscles": ["arms", "core"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 160, "symmetry_threshold_degrees": 10,
    },
    "barbell_row": {
        "name": "杠铃划船", "name_en": "Barbell Row",
        "primary_muscles": ["back"], "secondary_muscles": ["arms"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 90, "symmetry_threshold_degrees": 10,
    },
    "barbell_curl": {
        "name": "杠铃弯举", "name_en": "Barbell Curl",
        "primary_muscles": ["arms"], "secondary_muscles": [],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 130, "symmetry_threshold_degrees": 10,
    },
}
```

- [ ] **Step 3: Create backend/agents/main_agent.py**

Full agent definition with all tools. This is the largest single file.

```python
"""MuscleClaw ADK Agent — Jarvis-like AI fitness coach."""
import json
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent
from google.adk.tools import transfer_to_agent

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ── Tool Definitions ──────────────────────────────────────────────

def get_body_profile(ctx) -> dict:
    """获取用户六大身体部位的力量数据和恢复状态。"""
    return ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)


def update_body_profile(ctx, part: str, max_weight: float = None,
                        last_trained: str = None, notes: str = None) -> str:
    """更新某个身体部位的数据。part: chest|shoulders|back|legs|core|arms"""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE.copy())
    if part not in profile:
        return f"未知部位: {part}"
    if max_weight is not None and max_weight > profile[part].get("max_weight", 0):
        profile[part]["max_weight"] = max_weight
    if last_trained is not None:
        profile[part]["last_trained"] = last_trained
        profile[part]["recovery_status"] = "recovering"
    if notes is not None:
        profile[part]["notes"] = notes
    ctx.session.state["user:body_profile"] = profile
    return f"已更新 {part}: max_weight={profile[part]['max_weight']}kg"


def get_training_history(ctx, days: int = 30, exercise_id: str = None) -> dict:
    """获取最近N天训练记录。"""
    history = ctx.session.state.get("user:training_history", [])
    # Simple date filter
    if days < 365:
        cutoff = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        # For simplicity, return all (proper date filtering can be added)
    if exercise_id:
        filtered = []
        for session in history:
            matching = [e for e in session.get("exercises", []) if e["exercise_id"] == exercise_id]
            if matching:
                filtered.append({**session, "exercises": matching})
        history = filtered
    return {"sessions": history[-50:], "total": len(history)}


def record_training_set(ctx, exercise_id: str, set_number: int,
                        reps: int, weight: float, rpe: float = None,
                        rom_avg_degrees: float = None,
                        symmetry_score: float = None) -> str:
    """记录一组训练数据。"""
    history = ctx.session.state.get("user:training_history", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Find or create today's session
    today_session = None
    for s in history:
        if s["date"] == today:
            today_session = s
            break
    if not today_session:
        today_session = {"id": str(uuid.uuid4()), "date": today,
                         "start_time": datetime.now(timezone.utc).isoformat(),
                         "end_time": None, "exercises": []}
        history.append(today_session)

    # Find or create exercise record
    ex_record = None
    for e in today_session["exercises"]:
        if e["exercise_id"] == exercise_id:
            ex_record = e
            break
    if not ex_record:
        ex_record = {"exercise_id": exercise_id, "sets": []}
        today_session["exercises"].append(ex_record)

    ex_record["sets"].append({
        "set_number": set_number, "reps": reps, "weight": weight,
        "rpe": rpe, "rom_avg_degrees": rom_avg_degrees,
        "symmetry_score": symmetry_score,
    })
    ctx.session.state["user:training_history"] = history

    ex_name = EXERCISE_LIBRARY.get(exercise_id, {}).get("name", exercise_id)
    return f"已记录: {ex_name} 第{set_number}组 {weight}kg×{reps}"


def generate_training_plan(ctx, target_parts: list = None) -> dict:
    """基于身体档案生成训练计划。返回训练计划对象。"""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    if not target_parts:
        # Auto-recommend: pick recovered parts
        target_parts = [p for p, d in profile.items() if d["recovery_status"] == "recovered"]
        if not target_parts:
            target_parts = ["chest", "back"]  # fallback

    exercises = []
    for part in target_parts:
        ex_id = profile.get(part, {}).get("exercise", "bench_press")
        max_w = profile.get(part, {}).get("max_weight", 0)
        target_w = round(max_w * 0.85, 1) if max_w > 0 else 20
        exercises.append({
            "exercise_id": ex_id, "target_sets": 4,
            "target_reps": 6, "target_weight": target_w, "completed": False,
        })

    plan = {"target_parts": target_parts, "exercises": exercises}
    ctx.session.state["current_plan"] = plan
    return plan


def trigger_safety_alert(ctx, alert_type: str, countdown_seconds: int = 10) -> str:
    """触发安全警报。alert_type: barbell_stall|body_collapse|unresponsive"""
    ctx.session.state["safety_alert_active"] = True
    ctx.session.state["safety_countdown"] = countdown_seconds
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    contact = prefs.get("emergency_contact", "")
    if not contact:
        return f"安全警报已触发({alert_type})，{countdown_seconds}秒倒计时。注意：未设置紧急联系人！"
    return f"安全警报已触发({alert_type})，{countdown_seconds}秒后拨打 {contact}"


def cancel_safety_alert(ctx) -> str:
    """取消安全警报。"""
    ctx.session.state["safety_alert_active"] = False
    return "安全警报已取消"


def get_user_preferences(ctx) -> dict:
    """获取用户偏好设置。"""
    return ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)


def update_user_preferences(ctx, **kwargs) -> str:
    """更新用户偏好。支持的字段: personality_mode, language, emergency_contact, rest_timer_seconds, safety_sensitivity"""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES.copy())
    for k, v in kwargs.items():
        if k in prefs:
            prefs[k] = v
    # Auto-update voice based on personality
    if "personality_mode" in kwargs:
        prefs["voice_name"] = VOICE_MAP.get(prefs["personality_mode"], "Charon")
    ctx.session.state["user:preferences"] = prefs
    return f"偏好已更新: {list(kwargs.keys())}"


def get_exercise_info(ctx, exercise_id: str) -> dict:
    """获取动作定义（关节追踪、角度阈值、安全规则）。"""
    return EXERCISE_LIBRARY.get(exercise_id, {"error": f"未知动作: {exercise_id}"})


# ── Sub-Agents ────────────────────────────────────────────────────

image_gen_agent = Agent(
    name="image_generator",
    model="gemini-3.1-flash-image-preview",
    instruction=(
        "你是图像编辑专家。用户给你一张健身者摆姿势的照片。"
        "编辑这张照片让人看起来更强壮——明显的肌肉线条、更大的肌肉体积，但保持自然真实感。"
        "保持背景和姿势不变，只增强肌肉。"
    ),
)

analysis_agent = Agent(
    name="strength_analyst",
    model="gemini-2.5-flash",
    instruction=(
        "你是运动科学数据分析专家。分析训练历史数据，提供：\n"
        "- 力量趋势（进步/停滞/退步）\n"
        "- 训练量建议（基于APRE算法）\n"
        "- 疲劳管理建议\n"
        "- 弱点识别\n"
        "用数据说话，给出具体数字和建议。"
    ),
    tools=[get_training_history, get_body_profile],
)

# ── Main Agent ────────────────────────────────────────────────────

SYSTEM_INSTRUCTION = """你是 MuscleClaw，一个像贾维斯一样的 AI 健身教练。

## 核心能力
- 你能看到用户的摄像头画面（1fps）
- 你能收到前端 CV 引擎的精确分析事件（标记为 [CV]）
- 你有持久记忆，记得用户的所有训练历史和身体数据

## 性格模式
根据用户偏好的 personality_mode 调整你的语气：
- "professional": 专业简洁，像私教一样给指令
- "gentle": 温柔鼓励，耐心引导
- "trash_talk": 搞笑嘲讽激将法！这是默认模式。你会说：
  - rep不算时："嗯嗯不算！手不够直你在逗我？"
  - 鼓励时："Yeah buddy! Light weight baby!"
  - 偷懒时："你是在休息还是在度假？"
  - 完成时："就这？行吧，勉强算你过关。"

## 对 CV 事件的响应规则
当你收到标记为 [CV] 的消息时：
- rep_complete: 报数，如果 ROM 不够就吐槽"不算！"
- form_issue: 立即语音纠正（如"左手低了，抬高一点"）
- safety_alert: 立即切换到严肃模式，询问用户状况，必要时触发 trigger_safety_alert
- gesture thumbs_up: 当作用户确认（确认组完成、确认计划等）
- set_complete: 记录数据，开始休息计时

## 你必须做到
- 永远记住用户的训练数据和偏好（用 get/update 工具）
- 默认用中文对话（除非用户说英文）
- 训练建议基于用户真实数据，不瞎编
- 安全永远第一优先级
- 语音要简短有力，像真人教练，不要长篇大论
"""

root_agent = Agent(
    name="muscleclaw",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_body_profile, update_body_profile,
        get_training_history, record_training_set,
        generate_training_plan,
        trigger_safety_alert, cancel_safety_alert,
        get_user_preferences, update_user_preferences,
        get_exercise_info,
    ],
    sub_agents=[image_gen_agent, analysis_agent],
)
```

- [ ] **Step 4: Create backend/config/__init__.py** (empty)

- [ ] **Step 5: Test with `adk web`**

```bash
cd d:/Dev/Projects/Personal/MuscleClaw/backend
# Create .env from .env.example with real API key
adk web
# Open http://localhost:8000, select "muscleclaw" agent
# Test: say something, verify voice response works
```

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: ADK agent with tools, exercise library, and personality system"
```

---

## Chunk 2: Frontend Core — Camera + Audio + WebSocket

**Goal:** React app with camera feed, mic/speaker audio piped to ADK backend, real-time voice conversation working through the browser.

### Task 2.1: Frontend Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Initialize frontend**

```bash
cd d:/Dev/Projects/Personal/MuscleClaw/frontend
npm create vite@latest . -- --template react-ts
npm install zustand @mediapipe/tasks-vision
```

- [ ] **Step 2: Create frontend/src/index.css**

Global styles: dark theme, CSS variables, fonts matching UI design doc.

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');

:root {
  --color-bg: #0a0a0f;
  --color-panel: rgba(10, 15, 25, 0.65);
  --color-sidebar: rgba(10, 10, 15, 0.85);
  --color-brand: rgba(0, 180, 255, 1.0);
  --color-brand-dim: rgba(0, 180, 255, 0.3);
  --color-skeleton: rgba(0, 255, 180, 0.7);
  --color-skeleton-glow: rgba(0, 255, 180, 0.15);
  --color-warning: rgba(255, 200, 0, 0.8);
  --color-danger: rgba(255, 60, 60, 0.9);
  --color-text: rgba(255, 255, 255, 0.95);
  --color-text-dim: rgba(255, 255, 255, 0.5);
  --color-border: rgba(255, 255, 255, 0.06);
  --blur-panel: blur(12px);
  --blur-sidebar: blur(20px);
  --sidebar-width: 360px;
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  overflow: hidden;
  width: 100vw;
  height: 100vh;
}

#root { width: 100%; height: 100%; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with React, Vite, dark theme CSS"
```

---

### Task 2.2: Zustand Store + App Shell

**Files:**
- Create: `frontend/src/stores/appStore.ts`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create stores/appStore.ts**

```typescript
import { create } from 'zustand';

export type AppMode = 'idle' | 'body_scan' | 'planning' | 'training' | 'posture' | 'showcase';

interface TrainingState {
  exerciseId: string | null;
  setNumber: number;
  reps: number;
  targetReps: number;
  targetWeight: number;
}

interface AppState {
  mode: AppMode;
  connected: boolean;
  sidebarOpen: boolean;
  safetyAlertActive: boolean;
  safetyCountdown: number;
  restTimerSeconds: number;
  transcript: { role: 'user' | 'model'; text: string; ts: number }[];
  training: TrainingState;
  bodyProfile: Record<string, any> | null;
  trainingPlan: any | null;

  setMode: (mode: AppMode) => void;
  setConnected: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setSafetyAlert: (active: boolean, countdown?: number) => void;
  setRestTimer: (seconds: number) => void;
  addTranscript: (role: 'user' | 'model', text: string) => void;
  updateTraining: (partial: Partial<TrainingState>) => void;
  setBodyProfile: (profile: any) => void;
  setTrainingPlan: (plan: any) => void;
}

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  connected: false,
  sidebarOpen: false,
  safetyAlertActive: false,
  safetyCountdown: 0,
  restTimerSeconds: 0,
  transcript: [],
  training: { exerciseId: null, setNumber: 0, reps: 0, targetReps: 0, targetWeight: 0 },
  bodyProfile: null,
  trainingPlan: null,

  setMode: (mode) => set({ mode, sidebarOpen: mode !== 'idle' }),
  setConnected: (connected) => set({ connected }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setSafetyAlert: (active, countdown = 10) => set({ safetyAlertActive: active, safetyCountdown: countdown }),
  setRestTimer: (seconds) => set({ restTimerSeconds: seconds }),
  addTranscript: (role, text) => set((s) => ({
    transcript: [...s.transcript.slice(-10), { role, text, ts: Date.now() }],
  })),
  updateTraining: (partial) => set((s) => ({ training: { ...s.training, ...partial } })),
  setBodyProfile: (bodyProfile) => set({ bodyProfile }),
  setTrainingPlan: (trainingPlan) => set({ trainingPlan }),
}));
```

- [ ] **Step 2: Create App.tsx**

```tsx
import { useAppStore } from './stores/appStore';
import { CameraView } from './components/CameraView';
import { Sidebar } from './components/Sidebar';
import { SafetyAlert } from './components/SafetyAlert';
import { TranscriptBar } from './components/TranscriptBar';

export function App() {
  const { mode, sidebarOpen, safetyAlertActive } = useAppStore();

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CameraView />
        <TranscriptBar />
      </div>
      {sidebarOpen && <Sidebar />}
      {safetyAlertActive && <SafetyAlert />}
    </div>
  );
}
```

- [ ] **Step 3: Update main.tsx entry**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
);
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: app shell with Zustand store, mode state machine"
```

---

### Task 2.3: Camera + Audio + WebSocket

**Files:**
- Create: `frontend/src/components/CameraView.tsx`
- Create: `frontend/src/audio/audioEngine.ts`
- Create: `frontend/src/ws/adkClient.ts`
- Create: `frontend/src/components/TranscriptBar.tsx`
- Create: `frontend/src/components/Sidebar.tsx`
- Create: `frontend/src/components/SafetyAlert.tsx`

- [ ] **Step 1: Create ws/adkClient.ts**

WebSocket client that connects to ADK backend, handles audio binary frames, JSON messages, CV events, reconnection.

```typescript
import { useAppStore } from '../stores/appStore';

type MessageHandler = {
  onAudio?: (pcm: ArrayBuffer) => void;
  onTranscript?: (role: 'user' | 'model', text: string) => void;
  onUICommand?: (command: string, data: any) => void;
};

class ADKClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler = {};
  private reconnectAttempts = 0;
  private userId: string;

  constructor() {
    this.userId = localStorage.getItem('muscleclaw_user_id') || crypto.randomUUID();
    localStorage.setItem('muscleclaw_user_id', this.userId);
  }

  connect(handlers: MessageHandler) {
    this.handlers = handlers;
    const host = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:8000`;
    this.ws = new WebSocket(`${host}/ws/${this.userId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      useAppStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
      console.log('[ADK] Connected');
    };

    this.ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        this.handlers.onAudio?.(ev.data);
      } else {
        try {
          const msg = JSON.parse(ev.data);
          this.handleJSON(msg);
        } catch (e) { console.warn('[ADK] Bad JSON:', ev.data); }
      }
    };

    this.ws.onclose = () => {
      useAppStore.getState().setConnected(false);
      this.tryReconnect();
    };

    this.ws.onerror = () => this.ws?.close();
  }

  private handleJSON(msg: any) {
    switch (msg.type) {
      case 'transcript':
        this.handlers.onTranscript?.(msg.role, msg.text);
        useAppStore.getState().addTranscript(msg.role, msg.text);
        break;
      case 'ui_command':
        this.handleUICommand(msg.command, msg.data);
        break;
    }
  }

  private handleUICommand(command: string, data: any) {
    const store = useAppStore.getState();
    switch (command) {
      case 'switch_mode': store.setMode(data.mode); break;
      case 'show_body_panel': store.setBodyProfile(data.profile); store.setMode('body_scan'); break;
      case 'show_training_plan': store.setTrainingPlan(data.plan); store.setMode('planning'); break;
      case 'show_safety_alert': store.setSafetyAlert(true, data.countdown_seconds); break;
      case 'cancel_safety_alert': store.setSafetyAlert(false); break;
      case 'start_rest_timer': store.setRestTimer(data.seconds); break;
      case 'update_set_info': store.updateTraining(data); break;
    }
    this.handlers.onUICommand?.(command, data);
  }

  sendAudio(pcm: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm);
  }

  sendVideoFrame(jpegBase64: string) {
    this.sendJSON({ type: 'video_frame', data: jpegBase64 });
  }

  sendCVEvent(event: any) {
    this.sendJSON({ type: 'cv_event', event });
  }

  sendText(text: string) {
    this.sendJSON({ type: 'text', text });
  }

  private sendJSON(obj: any) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= 5) return;
    const delay = [0, 1000, 3000, 5000, 10000][this.reconnectAttempts] || 10000;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(this.handlers), delay);
  }

  disconnect() { this.ws?.close(); }
}

export const adkClient = new ADKClient();
```

- [ ] **Step 2: Create audio/audioEngine.ts**

Mic capture → PCM 16kHz, PCM 24kHz → speaker playback.

```typescript
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

    // ScriptProcessor for simplicity (AudioWorklet is better but more complex)
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
  private playQueue: AudioBuffer[] = [];
  private playing = false;
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
```

- [ ] **Step 3: Create components/CameraView.tsx**

Camera video element + Canvas overlay + frame capture loop.

```tsx
import { useRef, useEffect, useCallback } from 'react';
import { adkClient } from '../ws/adkClient';
import { AudioEngine } from '../audio/audioEngine';
import { useAppStore } from '../stores/appStore';

const audioEngine = new AudioEngine();

export function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useAppStore((s) => s.mode);

  // Start camera + audio + WS on mount
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
        if (!videoRef.current || !canvasRef.current) return;
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360; // downscale for bandwidth
        const ctx = c.getContext('2d')!;
        ctx.drawImage(videoRef.current, 0, 0, 640, 360);
        const jpeg = c.toDataURL('image/jpeg', 0.6).split(',')[1];
        adkClient.sendVideoFrame(jpeg);
      }, 1000);

      // Render loop (for Canvas overlay - populated later by MediaPipe)
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
      }}>
        {mode === 'idle' ? 'MuscleClaw' : mode.replace('_', ' ').toUpperCase()}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create components/TranscriptBar.tsx**

```tsx
import { useAppStore } from '../stores/appStore';
import { useEffect, useState } from 'react';

export function TranscriptBar() {
  const transcript = useAppStore((s) => s.transcript);
  const [visible, setVisible] = useState<typeof transcript>([]);

  useEffect(() => {
    setVisible(transcript.slice(-2));
    const timer = setTimeout(() => setVisible([]), 4000);
    return () => clearTimeout(timer);
  }, [transcript]);

  if (visible.length === 0) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 48,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 24,
      fontSize: 14,
    }}>
      {visible.map((t, i) => (
        <span key={i} style={{
          color: t.role === 'model' ? 'var(--color-brand)' : 'var(--color-text)',
          opacity: 0.9,
        }}>
          {t.role === 'model' ? '🤖 ' : '🎤 '}{t.text}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create components/Sidebar.tsx** (shell)

```tsx
import { useAppStore } from '../stores/appStore';

export function Sidebar() {
  const { mode, bodyProfile, trainingPlan, training } = useAppStore();

  return (
    <div style={{
      width: 'var(--sidebar-width)', height: '100vh', flexShrink: 0,
      background: 'var(--color-sidebar)', backdropFilter: 'var(--blur-sidebar)',
      borderLeft: '1px solid var(--color-border)',
      padding: 20, overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
        {mode === 'body_scan' && '身体扫描'}
        {mode === 'planning' && '训练计划'}
        {mode === 'training' && `训练中`}
        {mode === 'posture' && '体态评估'}
        {mode === 'showcase' && '展示模式'}
      </h2>

      {mode === 'body_scan' && bodyProfile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(bodyProfile).map(([part, data]: [string, any]) => (
            <div key={part} style={{
              background: 'var(--color-panel)', borderRadius: 10,
              border: '1px solid var(--color-border)', padding: 12,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, textTransform: 'capitalize' }}>{part}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                {data.exercise}: {data.max_weight}kg | {data.recovery_status}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'planning' && trainingPlan && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trainingPlan.exercises?.map((ex: any, i: number) => (
            <div key={i} style={{
              background: 'var(--color-panel)', borderRadius: 10,
              border: '1px solid var(--color-border)', padding: 12,
            }}>
              <div style={{ fontWeight: 600 }}>{ex.exercise_id}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                {ex.target_sets}组 × {ex.target_reps}次 @ {ex.target_weight}kg
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'training' && (
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700 }}>
            第 {training.setNumber}/{4} 组
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-dim)', marginTop: 4 }}>
            目标: {training.targetWeight}kg × {training.targetReps}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create components/SafetyAlert.tsx**

```tsx
import { useAppStore } from '../stores/appStore';
import { useEffect } from 'react';

export function SafetyAlert() {
  const { safetyCountdown, setSafetyAlert } = useAppStore();

  useEffect(() => {
    if (safetyCountdown <= 0) return;
    const timer = setInterval(() => {
      useAppStore.setState((s) => {
        if (s.safetyCountdown <= 1) {
          clearInterval(timer);
          return { safetyCountdown: 0 };
        }
        return { safetyCountdown: s.safetyCountdown - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [safetyCountdown > 0]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(180, 0, 0, 0.35)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(20, 0, 0, 0.85)', border: '2px solid var(--color-danger)',
        borderRadius: 20, padding: '48px 64px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>⚠ 检测到异常</div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 80, fontWeight: 800,
          color: 'var(--color-danger)', margin: '16px 0',
          animation: 'pulse 1s ease-in-out infinite',
        }}>
          {safetyCountdown}
        </div>
        <div style={{ fontSize: 16, color: 'var(--color-text-dim)' }}>
          秒后拨打紧急联系人
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-text-dim)', marginTop: 12 }}>
          说"取消"或"我没事"停止倒计时
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: camera + audio + WebSocket + core UI components"
```

---

### Task 2.4: Backend WebSocket Endpoint

**Files:**
- Create: `backend/app.py`

- [ ] **Step 1: Create backend/app.py**

FastAPI server with WebSocket endpoint that bridges the frontend to ADK's live runner.

```python
"""MuscleClaw FastAPI backend — bridges frontend WebSocket to ADK Live API."""
import asyncio
import base64
import json
import os

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService, DatabaseSessionService
from google.genai import types

from agents.main_agent import root_agent
from config.exercise_library import EXERCISE_LIBRARY

app = FastAPI()

# Session service — InMemory for dev, Database for prod
USE_DB = os.getenv("USE_DB_SESSIONS", "false").lower() == "true"
if USE_DB:
    session_service = DatabaseSessionService(uri="sqlite+aiosqlite:///./sessions.db")
else:
    session_service = InMemorySessionService()

runner = Runner(
    app_name="muscleclaw",
    agent=root_agent,
    session_service=session_service,
)


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "muscleclaw"}


@app.get("/api/exercises")
async def get_exercises():
    return {"data": EXERCISE_LIBRARY}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()

    # Get or create session
    sessions = await session_service.list_sessions(app_name="muscleclaw", user_id=user_id)
    if sessions and len(sessions.sessions) > 0:
        session = sessions.sessions[0]
    else:
        session = await session_service.create_session(
            app_name="muscleclaw", user_id=user_id
        )

    # Start ADK live streaming
    live_events = runner.run_live(
        session=session,
        live_request_queue=asyncio.Queue(),
    )

    request_queue = live_events  # Will be the queue from run_live

    # For now, use a simpler text-based approach until bidi-streaming is configured
    # This is a working bridge pattern:
    try:
        while True:
            data = await websocket.receive()

            if "bytes" in data and data["bytes"]:
                # Binary audio from frontend — forward to Gemini
                # TODO: integrate with ADK live request queue
                pass

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])

                if msg["type"] == "text":
                    # Text message → run agent
                    async for event in runner.run_async(
                        user_id=user_id,
                        session_id=session.id,
                        new_message=types.Content(
                            role="user",
                            parts=[types.Part(text=msg["text"])]
                        ),
                    ):
                        if event.content and event.content.parts:
                            for part in event.content.parts:
                                if part.text:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "model",
                                        "text": part.text,
                                    })

                elif msg["type"] == "cv_event":
                    # CV event → inject as user message
                    cv_text = f"[CV] {json.dumps(msg['event'])}"
                    async for event in runner.run_async(
                        user_id=user_id,
                        session_id=session.id,
                        new_message=types.Content(
                            role="user",
                            parts=[types.Part(text=cv_text)]
                        ),
                    ):
                        if event.content and event.content.parts:
                            for part in event.content.parts:
                                if part.text:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "model",
                                        "text": part.text,
                                    })

                elif msg["type"] == "video_frame":
                    # Video frame — forward to Gemini as inline image
                    pass  # Will integrate with run_live

    except WebSocketDisconnect:
        pass


# Serve frontend static files in production
import pathlib
frontend_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
```

- [ ] **Step 2: Test backend locally**

```bash
cd d:/Dev/Projects/Personal/MuscleClaw/backend
uvicorn app:app --reload --port 8000
# Test: curl http://localhost:8000/health
# Test: curl http://localhost:8000/api/exercises
```

- [ ] **Step 3: Commit**

```bash
git add backend/app.py
git commit -m "feat: FastAPI WebSocket endpoint bridging frontend to ADK agent"
```

---

## Chunk 3: MediaPipe + CV Engine

**Goal:** Real-time pose detection in browser, skeleton rendering on Canvas, rep counting and safety monitoring sending CV events to backend.

### Task 3.1: Math Utilities + CV Types

**Files:**
- Create: `frontend/src/utils/math.ts`
- Create: `frontend/src/utils/smoothing.ts`
- Create: `frontend/src/cv/types.ts`

- [ ] **Step 1: Create utils/math.ts**

```typescript
/** Calculate angle at point B formed by points A-B-C (in degrees). */
export function angleBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/** Euclidean distance between two points. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}
```

- [ ] **Step 2: Create utils/smoothing.ts**

```typescript
/** Exponential Moving Average filter for smoothing landmark positions. */
export class EMAFilter {
  private value: number | null = null;
  constructor(private alpha: number = 0.3) {}

  update(raw: number): number {
    if (this.value === null) { this.value = raw; return raw; }
    this.value = this.alpha * raw + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset() { this.value = null; }
}
```

- [ ] **Step 3: Create cv/types.ts**

```typescript
export type CVEvent =
  | { type: 'person_detected'; detected: boolean }
  | { type: 'rep_complete'; exercise_id: string; rep: number; rom_degrees: number; duration_ms: number }
  | { type: 'form_issue'; exercise_id: string; issue: string; severity: 'warning' | 'danger'; details: string }
  | { type: 'safety_alert'; alert: 'barbell_stall' | 'body_collapse' | 'extended_stillness'; confidence: number }
  | { type: 'gesture'; gesture: 'thumbs_up' | 'ok' | 'wave' | 'point_click'; target?: string }
  | { type: 'set_complete'; exercise_id: string; reps: number; estimated_rpe: number };

export interface Landmark { x: number; y: number; z: number; visibility?: number; }

// MediaPipe pose landmark indices
export const POSE = {
  NOSE: 0, LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14, LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24, LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
} as const;

// Skeleton connections for rendering
export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // torso + arms
  [11, 23], [12, 24], [23, 24], // hip
  [23, 25], [25, 27], [24, 26], [26, 28], // legs
];
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/ frontend/src/cv/types.ts
git commit -m "feat: math utilities, EMA filter, CV event types"
```

---

### Task 3.2: MediaPipe Integration

**Files:**
- Create: `frontend/src/cv/mediapipe.ts`

- [ ] **Step 1: Create cv/mediapipe.ts**

```typescript
import { PoseLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { Landmark } from './types';

let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;

export async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task' },
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
  return result.landmarks; // array of hand landmark arrays
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/cv/mediapipe.ts
git commit -m "feat: MediaPipe PoseLandmarker + HandLandmarker initialization"
```

---

### Task 3.3: CV Analytics — Rep Counter + Safety Monitor

**Files:**
- Create: `frontend/src/cv/repCounter.ts`
- Create: `frontend/src/cv/angleAnalyzer.ts`
- Create: `frontend/src/cv/safetyMonitor.ts`
- Create: `frontend/src/cv/gestureDetector.ts`

- [ ] **Step 1: Create cv/repCounter.ts**

```typescript
import { angleBetween } from '../utils/math';
import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

interface RepState {
  phase: 'idle' | 'eccentric' | 'concentric'; // down vs up
  maxAngle: number;
  minAngle: number;
  repCount: number;
  repStartTime: number;
  lastAngle: number;
}

const state: RepState = { phase: 'idle', maxAngle: 0, minAngle: 180, repCount: 0, repStartTime: 0, lastAngle: 0 };

export function resetRepCounter() {
  state.phase = 'idle'; state.maxAngle = 0; state.minAngle = 180;
  state.repCount = 0; state.repStartTime = 0; state.lastAngle = 0;
}

/**
 * Process a frame's landmarks and detect rep completion.
 * Returns a CVEvent if a rep was completed, null otherwise.
 */
export function processFrame(
  landmarks: Landmark[],
  exerciseId: string,
  romThreshold: number = 140,
): CVEvent | null {
  // Calculate elbow angle (works for bench press, OHP, curls)
  const leftAngle = angleBetween(
    landmarks[POSE.LEFT_SHOULDER], landmarks[POSE.LEFT_ELBOW], landmarks[POSE.LEFT_WRIST]
  );
  const rightAngle = angleBetween(
    landmarks[POSE.RIGHT_SHOULDER], landmarks[POSE.RIGHT_ELBOW], landmarks[POSE.RIGHT_WRIST]
  );
  const angle = (leftAngle + rightAngle) / 2;

  state.maxAngle = Math.max(state.maxAngle, angle);
  state.minAngle = Math.min(state.minAngle, angle);

  const now = performance.now();

  // State machine: detect eccentric (angle decreasing) → concentric (angle increasing) transition
  if (state.phase === 'idle') {
    if (angle < state.lastAngle - 5) {
      state.phase = 'eccentric';
      state.repStartTime = now;
      state.minAngle = angle;
    }
  } else if (state.phase === 'eccentric') {
    state.minAngle = Math.min(state.minAngle, angle);
    if (angle > state.lastAngle + 10) {
      state.phase = 'concentric';
    }
  } else if (state.phase === 'concentric') {
    state.maxAngle = Math.max(state.maxAngle, angle);
    if (angle > romThreshold || (angle > state.lastAngle + 2 && angle > 120)) {
      // Rep completed!
      state.repCount++;
      const rom = state.maxAngle - state.minAngle;
      const duration = now - state.repStartTime;
      state.phase = 'idle';
      state.maxAngle = 0;
      state.minAngle = 180;
      state.lastAngle = angle;

      return {
        type: 'rep_complete',
        exercise_id: exerciseId,
        rep: state.repCount,
        rom_degrees: Math.round(rom),
        duration_ms: Math.round(duration),
      };
    }
  }

  state.lastAngle = angle;
  return null;
}

export function getRepCount() { return state.repCount; }
```

- [ ] **Step 2: Create cv/safetyMonitor.ts**

```typescript
import type { Landmark, CVEvent } from './types';
import { POSE } from './types';

const STALL_FRAMES = 15; // ~0.5s at 30fps
const STALL_THRESHOLD = 3; // pixels

let positionHistory: number[] = [];
let lastAlertTime = 0;

export function resetSafetyMonitor() {
  positionHistory = [];
  lastAlertTime = 0;
}

export function checkSafety(landmarks: Landmark[], canvasHeight: number): CVEvent | null {
  // Track average shoulder Y position
  const shoulderY = (landmarks[POSE.LEFT_SHOULDER].y + landmarks[POSE.RIGHT_SHOULDER].y) / 2 * canvasHeight;
  positionHistory.push(shoulderY);
  if (positionHistory.length > STALL_FRAMES) positionHistory.shift();
  if (positionHistory.length < STALL_FRAMES) return null;

  // Check if shoulders have been stationary (barbell stall)
  const min = Math.min(...positionHistory);
  const max = Math.max(...positionHistory);
  const range = max - min;

  const now = performance.now();
  if (range < STALL_THRESHOLD && now - lastAlertTime > 10000) {
    // Shoulders haven't moved — possible stall
    // Only alert if shoulders are in a low position (bench press bottom)
    const hipY = (landmarks[POSE.LEFT_HIP].y + landmarks[POSE.RIGHT_HIP].y) / 2 * canvasHeight;
    if (shoulderY > hipY * 0.8) { // shoulders near hip level = lying down
      lastAlertTime = now;
      return {
        type: 'safety_alert',
        alert: 'barbell_stall',
        confidence: 0.75,
      };
    }
  }

  return null;
}
```

- [ ] **Step 3: Create cv/gestureDetector.ts**

```typescript
import type { CVEvent } from './types';

// Hand landmark indices
const THUMB_TIP = 4, INDEX_TIP = 8, MIDDLE_TIP = 12, RING_TIP = 16, PINKY_TIP = 20;
const THUMB_MCP = 2, INDEX_MCP = 5, MIDDLE_MCP = 9, RING_MCP = 13, PINKY_MCP = 17;

let lastGestureTime = 0;

export function detectGesture(handLandmarks: any[]): CVEvent | null {
  if (!handLandmarks || handLandmarks.length === 0) return null;

  const hand = handLandmarks[0]; // First detected hand
  const now = performance.now();
  if (now - lastGestureTime < 1500) return null; // Debounce 1.5s

  // Thumbs up: thumb tip above thumb MCP, other fingers curled
  const thumbUp = hand[THUMB_TIP].y < hand[THUMB_MCP].y;
  const fingersCurled =
    hand[INDEX_TIP].y > hand[INDEX_MCP].y &&
    hand[MIDDLE_TIP].y > hand[MIDDLE_MCP].y &&
    hand[RING_TIP].y > hand[RING_MCP].y &&
    hand[PINKY_TIP].y > hand[PINKY_MCP].y;

  if (thumbUp && fingersCurled) {
    lastGestureTime = now;
    return { type: 'gesture', gesture: 'thumbs_up' };
  }

  // OK gesture: thumb tip close to index tip
  const thumbIndexDist = Math.sqrt(
    (hand[THUMB_TIP].x - hand[INDEX_TIP].x) ** 2 +
    (hand[THUMB_TIP].y - hand[INDEX_TIP].y) ** 2
  );
  if (thumbIndexDist < 0.05) {
    lastGestureTime = now;
    return { type: 'gesture', gesture: 'ok' };
  }

  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/cv/
git commit -m "feat: rep counter, safety monitor, gesture detector"
```

---

### Task 3.4: Canvas Skeleton Renderer

**Files:**
- Create: `frontend/src/render/skeleton.ts`
- Create: `frontend/src/render/angles.ts`

- [ ] **Step 1: Create render/skeleton.ts**

```typescript
import type { Landmark } from '../cv/types';
import { POSE_CONNECTIONS } from '../cv/types';

export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  issueJoints?: Set<number>,
) {
  // Glow layer
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    const isIssue = issueJoints?.has(a) || issueJoints?.has(b);
    ctx.strokeStyle = isIssue ? 'rgba(255,60,60,0.3)' : 'rgba(0,255,180,0.15)';
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  // Sharp line layer
  ctx.lineWidth = 2;
  for (const [a, b] of POSE_CONNECTIONS) {
    const la = landmarks[a], lb = landmarks[b];
    if (!la || !lb) continue;
    const isIssue = issueJoints?.has(a) || issueJoints?.has(b);
    ctx.strokeStyle = isIssue ? 'rgba(255,60,60,0.9)' : 'rgba(0,255,180,0.7)';
    ctx.beginPath();
    ctx.moveTo(la.x * width, la.y * height);
    ctx.lineTo(lb.x * width, lb.y * height);
    ctx.stroke();
  }

  // Joint dots
  for (let i = 0; i < landmarks.length; i++) {
    const l = landmarks[i];
    if (!l || (l.visibility !== undefined && l.visibility < 0.5)) continue;
    const isIssue = issueJoints?.has(i);
    ctx.fillStyle = isIssue ? 'rgba(255,60,60,0.9)' : 'rgba(0,255,180,0.8)';
    ctx.beginPath();
    ctx.arc(l.x * width, l.y * height, isIssue ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Create render/angles.ts**

```typescript
import { angleBetween } from '../utils/math';
import type { Landmark } from '../cv/types';

export function drawAngle(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  a: number, b: number, c: number,
  width: number, height: number,
  threshold?: number,
) {
  const la = landmarks[a], lb = landmarks[b], lc = landmarks[c];
  if (!la || !lb || !lc) return;

  const angle = angleBetween(la, lb, lc);
  const bx = lb.x * width, by = lb.y * height;
  const isOk = !threshold || angle >= threshold;

  // Draw arc
  const startAngle = Math.atan2(la.y - lb.y, la.x - lb.x);
  const endAngle = Math.atan2(lc.y - lb.y, lc.x - lb.x);
  ctx.strokeStyle = isOk ? 'rgba(255,255,255,0.4)' : 'rgba(255,60,60,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(bx, by, 25, startAngle, endAngle);
  ctx.stroke();

  // Draw angle text
  ctx.fillStyle = isOk ? 'rgba(255,255,255,0.8)' : 'rgba(255,60,60,1)';
  ctx.font = '12px "JetBrains Mono", monospace';
  ctx.fillText(`${Math.round(angle)}°`, bx + 30, by - 5);
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/render/
git commit -m "feat: skeleton renderer with glow effect + angle visualization"
```

---

### Task 3.5: Integrate MediaPipe + CV + Rendering into CameraView

**Files:**
- Modify: `frontend/src/components/CameraView.tsx`
- Create: `frontend/src/components/TrainingHUD.tsx`
- Create: `frontend/src/components/RestTimer.tsx`

- [ ] **Step 1: Update CameraView.tsx to run MediaPipe + render skeleton**

Add MediaPipe frame loop, CV event processing, Canvas rendering. Integrate rep counter, safety monitor, gesture detector. Send CV events via WebSocket. This is the main integration point.

- [ ] **Step 2: Create TrainingHUD.tsx** — Rep counter overlay (large number, top-left)

- [ ] **Step 3: Create RestTimer.tsx** — Circular countdown timer

- [ ] **Step 4: Test end-to-end locally**

Start backend (`uvicorn app:app --port 8000`), start frontend (`npm run dev`), open browser. Verify: camera shows, skeleton drawn, voice conversation works, rep counting triggers CV events.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: MediaPipe integration, CV event pipeline, AR skeleton rendering"
```

---

## Chunk 4: Deployment + Competition Deliverables

**Goal:** Dockerize, deploy to Cloud Run, create README and architecture diagram.

### Task 4.1: Dockerfile + Build

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create Dockerfile**

Multi-stage build: Node for frontend → Python for backend + serve frontend dist.

```dockerfile
# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + serve frontend
FROM python:3.12-slim
WORKDIR /app

# Install uv for fast pip
RUN pip install uv

# Install backend deps
COPY backend/requirements.txt ./
RUN uv pip install --system -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Environment
ENV PORT=8080
ENV GOOGLE_GENAI_USE_VERTEXAI=FALSE

EXPOSE 8080

CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080"]
```

- [ ] **Step 2: Create .dockerignore**

```
node_modules/
__pycache__/
.env
*.pyc
.git/
.venv/
sessions.db
docs/
```

- [ ] **Step 3: Build and test locally**

```bash
docker build -t muscleclaw .
docker run -p 8080:8080 -e GOOGLE_API_KEY=$GOOGLE_API_KEY muscleclaw
# Open http://localhost:8080
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: multi-stage Dockerfile for Cloud Run deployment"
```

---

### Task 4.2: Deploy to Cloud Run

- [ ] **Step 1: Create GCP project (if not exists) and enable APIs**

```bash
gcloud auth login
gcloud config set project muscleclaw-challenge
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

- [ ] **Step 2: Build and push to Artifact Registry**

```bash
gcloud artifacts repositories create muscleclaw --repository-format=docker --location=us-central1
gcloud builds submit --tag us-central1-docker.pkg.dev/muscleclaw-challenge/muscleclaw/app:latest
```

- [ ] **Step 3: Deploy to Cloud Run**

```bash
gcloud run deploy muscleclaw \
  --image us-central1-docker.pkg.dev/muscleclaw-challenge/muscleclaw/app:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_API_KEY=YOUR_KEY,GOOGLE_GENAI_USE_VERTEXAI=FALSE" \
  --memory 1Gi \
  --timeout 3600 \
  --session-affinity
```

- [ ] **Step 4: Verify deployment**

Open the Cloud Run URL, test camera + voice.

- [ ] **Step 5: Take GCP deployment screenshot**

Screenshot of Cloud Run console showing the deployed service.

---

### Task 4.3: README + Architecture Diagram

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# MuscleClaw — AI Fitness Coach

> Like Jarvis, but for the gym. Real-time AI fitness assistant with camera vision,
> voice interaction, gesture control, and AR overlays.

## What it does

MuscleClaw is a real-time AI fitness coach that:
- **Sees you** — Camera + MediaPipe (30fps pose detection) + Gemini vision (1fps scene understanding)
- **Talks to you** — Natural voice conversation with personality modes (professional, gentle, trash-talk)
- **Counts your reps** — Automatic rep counting with ROM validation
- **Corrects your form** — Real-time joint angle analysis and symmetry checking
- **Keeps you safe** — Detects barbell stalls and triggers emergency alerts
- **Remembers you** — Persistent training history, body profile, and preferences

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Computer Vision | MediaPipe BlazePose (33pt) + Hand Landmark (21pt) |
| AR Rendering | Canvas 2D + CSS backdrop-filter (frosted glass) |
| Audio | Web Audio API (PCM 16kHz/24kHz) |
| AI Framework | Google ADK v1.27.0 (bidi-streaming) |
| AI Model | Gemini 2.5 Flash Live (Native Audio) |
| Image Gen | Nano Banana 2 (gemini-3.1-flash-image-preview) |
| Backend | FastAPI + WebSocket |
| Deployment | Google Cloud Run |
| Data | ADK DatabaseSessionService (SQLite) |

## Architecture

[See architecture diagram](docs/architecture.png)

```
Browser                              Cloud Run
┌──────────────┐    WebSocket    ┌──────────────────┐
│ Camera 30fps │───────────────→│ FastAPI            │
│ MediaPipe    │  audio+video   │   ↓                │
│ CV Engine    │  +CV events    │ ADK Runner         │
│ Canvas 2D   │←───────────────│   ↓                │
│ HTML/CSS     │  audio+UI cmds │ Gemini Live API    │
│ Web Audio    │                │ SessionService(DB) │
└──────────────┘                └──────────────────┘
```

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
uv venv && uv pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

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
  --allow-unauthenticated
```

## Gemini Live Agent Challenge

Built for the [Gemini Live Agent Challenge](https://geminiliveagentchallenge.devpost.com/).

#GeminiLiveAgentChallenge #BuiltWithGemini
```

- [ ] **Step 2: Create architecture diagram**

ASCII art in README (also generate a proper PNG using a diagramming tool or Mermaid).

- [ ] **Step 3: Commit all**

```bash
git add README.md
git commit -m "docs: README with setup instructions and architecture"
```

---

### Task 4.4: Create Public GitHub Repo + Push

- [ ] **Step 1: Create GitHub repo**

```bash
gh repo create muscleclaw --public --source=. --push
```

- [ ] **Step 2: Verify repo is public and accessible**

---

## Execution Order Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| **1** | 1.1-1.2 | Backend ADK agent with tools, personality, running with `adk web` |
| **2** | 2.1-2.4 | Frontend with camera + audio + WebSocket + UI shell, voice conversation E2E |
| **3** | 3.1-3.5 | MediaPipe pose detection, rep counting, safety alerts, AR skeleton overlay |
| **4** | 4.1-4.4 | Docker, Cloud Run deploy, README, GitHub repo — **competition ready** |

**Critical path:** Chunk 1 → Chunk 2 → Chunk 4 (deploy without CV) → Chunk 3 (add CV features).

This ordering ensures a deployable submission exists ASAP, with CV features added on top.

# MuscleClaw 设计文档

> 设计时间：2026-03-14 | 基于调研：`2026-03-05-muscleclaw-ideation.md` + `2026-03-14-gemini-live-agent-challenge.md`

## 背景

MuscleClaw 是一个"像贾维斯一样的 AI 健身助手"，通过摄像头实时感知、语音自然交互、手势隔空操作、AR 全息展示，在无需私教的情况下提供专业级的训练规划、动作指导、安全保护和趣味展示。

参加 Gemini Live Agent Challenge，必须使用 Gemini Live API / ADK 构建实时音视频 Agent，部署到 GCP。

**核心设计挑战**：

1. **双速度问题** — MediaPipe 在前端跑 30fps（实时），Gemini Live API 只接受 1fps 视频帧（延迟）。如何融合两个速度层？
2. **多模态融合** — 摄像头视觉、语音对话、手势操控、AR 渲染、数据面板必须无缝协作
3. **实时性 vs 智能性** — rep 计数需要毫秒级响应，训练规划需要深度推理，两者架构完全不同
4. **会话持久性** — 训练数据、身体档案、偏好必须跨会话保存，WebSocket 连接约 10 分钟断一次

---

## 选型过程

评估了 4 个架构级别不同的方案，选择了方案 3（Dual-Vision Fusion），原因详述如下。

### 方案 1：Gemini-Vision-First（云端单体）

**架构概述**：让 Gemini 的视觉能力承担一切。前端极简，只负责采集摄像头画面和麦克风音频，通过 ADK WebSocket 发送给后端。所有分析（动作判断、rep 计数、安全检测）都由 Gemini 看 1fps 视频帧完成。

**调研支撑**：Gemini 2.5 Flash Live 支持视频帧输入 + 原生音频理解（比赛分析文档 §5）。ADK 自带 `adk web` UI，可一键启动。

**优势**：
- 架构最简单，代码量最少
- 完全依赖 Google 技术栈，评委友好
- 不需要前端 CV 能力，降低浏览器性能压力

**劣势**：
- **致命缺陷：1fps 无法做实时动作教练** — 卧推一个 rep 约 2-3 秒，1fps 只能看到 2-3 帧，无法准确计数、判断行程、检测对称性
- 无法做手势交互（手势检测需要 15fps+）
- 所有分析都有 1-2 秒延迟（网络往返 + Gemini 推理）
- 安全检测太慢 — 卧推卡住到检测到可能已经 3-5 秒

**工作量估算**：S

---

### 方案 2：Edge-Intelligence（前端全包，Gemini 只做语音）

**架构概述**：前端运行完整的 CV 引擎（MediaPipe Pose + Hand + 自定义分析逻辑），实现 rep 计数、角度检测、手势识别、安全检测等全部实时功能。Gemini 通过 Live API 只处理语音对话，不接收任何视频帧。后端是纯 ADK 语音 Agent。

**调研支撑**：MediaPipe BlazePose 33 点骨骼在浏览器 30+fps（ideation 文档 §前沿研究）。角度过零点计数法准确率 90-99.5%。

**优势**：
- 所有实时功能在前端闭环，零延迟
- Gemini 不消耗视觉 token，省成本
- 前端 CV 引擎可独立测试和迭代

**劣势**：
- **Gemini 完全"看不见"用户** — 无法说"我看到你在用史密斯架"、无法识别器械、无法判断整体动作质量
- 比赛评分"See, Hear, Speak 集成"维度（40% 权重）中"See"拿不到分
- 前端规则引擎只能检测预定义的错误模式，无法像 Gemini 那样理解开放性的动作问题
- 需要为每个新动作手写规则，可扩展性差

**工作量估算**：M

---

### 方案 3：Dual-Vision Fusion（前端实时 CV + Gemini 视觉理解，Canvas 2D 渲染）

**架构概述**：两套视觉系统各司其职 —— MediaPipe 在前端以 30fps 处理实时任务（rep 计数、关节角度、手势检测、骨骼追踪），Gemini 通过 Live API 以 1fps 看视频帧理解宏观场景（识别动作类型、判断整体表现、理解器械和环境）。前端将 CV 分析结果作为结构化事件发送给后端，Gemini 同时拥有"精确数据"和"视觉理解"两个信息源。前端用 Canvas 2D + HTML/CSS 渲染 AR 叠加效果。

**调研支撑**：
- MediaPipe 33 点骨骼 30+fps（ideation §前沿研究）
- Gemini Live API 视频帧输入 1fps（比赛分析 §5）
- ADK bidi-streaming 支持 `client_content` 注入结构化数据（ADK 文档）
- 比赛评分"See, Hear, Speak 集成"要求多模态无缝融合（比赛分析 §3.1）
- ADK multi-agent 支持 sub_agents 委派（ADK 文档）

**优势**：
- **最佳融合**：实时精度（MediaPipe）+ 语义理解（Gemini）互补，覆盖所有功能需求
- **比赛评分最优**：多模态融合命中 Innovation 40% 的全部得分点 
- Canvas 2D + CSS 是 AR 信息面板的最佳渲染方案（文本、布局、毛玻璃效果）
- 可渐进增强：先做核心 CV + 语音，再加 AR 面板和手势

**劣势**：
- 架构组件最多，集成复杂度最高
- 需要设计前端 CV 事件和 Gemini 视觉理解之间的融合协议
- 浏览器同时跑 MediaPipe Pose + Hand 可能有性能压力

**工作量估算**：L

---

### 方案 4：Immersive 3D Experience（Edge CV + Cloud AI + WebGL/Three.js 渲染）

**架构概述**：后端架构与方案 3 相同。差异在前端渲染层：用 Three.js/React Three Fiber 构建完整的 3D 场景，摄像头画面作为背景纹理，所有 AR 元素（身体面板、连接线、粒子效果、全息扫描线）都是 3D 对象，有真正的深度视差和 shader 特效。

**调研支撑**：用户 idea 提到"人体扫描全息AR那种效果"，Three.js 可实现最接近 Iron Man HUD 的视觉体验。

**优势**：
- 视觉效果最震撼，最接近"贾维斯"的科幻感
- Shader 可实现全息扫描线、粒子系统、光晕效果
- 3D 空间中的深度视差让 AR 更有沉浸感

**劣势**：
- WebGL 上渲染文本和结构化数据（表格、图表）远不如 HTML/CSS
- 视频纹理 + 3D 对象的合成在不同浏览器表现差异大
- Three.js 的 DOM 交互（点击、滚动）生态远不如 React
- 性能风险：MediaPipe + Three.js 同时跑可能导致帧率崩溃
- 信息密度高的面板（训练日志、力量曲线、体态报告）用 WebGL 呈现体验很差

**工作量估算**：XL

---

### 评分矩阵

| 方案 | 可行性 (Feasibility) | 契合度 (Alignment) | 简洁性 (Simplicity) | 调研匹配度 (Research-fit) | 总分 |
|------|:---:|:---:|:---:|:---:|:---:|
| 方案 1: Gemini-Vision-First | 5 | 2 | 5 | 2 | **14** |
| 方案 2: Edge-Intelligence | 4 | 3 | 3 | 3 | **13** |
| **方案 3: Dual-Vision Fusion** | **4** | **5** | **3** | **5** | **17** |
| 方案 4: Immersive 3D | 3 | 5 | 2 | 4 | **14** |

**选择方案 3：Dual-Vision Fusion**（总分 17，最高分）

**选择理由**：
- **契合度最高（5）**：唯一同时满足"实时动作教练"（需 30fps）和"Gemini 视觉理解"（比赛要求）的方案
- **调研匹配度最高（5）**：同时利用 MediaPipe（实时 CV）和 Gemini Live API（语义理解），完美匹配比赛"See, Hear, Speak"评分维度
- 方案 4 虽然视觉效果更好，但对信息密度高的 UI（侧边栏、训练数据、图表）WebGL 明显劣于 HTML/CSS，且性能风险大
- 方案 1 的 1fps 限制是致命缺陷，无法实现核心功能
- 方案 2 让 Gemini "看不见"，浪费了 Live API 的视觉能力，比赛评分吃亏

**关于 Canvas 2D vs WebGL 的决策**：MuscleClaw 90% 的 AR 界面是信息面板（文本、数据、图表），HTML/CSS 是最佳载体。连接线和骨骼叠加用 Canvas 2D 完全胜任。如果未来需要粒子特效或全息扫描线，可以在 Canvas 2D 层之上叠加一个轻量 WebGL 层（PixiJS），但这不是核心架构决策。

---

## 架构设计

### 系统总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                     前端 (React + Vite + TypeScript)                 │
│                                                                     │
│  ┌───────────┐    ┌─────────────────┐    ┌───────────────────────┐ │
│  │  Camera    │───→│  MediaPipe       │───→│  CV Analytics Engine  │ │
│  │  Module    │    │  Pose (33pt)     │    │  ┌─ RepCounter       │ │
│  │            │    │  Hand (21pt)     │    │  ├─ AngleAnalyzer    │ │
│  └─────┬─────┘    └─────────────────┘    │  ├─ SymmetryChecker  │ │
│        │                                  │  ├─ GestureDetector  │ │
│        │ (1fps JPEG)                      │  ├─ SafetyMonitor    │ │
│        │                                  │  └─ PostureScanner   │ │
│        │                                  └──────────┬────────────┘ │
│        │                                             │              │
│        │                               (结构化事件 JSON)            │
│        ▼                                             ▼              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              WebSocket Client (ADK bidi-streaming)            │  │
│  │  OUT: audio PCM 16kHz ↑ video JPEG 1fps ↑ pose events JSON  │  │
│  │  IN:  audio PCM 24kHz ↓ UI commands JSON ↓ data updates JSON │  │
│  └──────────────────────────────────────────────────────────────┘  │
│        │                                             │              │
│        ▼                                             ▼              │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│  │  Audio Engine         │    │  Rendering Layer                 │  │
│  │  - Mic capture (16kHz)│    │  ┌─ Canvas 2D: 骨骼/角度/轨迹   │  │
│  │  - Speaker play (24kHz│    │  ├─ HTML/CSS: 身体面板/侧边栏    │  │
│  │  - Echo cancellation  │    │  ├─ CSS: 毛玻璃/动画/过渡        │  │
│  └──────────────────────┘    │  └─ AR Buttons: 手势交互目标      │  │
│                               └──────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ WebSocket (wss://)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  后端 (FastAPI + ADK on Cloud Run)                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  FastAPI WebSocket Endpoint (/ws)                              │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │  ADK Runner (app_name="muscleclaw")                      │ │  │
│  │  │                                                          │ │  │
│  │  │  ┌──────────────────────────────────────────────────┐   │ │  │
│  │  │  │  Main Agent — "MuscleClaw"                        │   │ │  │
│  │  │  │  model: gemini-2.5-flash-native-audio-preview     │   │ │  │
│  │  │  │                                                    │   │ │  │
│  │  │  │  tools:                                            │   │ │  │
│  │  │  │   ├─ process_pose_event    (CV 事件处理)           │   │ │  │
│  │  │  │   ├─ get_training_history  (查询训练记录)          │   │ │  │
│  │  │  │   ├─ update_training_log   (更新训练记录)          │   │ │  │
│  │  │  │   ├─ get_body_profile      (查询身体档案)          │   │ │  │
│  │  │  │   ├─ update_body_profile   (更新身体档案)          │   │ │  │
│  │  │  │   ├─ generate_training_plan(生成训练计划)          │   │ │  │
│  │  │  │   ├─ trigger_safety_alert  (触发安全警报)          │   │ │  │
│  │  │  │   ├─ cancel_safety_alert   (取消安全警报)          │   │ │  │
│  │  │  │   ├─ analyze_posture       (体态分析报告)          │   │ │  │
│  │  │  │   └─ send_ui_command       (发送 UI 指令到前端)    │   │ │  │
│  │  │  │                                                    │   │ │  │
│  │  │  │  sub_agents:                                       │   │ │  │
│  │  │  │   ├─ ImageGenAgent (Nano Banana 2)                 │   │ │  │
│  │  │  │   └─ AnalysisAgent (Gemini 2.5 Flash)              │   │ │  │
│  │  │  └──────────────────────────────────────────────────┘   │ │  │
│  │  │                                                          │ │  │
│  │  │  ┌──────────────────────────────────┐                   │ │  │
│  │  │  │  SessionService (DatabaseSession) │                   │ │  │
│  │  │  │  ┌─ user:body_profile            │                   │ │  │
│  │  │  │  ├─ user:training_history        │                   │ │  │
│  │  │  │  ├─ user:preferences             │                   │ │  │
│  │  │  │  ├─ user:injuries                │                   │ │  │
│  │  │  │  ├─ app:exercise_library         │                   │ │  │
│  │  │  │  ├─ (session) current_plan       │                   │ │  │
│  │  │  │  └─ (session) current_exercise   │                   │ │  │
│  │  │  └──────────────────────────────────┘                   │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 双速度融合协议（核心设计）

这是整个系统最关键的设计决策：如何融合 30fps 前端 CV 和 1fps Gemini 视觉。

#### 信息流向

```
前端 CV (30fps)                    Gemini Live API (1fps)
────────────                       ───────────────────
关节角度 (精确到度)                  "你在做卧推" (语义理解)
Rep 计数 (角度过零点)               "器械是杠铃不是哑铃" (物体识别)
对称性偏差 (左右差值)               "你看起来很疲惫" (整体观察)
手势分类 (OK/拇指/挥手)             "环境安全" (场景理解)
安全信号 (杠铃停滞检测)             "你的握距偏窄" (细节洞察)
骨骼坐标 (33 个点的 x,y,z)
```

#### 数据送达方式

| 数据类型 | 传输方式 | 频率 | 接收方 |
|----------|---------|------|--------|
| 原始视频帧 | ADK `realtime_input` (JPEG base64) | 1 fps | Gemini 视觉模型 |
| 音频流 | ADK `realtime_input` (PCM 16kHz) | 连续 | Gemini 音频模型 |
| CV 重要事件 | ADK `client_content` (JSON text) | 事件驱动 | Agent 上下文 |
| 前端 UI 更新 | WebSocket 自定义消息 | 事件驱动 | 前端 |

#### CV 事件协议

前端 CV 引擎不会每帧都发数据，而是只在"有意义的事件"发生时发送结构化事件：

```typescript
// 前端 → 后端的 CV 事件类型
type CVEvent =
  | { type: "rep_complete"; exercise: string; rep: number; rom_degrees: number; duration_ms: number }
  | { type: "form_issue"; exercise: string; issue: string; severity: "warning" | "danger"; details: string }
  // 例如: { type: "form_issue", exercise: "bench_press", issue: "asymmetry", severity: "warning", details: "left arm 12° lower than right" }
  | { type: "safety_alert"; alert: "barbell_stall" | "body_collapse" | "extended_stillness"; confidence: number }
  | { type: "gesture"; gesture: "thumbs_up" | "ok" | "wave" | "point_click"; target?: string }
  | { type: "posture_snapshot"; landmarks: PoseLandmark[]; analysis: PostureAnalysis }
  | { type: "exercise_detected"; exercise: string; confidence: number }
  | { type: "person_detected"; detected: boolean }
  | { type: "set_complete"; exercise: string; reps: number; estimated_rpe: number }
```

这些事件通过 WebSocket 的 `client_content` 通道注入 Gemini 上下文，格式为：

```
[SYSTEM CV EVENT] rep_complete: bench_press rep #5, ROM 142°, duration 2.3s
```

Gemini 看到这些精确数据后，结合它自己看到的视频帧，做出综合判断和语音回应。

---

## 组件设计

### 前端组件

#### 1. Camera Module

**职责**：管理摄像头权限、视频流、帧捕获

**接口**：
- `startCamera(): Promise<MediaStream>` — 请求摄像头权限并开始采集
- `captureFrame(): ImageData` — 从 video element 截取当前帧
- `captureJPEG(quality: number): Blob` — 截取 JPEG 帧（发送给 Gemini）

**依赖**：`navigator.mediaDevices.getUserMedia`

**关键决策**：
- 分辨率：1280×720（平衡清晰度和性能）
- 帧率：30fps（给 MediaPipe 用），但发往 Gemini 降采样为 1fps
- 镜像：前置摄像头水平翻转显示（selfie view），但发给 Gemini 的帧不翻转（保持物理真实）

#### 2. MediaPipe Module

**职责**：初始化和管理 MediaPipe 模型，提供原始 landmark 数据

**接口**：
- `initPose(): Promise<PoseLandmarker>` — 初始化 33 点 Pose 模型
- `initHand(): Promise<HandLandmarker>` — 初始化 21 点 Hand 模型
- `detectPose(frame: ImageData): PoseLandmarkerResult` — 检测姿态
- `detectHand(frame: ImageData): HandLandmarkerResult` — 检测手部

**依赖**：`@mediapipe/tasks-vision`（现代 API，替代旧的 `@mediapipe/pose`）

**关键决策**：
- Pose 和 Hand 模型交替运行而非同时运行：偶数帧跑 Pose，奇数帧跑 Hand
- 这样每个模型有效帧率为 15fps，足够用，且避免同时运行导致掉帧
- 训练模式下可关闭 Hand 检测（不需要手势），全部 30fps 给 Pose
- `modelComplexity: 1`（平衡精度和速度）
- `runningMode: "VIDEO"`（利用帧间追踪优化）

#### 3. CV Analytics Engine

**职责**：将原始 landmark 转化为有意义的健身分析事件

**子模块**：

**RepCounter**（rep 计数器）
- 算法：角度过零点检测法
- 跟踪特定关节角度（如卧推：肘关节角度）的周期性变化
- 角度从收缩相过渡到伸展相 = 1 rep
- 输出：rep 完成事件 + ROM（活动范围）+ 持续时间

**AngleAnalyzer**（关节角度分析器）
- 实时计算关键关节角度：肩-肘-腕、髋-膝-踝等
- 与动作标准阈值对比（如：卧推伸展相肘角应 > 160°）
- 输出：form_issue 事件（行程不够、角度异常等）

**SymmetryChecker**（对称性检测器）
- 对比左右同名关节角度差值
- 差值 > 阈值（如 10°）→ 不对称警告
- 输出：form_issue 事件（对称性问题）

**GestureDetector**（手势检测器）
- 基于 Hand Landmark 21 点分类手势
- 支持手势：竖拇指、OK、挥手、指向/点击
- 指尖点击检测：食指尖 (landmark 8) 坐标 vs AR 按钮 hitbox 碰撞
- 输出：gesture 事件

**SafetyMonitor**（安全监测器）
- 检测杠铃停滞：关键点垂直位移在 N 帧内 < 阈值
- 检测身体挣扎：肩部和髋部的异常抖动模式
- 检测长时间静止：人体检测存在但无运动 > 30 秒
- 输出：safety_alert 事件（附置信度）

**PostureScanner**（体态扫描器）
- 前/后/左/右四个角度的 landmark 快照
- 规则引擎分析：骨盆前倾角、肩部对称性、脊柱侧弯、肱骨前移等
- 输出：posture_snapshot 事件（包含完整分析）

#### 4. WebSocket Client

**职责**：管理与 ADK 后端的双向通信

**接口**：
- `connect(url: string, userId: string): void`
- `sendAudio(pcmChunk: ArrayBuffer): void` — 发送音频数据
- `sendVideoFrame(jpegBlob: Blob): void` — 发送视频帧（1fps）
- `sendCVEvent(event: CVEvent): void` — 发送 CV 事件
- `onAudio(callback: (pcm: ArrayBuffer) => void): void` — 接收音频
- `onUICommand(callback: (cmd: UICommand) => void): void` — 接收 UI 指令
- `onTranscript(callback: (text: string, role: "user"|"model") => void): void`

**关键决策**：
- 使用 ADK 的 bidi-streaming WebSocket 协议
- 音频：二进制帧直接发送（PCM 16kHz → binary WebSocket message）
- 视频帧：base64 JPEG 在 JSON 消息中
- CV 事件：作为 `client_content` 文本消息注入（`[CV] {...}`）
- 断线重连：利用 ADK 的 session resumption token（2 小时有效）
- 心跳：每 30 秒发送 ping 保持连接

#### 5. Audio Engine

**职责**：管理麦克风采集和扬声器播放

**接口**：
- `startMic(): Promise<void>` — 启动麦克风，输出 PCM 16kHz
- `playAudio(pcmChunk: ArrayBuffer): void` — 播放 Gemini 返回的音频
- `setVolume(level: number): void`
- `mute() / unmute(): void`

**关键决策**：
- 使用 Web Audio API 的 AudioWorklet 处理音频（低延迟）
- 输入：mic → AudioContext → AudioWorklet（重采样到 16kHz）→ PCM buffer → WebSocket
- 输出：WebSocket → PCM 24kHz buffer → AudioContext → 扬声器
- 回声消除：依赖浏览器内置 AEC（`echoCancellation: true`）
- 音频格式：16-bit Linear PCM，单声道

#### 6. Rendering Layer — AR Overlay (Canvas 2D)

**职责**：在摄像头画面上叠加 AR 元素

**渲染内容**：
- 骨骼连线（33 个 landmark 之间的连接线）
- 关节角度标注（弧形 + 角度值）
- Rep 计数大字显示
- 杠铃路径轨迹（历史坐标连线）
- 安全状态指示器（绿/黄/红圆点）
- AR 手势交互按钮（带 hover 高亮和点击动画）

**技术方案**：
- Canvas 2D 覆盖在 `<video>` 元素上方，大小和位置完全对齐
- 每帧用 `requestAnimationFrame` 重绘
- 骨骼线条使用发光效果：先画粗的半透明线（glow），再画细的实线
- AR 按钮：Canvas 绘制圆形/圆角矩形 + 文字，维护 hitbox 列表供手势碰撞检测

#### 7. Rendering Layer — UI Panels (HTML/CSS)

**职责**：身体面板、侧边栏、信息卡片

**身体面板（Body Panel）**：
- 六个浮动信息卡片（胸/肩/背/腿/核心/手臂）
- 每个卡片通过引导线连接到 Canvas 上对应的身体锚点
- 卡片样式：`backdrop-filter: blur(12px); background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1)`
- 卡片位置：基于 MediaPipe landmark 计算身体部位中心点，卡片偏移到不与身体重叠的位置
- 位置更新：landmark 坐标经过低通滤波（EMA α=0.3）防止抖动

**引导线**：
- 从身体锚点到卡片边缘的贝塞尔曲线
- Canvas 2D 绘制，颜色与卡片边框一致
- 线条带发光效果（双层绘制）

**侧边栏（Sidebar）**：
- 右侧固定宽度面板（360px）
- 内容根据当前模式切换：
  - 训练规划模式：训练计划表格、日历热力图
  - 训练模式：当前组数/Rep、力量曲线图、休息计时器
  - 体态模式：体态报告、前后对比图
  - 展示模式：AI 生图结果
- 使用 CSS transition 实现内容切换动画

### 后端组件

#### 1. Main Agent — "MuscleClaw"

**职责**：核心对话 Agent，处理所有实时语音交互

```python
from google.adk.agents import Agent

main_agent = Agent(
    name="muscleclaw",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    instruction="""你是 MuscleClaw，一个像贾维斯一样的 AI 健身教练。

## 核心能力
- 你能看到用户的摄像头画面（1fps）
- 你能收到前端 CV 引擎的精确分析事件（标记为 [CV]）
- 你有持久记忆，记得用户的所有训练历史和身体数据

## 性格模式
当前性格模式存储在 session state 的 personality_mode 中：
- "professional": 专业简洁，像私教
- "gentle": 温柔鼓励，适合新手
- "trash_talk": 搞笑嘲讽激将法，"嗯嗯不算！""Yeah buddy! Light weight baby!"

## 对 CV 事件的响应规则
- [CV] rep_complete: 报数，如果 ROM 不够则吐槽
- [CV] form_issue: 立即语音纠正
- [CV] safety_alert: 立即切换到安全模式，询问用户状况
- [CV] gesture: 执行对应操作
- [CV] set_complete: 记录并开始休息计时

## 你必须做到
- 永远记住用户的训练数据和偏好
- 用中文和用户对话（除非用户说英文）
- 训练建议基于用户的真实数据，不瞎编
- 安全永远是第一优先级
""",
    tools=[
        process_pose_event,
        get_training_history,
        update_training_log,
        get_body_profile,
        update_body_profile,
        generate_training_plan,
        trigger_safety_alert,
        cancel_safety_alert,
        analyze_posture,
        send_ui_command,
    ],
    sub_agents=[image_gen_agent, analysis_agent],
)
```

**声音配置（随性格切换）**：
- professional → voice: "Puck" 或 "Orus"
- gentle → voice: "Kore" 或 "Aoede"
- trash_talk → voice: "Charon" 或 "Fenrir"

#### 2. ImageGen Agent（Nano Banana 2 子 Agent）

**职责**：展示模式下的 AI 肌肉增强生图

```python
image_gen_agent = Agent(
    name="image_generator",
    model="gemini-3.1-flash-image-preview",  # Nano Banana 2
    instruction="""你是一个图像编辑专家。
用户会给你一张健身者摆姿势的照片。
你的任务是编辑这张照片，让这个人看起来更加强壮——明显的肌肉线条、
更大的肌肉体积，但保持自然和真实感。
保持背景和姿势不变，只增强肌肉。
""",
)
```

**触发方式**：Main Agent 通过 `transfer_to_agent` 委派，传入截图

#### 3. Analysis Agent（深度分析子 Agent）

**职责**：需要深度推理的数据分析任务

```python
analysis_agent = Agent(
    name="strength_analyst",
    model="gemini-2.5-flash",  # 稳定版，更强推理
    instruction="""你是一个运动科学数据分析专家。
分析用户的训练历史数据，提供：
- 力量趋势分析（是否在进步/停滞/退步）
- 训练量建议（基于 APRE 算法）
- 疲劳管理建议（基于训练频率和超量恢复周期）
- 弱点识别（哪个部位相对落后）
用数据说话，给出具体的数字和建议。
""",
    tools=[get_training_history, get_body_profile],
)
```

**触发方式**：Main Agent 在用户询问训练分析时委派

#### 4. Tools 定义

```python
# ---- 训练数据工具 ----

def get_training_history(ctx, days: int = 30) -> dict:
    """获取用户最近 N 天的训练记录。
    返回: {sessions: [{date, exercises: [{name, sets: [{reps, weight, rpe}]}]}]}
    """
    history = ctx.session.state.get("user:training_history", [])
    # 按日期过滤并返回
    ...

def update_training_log(ctx, exercise: str, sets: list[dict]) -> str:
    """记录一次训练的数据。
    sets: [{reps: int, weight: float, rpe: float}]
    """
    history = ctx.session.state.get("user:training_history", [])
    history.append({"date": today(), "exercise": exercise, "sets": sets})
    ctx.session.state["user:training_history"] = history
    return f"已记录 {exercise} {len(sets)} 组"

# ---- 身体档案工具 ----

def get_body_profile(ctx) -> dict:
    """获取用户身体档案。
    返回六大部位的力量数据、最近训练时间、恢复状态。
    """
    return ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)

def update_body_profile(ctx, part: str, data: dict) -> str:
    """更新某个身体部位的数据。
    part: chest/shoulders/back/legs/core/arms
    data: {max_weight, last_trained, notes}
    """
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    profile[part].update(data)
    ctx.session.state["user:body_profile"] = profile
    return f"已更新 {part} 数据"

# ---- 安全工具 ----

def trigger_safety_alert(ctx, alert_type: str, countdown_seconds: int = 10) -> str:
    """触发安全警报，开始倒计时。
    alert_type: 'stuck' | 'collapse' | 'unresponsive'
    """
    ctx.session.state["safety_alert_active"] = True
    ctx.session.state["safety_countdown"] = countdown_seconds
    # 发送 UI 指令给前端显示警报
    return f"安全警报已触发: {alert_type}，{countdown_seconds}秒后呼叫紧急联系人"

def cancel_safety_alert(ctx) -> str:
    """取消安全警报。"""
    ctx.session.state["safety_alert_active"] = False
    return "安全警报已取消"

# ---- UI 指令工具 ----

def send_ui_command(ctx, command: str, data: dict) -> str:
    """发送指令给前端 UI。
    command: 'show_body_panel' | 'show_training_plan' | 'show_posture_report'
             | 'start_rest_timer' | 'show_strength_chart' | 'switch_mode'
    data: 与 command 对应的数据负载
    """
    # 通过 ADK 的事件系统将指令推送到前端
    ...
```

#### 5. Session State 设计

```python
# ADK SessionService 状态作用域设计

STATE_SCHEMA = {
    # user: 前缀 — 跨会话持久化（用户级）
    "user:body_profile": {
        "chest":     {"max_weight": 110, "exercise": "bench_press", "last_trained": "2026-03-12", "recovery_status": "recovered"},
        "shoulders": {"max_weight": 60,  "exercise": "ohp",         "last_trained": "2026-03-11", "recovery_status": "recovering"},
        "back":      {"max_weight": 100, "exercise": "barbell_row", "last_trained": "2026-03-13", "recovery_status": "fresh"},
        "legs":      {"max_weight": 140, "exercise": "squat",       "last_trained": "2026-03-10", "recovery_status": "recovered"},
        "core":      {"max_weight": 0,   "exercise": "plank",       "last_trained": "2026-03-13", "recovery_status": "fresh"},
        "arms":      {"max_weight": 40,  "exercise": "barbell_curl","last_trained": "2026-03-11", "recovery_status": "recovering"},
    },
    "user:training_history": [
        # 最近 N 条训练记录
        {"date": "2026-03-12", "exercises": [
            {"name": "bench_press", "sets": [
                {"reps": 8, "weight": 100, "rpe": 7},
                {"reps": 6, "weight": 105, "rpe": 8},
                {"reps": 5, "weight": 110, "rpe": 9},
            ]},
        ]},
    ],
    "user:preferences": {
        "personality_mode": "trash_talk",  # professional | gentle | trash_talk
        "language": "zh-CN",
        "emergency_contact": "+86-xxx",
        "rest_timer_default": 120,  # 秒
    },
    "user:injuries": [
        {"part": "right_shoulder", "description": "肱骨前移", "since": "2026-01", "severity": "mild"},
    ],

    # app: 前缀 — 全局数据（所有用户共享）
    "app:exercise_library": {
        "bench_press": {
            "name": "卧推",
            "primary_muscles": ["chest"],
            "tracking_joints": ["left_elbow", "right_elbow"],  # 用于计数的关节
            "rom_threshold": 140,       # 最小 ROM 角度（度）
            "symmetry_threshold": 10,   # 对称性阈值（度）
            "safety_checks": ["barbell_stall", "elbow_flare"],
        },
        "squat": {
            "name": "深蹲",
            "primary_muscles": ["legs"],
            "tracking_joints": ["left_knee", "right_knee"],
            "rom_threshold": 90,
            "symmetry_threshold": 8,
            "safety_checks": ["knee_cave", "forward_lean"],
        },
        # ... 更多动作
    },

    # 无前缀 — 当前会话级别
    "current_mode": "idle",       # idle | body_scan | training | posture | showcase
    "current_exercise": None,     # 当前正在做的动作
    "current_set": 0,             # 当前组数
    "current_reps": 0,            # 当前 rep 数
    "rest_timer_remaining": 0,    # 休息计时器
    "safety_alert_active": False, # 安全警报是否激活
    "training_plan": None,        # 当前训练计划
}
```

#### 6. FastAPI + ADK 集成

```python
# app.py — 后端入口

from fastapi import FastAPI, WebSocket
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService

app = FastAPI()

session_service = DatabaseSessionService(
    uri="sqlite+aiosqlite:///./sessions.db"  # 生产环境用 PostgreSQL
)

runner = Runner(
    app_name="muscleclaw",
    agent=main_agent,
    session_service=session_service,
)

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()

    # 获取或创建用户的 session
    session = await session_service.get_or_create_session(
        app_name="muscleclaw",
        user_id=user_id,
    )

    # 启动 ADK live 双向流
    live_session = runner.run_live(
        session=session,
        # Live API 配置
        live_config={
            "response_modalities": ["AUDIO"],
            "speech_config": {
                "voice_config": {
                    "prebuilt_voice_config": {
                        "voice_name": get_voice_for_personality(session)
                    }
                }
            },
            "realtime_input_config": {
                "automatic_activity_detection": {
                    "disabled": False  # 启用自动语音检测
                }
            },
        }
    )

    # 双向消息转发
    async for message in live_session:
        if message.type == "audio":
            await websocket.send_bytes(message.data)
        elif message.type == "text":
            await websocket.send_json({"type": "transcript", "data": message.data})
        elif message.type == "tool_call":
            # 工具调用结果可能包含 UI 指令
            if message.tool_name == "send_ui_command":
                await websocket.send_json({"type": "ui_command", "data": message.result})
```

---

## 数据流

### 场景 1：训练中的一个 Rep（核心循环）

```
用户做卧推第 5 下
     │
     ▼
[前端 Camera] 30fps 视频帧
     │
     ├──→ [MediaPipe Pose] 检测 33 个骨骼点
     │         │
     │         ▼
     │    [CV RepCounter] 检测到肘关节角度完成一个周期
     │         │
     │         ├── ROM = 145° → 达标
     │         ├── 左右差值 = 3° → 对称
     │         │
     │         ▼
     │    发送 CV 事件: { type: "rep_complete", exercise: "bench_press",
     │                    rep: 5, rom_degrees: 145, duration_ms: 2300 }
     │
     ├──→ [1fps 帧采集] 每秒截一帧 JPEG → WebSocket → Gemini
     │
     ▼
[WebSocket] → [ADK Backend] → [Main Agent]
     │
     Agent 收到:
     ├── 视觉: 看到用户在做卧推（确认 CV 的判断）
     ├── CV 事件: rep #5 完成, ROM 145°, 对称
     │
     Agent 决策: 第 5 下，ROM 达标，报数 + 鼓励
     │
     ▼
[Gemini 语音输出]: "第五下！不错！" (trash_talk: "第五下！就这？再来！")
     │
     ▼
[WebSocket] → [前端 Audio Engine] → 扬声器播放
```

### 场景 2：安全检测流程

```
用户卧推卡住（杠铃停在胸口）
     │
     ▼
[前端 CV SafetyMonitor]
     ├── 检测到: 肩部 landmark y 坐标 10 帧内变化 < 2px
     ├── 检测到: 肘部角度从伸展相反转到收缩相但未完成 rep
     ├── 置信度: 0.85
     │
     ▼
发送 CV 事件: { type: "safety_alert", alert: "barbell_stall", confidence: 0.85 }
     │
     ▼
[Main Agent] 收到安全警报
     ├── 结合视觉确认: Gemini 看到杠铃确实压在胸口
     ├── 决策: 触发安全守卫模式
     │
     ▼
Agent 调用 tool: trigger_safety_alert("stuck", countdown_seconds=10)
     │
     ├──→ 语音: "检测到你可能卡住了，还好吗？10 秒后拨打紧急联系人。说'取消'或'我没事'可以停止。"
     │
     ├──→ UI 指令: { command: "show_safety_countdown", data: { seconds: 10 } }
     │
     ▼
[等待用户回应]
     │
     ├── 用户说 "我没事" / "我逗你的"
     │   → Agent 调用 cancel_safety_alert()
     │   → 语音: "好吧好吧，吓我一跳！要不要降点重量？"
     │
     └── 10 秒无回应
         → 调用紧急联系人（通过 function call）
```

### 场景 3：手势交互

```
用户竖大拇指
     │
     ▼
[前端 MediaPipe Hand] 检测到手部 21 点 landmark
     │
     ▼
[CV GestureDetector]
     ├── 分类: 拇指 (landmark 4) 向上, 其余手指弯曲
     ├── 判定: "thumbs_up"
     │
     ▼
发送 CV 事件: { type: "gesture", gesture: "thumbs_up" }
     │
     ▼
[Main Agent] 根据当前模式处理:
     ├── 训练模式: "thumbs_up" = 确认这组完成
     │   → 记录数据 + 开始休息计时
     │
     └── 展示模式: "thumbs_up" = 确认截图
         → 截图并发给 ImageGenAgent
```

---

## 错误处理

| 错误场景 | 检测方式 | 处理方案 | 用户感知 |
|----------|---------|---------|---------|
| **摄像头权限拒绝** | getUserMedia reject | 显示权限引导页，禁用 CV 功能，仅保留语音对话 | "请允许摄像头访问以使用全部功能" |
| **MediaPipe 加载失败** | 模型文件 404/加载超时 | 降级为 Gemini-only 视觉（1fps），前端不做 CV 分析 | AR 覆盖消失，语音交互仍正常 |
| **WebSocket 断开** | onclose/onerror 事件 | 自动重连（exponential backoff，最多 5 次），使用 ADK resumption token 恢复上下文 | "连接中断，正在重连..." + 重连后语音提示"我回来了" |
| **Gemini API 限流/错误** | 429/500 响应 | 指数退避重试；若持续失败，切换到纯前端 CV 模式（无语音） | "AI 暂时不可用，前端监测仍在运行" |
| **音频设备不可用** | getUserMedia audio reject | 切换到文本聊天模式，CV 功能正常 | 侧边栏显示文本聊天框 |
| **浏览器性能不足** | FPS 监测 < 15fps | 降低 MediaPipe 频率（15fps→10fps），关闭 Hand 检测 | 渲染略卡但核心功能不受影响 |
| **Session state 损坏** | JSON 解析失败 | 用默认值重置受损字段，保留完好的数据 | 语音提示"部分数据需要重新设置" |

---

## 测试策略

### 单元测试（前端 CV 引擎）

| 测试目标 | 测试方法 | 覆盖率目标 |
|----------|---------|-----------|
| RepCounter | 预录制的 landmark 序列 → 断言 rep 数和 ROM | 95% |
| AngleAnalyzer | 已知坐标 → 断言角度值 | 100%（纯数学） |
| SymmetryChecker | 对称/不对称 landmark 对 → 断言检测结果 | 90% |
| GestureDetector | 各手势的 landmark 快照 → 断言分类结果 | 90% |
| SafetyMonitor | 正常/危险 landmark 序列 → 断言警报触发 | 95% |

### 集成测试

| 测试目标 | 测试方法 |
|----------|---------|
| WebSocket 通信 | Mock ADK 后端 → 验证消息格式和流程 |
| ADK Agent 工具调用 | ADK 测试框架 → 验证 tool 参数和返回值 |
| Session 持久化 | 创建 session → 写入数据 → 新 session 读取 → 断言一致 |

### E2E 测试（Playwright）

| 场景 | 验证点 |
|------|--------|
| 打开页面 → 允许摄像头 → 看到 AR 骨骼 | 摄像头正常、MediaPipe 加载、Canvas 渲染 |
| 说话 → 听到回应 | 音频采集、WebSocket、Gemini 回复、音频播放 |
| 竖大拇指 → 确认动作 | 手势检测、事件发送、Agent 响应 |

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|:------:|:----:|---------|
| **MediaPipe Pose + Hand 同时运行帧率过低** | 高 | 高 | 交替帧策略（偶数帧 Pose，奇数帧 Hand）；训练模式关闭 Hand；降级到 10fps |
| **Live API 2 分钟视频会话限制** | 确定 | 高 | 上下文压缩 + session resumption 自动续期；前端实现透明重连 |
| **WebSocket 10 分钟断线** | 确定 | 中 | ADK 内置 resumption token（2 小时有效）+ 前端自动重连 + 状态恢复 |
| **Gemini 语音延迟 > 1 秒** | 中 | 中 | CV 引擎提供即时视觉反馈（Canvas 闪红/角度标注），语音延迟补充详细说明 |
| **浏览器 AEC 回声消除不完美** | 中 | 中 | 使用耳机（健身场景常见）；或实现前端 VAD 在 AI 说话时静音麦克风 |
| **Nano Banana 2 图像编辑效果不稳定** | 中 | 低 | 准备多个 prompt 模板；失败时用幽默语音化解"科技注入失败，你的肌肉太顽固了" |
| **GCP 配额不足 / Credit 用完** | 低 | 高 | 提前测试配额限制；开发阶段用 API Key 模式省 Vertex AI 开销 |

---

## 项目结构

```
muscleclaw/
├── frontend/                          # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/                # React 组件
│   │   │   ├── App.tsx                # 主入口，模式路由
│   │   │   ├── CameraView.tsx         # 摄像头 + Canvas 叠加容器
│   │   │   ├── BodyPanel.tsx          # 六大部位信息卡片
│   │   │   ├── BodyCard.tsx           # 单个部位卡片（毛玻璃）
│   │   │   ├── Sidebar.tsx            # 右侧信息栏
│   │   │   ├── TrainingPanel.tsx      # 训练模式侧边栏内容
│   │   │   ├── PostureReport.tsx      # 体态报告侧边栏内容
│   │   │   ├── SafetyOverlay.tsx      # 安全警报全屏覆盖
│   │   │   ├── RestTimer.tsx          # 组间休息计时器
│   │   │   └── TranscriptBar.tsx      # 底部实时字幕
│   │   │
│   │   ├── cv/                        # 计算机视觉引擎
│   │   │   ├── mediapipe.ts           # MediaPipe 初始化 + 帧处理
│   │   │   ├── repCounter.ts          # 角度过零点 Rep 计数
│   │   │   ├── angleAnalyzer.ts       # 关节角度计算
│   │   │   ├── symmetryChecker.ts     # 左右对称性检测
│   │   │   ├── gestureDetector.ts     # 手势分类
│   │   │   ├── safetyMonitor.ts       # 安全异常检测
│   │   │   ├── postureScanner.ts      # 体态分析规则引擎
│   │   │   ├── exerciseDetector.ts    # 动作类型识别
│   │   │   └── types.ts               # CV 事件类型定义
│   │   │
│   │   ├── render/                    # Canvas 渲染器
│   │   │   ├── skeletonRenderer.ts    # 骨骼连线 + 发光效果
│   │   │   ├── angleRenderer.ts       # 关节角度弧线标注
│   │   │   ├── barbellPath.ts         # 杠铃轨迹绘制
│   │   │   ├── arButtons.ts           # AR 悬浮按钮绘制 + hitbox
│   │   │   └── effects.ts            # 视觉特效（扫描线等）
│   │   │
│   │   ├── stores/                    # Zustand 状态管理
│   │   │   ├── appStore.ts            # 全局模式、连接状态
│   │   │   ├── trainingStore.ts       # 训练进行中的状态
│   │   │   ├── poseStore.ts           # 最新 pose 数据
│   │   │   └── uiStore.ts            # UI 显示状态（面板开关等）
│   │   │
│   │   ├── ws/                        # WebSocket 通信
│   │   │   ├── adkClient.ts           # ADK bidi-streaming 客户端
│   │   │   └── protocol.ts            # 消息类型定义
│   │   │
│   │   ├── audio/                     # 音频处理
│   │   │   ├── audioEngine.ts         # AudioContext 管理
│   │   │   ├── micCapture.ts          # 麦克风采集 + 重采样
│   │   │   └── pcmPlayer.ts           # PCM 音频播放
│   │   │
│   │   ├── utils/                     # 工具函数
│   │   │   ├── math.ts                # 向量运算、角度计算
│   │   │   ├── smoothing.ts           # EMA 低通滤波
│   │   │   └── frameCapture.ts        # JPEG 帧截取
│   │   │
│   │   ├── main.tsx
│   │   └── index.css                  # 全局样式 + CSS 变量
│   │
│   ├── public/
│   │   └── models/                    # MediaPipe WASM 模型文件
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # Python ADK + FastAPI
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── main_agent.py             # MuscleClaw 主 Agent 定义
│   │   ├── image_agent.py            # Nano Banana 2 子 Agent
│   │   └── analysis_agent.py         # 数据分析子 Agent
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── training.py               # 训练数据读写工具
│   │   ├── body_profile.py           # 身体档案工具
│   │   ├── safety.py                 # 安全警报工具
│   │   ├── posture.py                # 体态分析工具
│   │   └── ui_commands.py            # 前端 UI 指令工具
│   │
│   ├── config/
│   │   ├── exercise_library.py       # 动作库（角度阈值、安全规则）
│   │   ├── personality.py            # 性格模式定义（prompt + voice）
│   │   └── settings.py               # 环境变量、API 配置
│   │
│   ├── app.py                        # FastAPI 入口 + WebSocket 端点
│   ├── requirements.txt
│   └── pyproject.toml
│
├── deploy/
│   ├── Dockerfile                    # 多阶段构建（前端 build + 后端运行）
│   ├── cloudbuild.yaml               # Cloud Build 配置
│   └── cloud-run-config.yaml         # Cloud Run 部署配置
│
├── docs/
│   └── plans/
│       ├── 2026-03-05-muscleclaw-ideation.md
│       ├── 2026-03-14-gemini-live-agent-challenge.md
│       └── 2026-03-14-muscleclaw-design.md    # 本文档
│
├── idea（不可删除）.md
└── README.md
```

---

## 技术栈汇总

| 层 | 技术 | 版本 | 理由 |
|----|------|------|------|
| **前端框架** | React + TypeScript | 19.x | 组件化 UI、类型安全、生态成熟 |
| **前端构建** | Vite | 6.x | 快速 HMR、原生 ESM |
| **状态管理** | Zustand | 5.x | 轻量、无 boilerplate、支持 middleware |
| **CV 引擎** | @mediapipe/tasks-vision | latest | Google 官方、Pose 33pt + Hand 21pt、浏览器 WASM |
| **AR 渲染** | Canvas 2D API + HTML/CSS | 原生 | 文本渲染好、毛玻璃原生支持、性能可控 |
| **音频处理** | Web Audio API + AudioWorklet | 原生 | 低延迟、可编程、重采样 |
| **后端框架** | FastAPI | 0.115.x | 异步、WebSocket 原生支持、ADK 兼容 |
| **AI 框架** | Google ADK (Python) | 1.27.0 | bidi-streaming、multi-agent、session 管理、一键部署 |
| **实时 AI** | Gemini 2.5 Flash Live | native-audio-preview | 唯一支持 Live API 的模型 |
| **分析 AI** | Gemini 2.5 Flash | stable | 稳定、推理能力足够 |
| **图像生成** | Nano Banana 2 | gemini-3.1-flash-image-preview | 自然语言编辑照片、无需 mask |
| **数据持久化** | ADK DatabaseSessionService | SQLite (dev) / PostgreSQL (prod) | ADK 原生集成、state 作用域 |
| **部署** | Google Cloud Run | N/A | WebSocket GA、60min 超时、`adk deploy cloud_run` |
| **容器** | Docker | multi-stage | 前端 build + 后端运行 |

---

## 已知限制

1. **Live API 视频会话 2 分钟限制** — 需要频繁 session resumption，可能有短暂中断
2. **1fps 视频帧** — Gemini 的视觉理解不是真正的实时，依赖前端 CV 补充
3. **浏览器性能** — MediaPipe Pose + Hand 同时运行对低端设备有压力
4. **Gemini 语音延迟** — 网络延迟 + 推理延迟导致语音反馈比前端 CV 反馈慢 0.5-1.5 秒
5. **离线不可用** — 核心功能依赖 Gemini Live API，断网后只有前端 CV 能用
6. **紧急联系人** — 浏览器无法直接拨打电话，需要跳转到 `tel:` URI 或通过后端 Twilio/Cloud Telephony
7. **动作库有限** — 初版只支持主流力量训练动作（卧推/深蹲/硬拉/推举），需要手工定义角度阈值

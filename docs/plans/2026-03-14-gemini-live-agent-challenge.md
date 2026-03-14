# Gemini Live Agent Challenge 比赛分析

> 来源：https://geminiliveagentchallenge.devpost.com/
> 分析日期：2026-03-14

---

## 一、比赛概览

**全称**：Gemini Live Agent Challenge: Redefining Interaction — From Static Chatbots to Immersive Experiences

**核心主题**：用 Google Gemini 构建超越传统文本聊天的、多模态实时交互 AI Agent

**参赛人数**：10,090+

**奖池**：$80,000

---

## 二、赛道选择

三个赛道，MuscleClaw 应选 **Live Agents**：

| 赛道 | 定义 | 强制技术要求 | MuscleClaw 契合度 |
|------|------|-------------|------------------|
| **Live Agents** | 实时音视频交互 Agent，支持自然打断 | Gemini Live API 或 ADK | **最契合** — 实时摄像头 + 语音对话 + 打断 |
| Creative Storyteller | 多模态叙事（文字+图片+音视频混合输出） | Gemini interleaved/mixed output | 部分契合（AI 生图），但不是核心 |
| UI Navigator | 视觉理解 UI 并执行操作 | Gemini 多模态解读截图/录屏 | 不契合 |

---

## 三、评分标准（核心得分点）

### 3.1 Innovation & Multimodal UX — 40%（最高权重！）

评分维度（1-5分）：

| 得分点 | 含义 | MuscleClaw 怎么拿分 |
|--------|------|-------------------|
| **Beyond Text Factor** | 是否打破了文本框范式？交互是否比标准聊天更自然、更沉浸？ | AR 身体面板 + 摄像头骨骼识别 + 实时语音 = 完全不是聊天框 |
| **See, Hear, Speak 集成** | 视觉+听觉+语音是否无缝融合？ | 摄像头看动作(See) + 语音播报(Speak) + 听用户指令(Hear) |
| **独特 Persona/Voice** | Agent 是否有鲜明的人格和语音特征？ | 性格语音系统（正经/温柔/嘲讽三模式）是天然加分项 |
| **实时上下文感知** | 是否根据实时情境做出反应，而非回合制对话？ | 实时动作纠正、安全守卫检测、训练中随时语音交互 |

**策略**：这是 40% 权重的最大分数池，MuscleClaw 的 AR + 语音 + 摄像头交互正好命中。重点演示"不像聊天机器人"的交互方式。

### 3.2 Technical Implementation & Agent Architecture — 30%

评分维度（1-5分）：

| 得分点 | 含义 | MuscleClaw 怎么拿分 |
|--------|------|-------------------|
| **Google GenAI SDK / ADK 使用** | 是否有效利用了 Google 的 AI 工具？ | 必须用 Gemini Live API 做实时音视频交互 |
| **Google Cloud 后端** | 是否稳健地部署在 GCP 上？ | 后端部署到 Cloud Run / GKE |
| **Agent 逻辑** | 错误处理是否优雅？ | 网络断开、摄像头失效、语音识别失败的降级方案 |
| **反幻觉 & Grounding** | 是否有事实依据，避免 AI 胡说？ | 训练建议基于用户的真实数据，动作纠正基于骨骼识别规则 |

**策略**：技术实现要扎实，重点展示 Gemini API 的深度使用（不只是调一个接口）。架构图要清晰展示各组件如何协作。

### 3.3 Demo & Presentation — 30%

评分维度（1-5分）：

| 得分点 | 含义 | MuscleClaw 怎么拿分 |
|--------|------|-------------------|
| **问题定义清晰** | 解决什么问题？为什么重要？ | 独自训练的安全隐患 + 请不起私教 + 手动记录太麻烦 |
| **架构图** | 系统结构一目了然 | 感知层→AI层→语音层→渲染层→数据层 的清晰图 |
| **云部署证明** | 确实跑在 GCP 上 | 录屏展示 Cloud Run 控制台 |
| **真实工作软件** | 不是 mockup，是真能用的东西 | 实机演示，真人做动作，真实纠正 |

**策略**：4 分钟视频是决定性的。必须展示真实使用场景（真人健身 + AI 实时反馈），不能只是 PPT。

### 3.4 Bonus 加分项（最多 +0.6 分）

| 加分项 | 分值 | 难度 | 建议 |
|--------|------|------|------|
| 发布博客/视频（Medium/Dev.to/YouTube） | +0.2 | 低 | **必做** — 写一篇开发博客，带 #GeminiLiveAgentChallenge |
| 自动化云部署脚本（IaC） | +0.2 | 中 | **建议做** — Dockerfile + Cloud Run deploy 脚本 |
| Google Developer Group 会员 | +0.2 | 低 | **能做就做** — 注册 GDG 拿个 profile link |

---

## 四、强制提交物清单

| # | 提交物 | 状态 | 备注 |
|---|--------|------|------|
| 1 | 文字描述（功能、技术、数据来源、学到什么） | 待写 | Devpost 表单填写 |
| 2 | 公开代码仓库 + README 含启动步骤 | 待做 | GitHub public repo |
| 3 | GCP 部署证明（录屏或代码） | 待做 | Cloud Run 控制台录屏 |
| 4 | 架构图 | 待做 | 系统组件图 |
| 5 | 演示视频（≤4分钟，英文或英文字幕） | 待做 | YouTube/Vimeo 公开 |

---

## 五、技术栈适配

### 必须使用的 Google 技术

| 要求 | 具体技术 | MuscleClaw 适配方案 |
|------|---------|-------------------|
| **Gemini 模型** | Gemini 2.5 Flash（稳定版）或更新 | 用 Gemini 2.5 Flash 作为对话核心 |
| **Gemini Live API 或 ADK** | **ADK bidi-streaming**（推荐） | 用 ADK 框架构建实时音视频 Agent |
| **Google GenAI SDK** | `google-genai` Python SDK | ADK 内置依赖 GenAI SDK |
| **至少一个 GCP 服务** | Cloud Run / Firestore 等 | Cloud Run 部署后端 |
| **后端部署在 GCP** | 必须 | Cloud Run（开发用 Gemini API，生产切 Vertex AI） |

### 最新可用模型（2026-03-14 确认）

> Gemini 已到 3.1 代，但 **Live API（实时音视频流）目前只有 2.5 Flash Live 支持**。
> Gemini 2.0 Flash 已 **Deprecated**，Gemini 3 Pro Preview 已于 2026-03-09 **关停**。

#### 实时交互（核心）

| 模型 | Model ID | 状态 | 用途 |
|------|----------|------|------|
| **Gemini 2.5 Flash Live** | `gemini-2.5-flash-native-audio-preview-12-2025` | Preview | **唯一支持 Live API 的模型** — 实时音视频 bidi-streaming |
| **Gemini 2.5 Flash TTS** | `gemini-2.5-flash-preview-tts` | Preview | 可控语音合成（语气/风格） |
| **Gemini 2.5 Pro TTS** | `gemini-2.5-pro-preview-tts` | Preview | 高保真语音（播客级品质） |

#### 推理/分析（辅助）

| 模型 | Model ID | 状态 | 用途 |
|------|----------|------|------|
| **Gemini 3.1 Pro** | `gemini-3.1-pro-preview` | Preview (New) | 最强推理 + Agentic 能力（❌ 不支持 Live API） |
| **Gemini 3.1 Flash-Lite** | `gemini-3.1-flash-lite-preview` | Preview (New) | 前沿性能低成本（❌ 不支持 Live API） |
| **Gemini 3 Flash** | `gemini-3-flash-preview` | Preview | 接近大模型性能的性价比（❌ 不支持 Live API） |
| **Gemini 2.5 Pro** | `gemini-2.5-pro` | ✅ Stable | 复杂任务深度推理 |
| **Gemini 2.5 Flash** | `gemini-2.5-flash` | ✅ Stable | 低延迟高性价比推理 |

#### 图像/视频生成（展示模式可用）

| 模型 | Model ID | 状态 | 用途 |
|------|----------|------|------|
| **Nano Banana 2** | `gemini-3.1-flash-image-preview` | Preview | 高效图像生成/编辑 |
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Preview | SOTA 图像生成，4K，复杂布局 |
| **Veo 3.1** | `veo-3.1-generate-preview` | Preview | 电影级视频生成 + 同步音频 |

#### MuscleClaw 模型选择方案

| 用途 | 选用模型 | 原因 |
|------|---------|------|
| **实时语音+视频交互** | `gemini-2.5-flash-native-audio-preview-12-2025` | 唯一支持 Live API bidi-streaming，128K 上下文 |
| **离线数据分析/力量智脑** | `gemini-2.5-flash` 或 `gemini-3-flash-preview` | 稳定 + 推理能力足够 |
| **AI 肌肉增强生图** | `gemini-3.1-flash-image-preview`（**Nano Banana 2**） | 2026-02-26 发布，Pro 级质量 + Flash 速度，支持自然语言编辑照片（无需 mask） |

> **重要发现**：Nano Banana 2 支持上传用户照片 + 自然语言描述编辑（如"让这个人更壮"），不需要 SD ControlNet。全 Google 技术栈，对评分有利。

**Live API 部署环境**：
- 开发环境：`GOOGLE_GENAI_USE_VERTEXAI=FALSE` + API Key
- 生产环境（Vertex AI）：`GOOGLE_GENAI_USE_VERTEXAI=TRUE` + GCP Project

### 推荐技术方案：ADK v1.27.0 bidi-streaming

> ADK v1.27.0（2026-03-12 发布），Python 3.10-3.14，`pip install google-adk`

**为什么用 ADK 而不是裸 Live API？**
- ADK 封装了 WebSocket 连接管理、会话状态、工具编排
- 开发到生产只需切一个环境变量（`GOOGLE_GENAI_USE_VERTEXAI`）
- 内置 session 持久化（开发用 InMemory，生产用 DatabaseSessionService）
- 支持多 Agent 架构（SequentialAgent / ParallelAgent / LoopAgent）
- 支持 MCP 集成（McpToolset 连接任意 MCP server）
- **一键部署**：`adk deploy cloud_run --with_ui`
- 官方 demo 和 codelab 都是 ADK 架构

**ADK 核心架构**：
```
Web 前端（摄像头+麦克风+Canvas）
    ↓ WebSocket
FastAPI 后端（Cloud Run）
    ↓
LiveRequestQueue → Runner → Agent → GeminiLlmConnection
    ↑                  ↓                    ↓
    ↑           SessionService      Gemini Live API / Vertex AI
    ↑           (DB 持久化)
    ↑
    └── 断线重连（resumption token，2小时有效）
```

**ADK Agent 定义示例**：
```python
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import DatabaseSessionService

agent = Agent(
    name="muscleclaw",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    tools=[analyze_pose, get_training_history, safety_check],
    instruction="你是 MuscleClaw，一个有性格的 AI 健身教练...",
    sub_agents=[safety_agent, image_gen_agent],  # 多 Agent 委派
)

# 生产用 DB 持久化，开发用 InMemorySessionService
session_service = DatabaseSessionService(
    uri="sqlite+aiosqlite:///./sessions.db"
)
runner = Runner(app_name="muscleclaw", agent=agent,
                session_service=session_service)
```

**State 作用域**（ADK 内置）：
- 无前缀 = 当前会话（session-scoped）
- `user:` = 跨会话用户数据（训练历史、体重、偏好）
- `app:` = 全局数据（动作库、规则配置）
- `temp:` = 单次调用临时数据（不持久化）

**音视频规格**：
- 音频输入：16-bit PCM @ 16kHz（单声道），任意采样率会自动重采样
- 音频输出：16-bit PCM @ 24kHz（Native Audio 模型），**只能输出音频**，文本通过 transcription 获取
- 视频输入：**客户端截 JPEG/PNG 帧发送**，最高 1 FPS（不是视频流！）
- 音频消耗：32 token/秒 ≈ 1,920 token/分钟
- 会话时长：音频 15 分钟 / 音频+视频 2 分钟（通过上下文压缩 + session resumption 可无限续期）
- WebSocket 连接约 10 分钟断一次，需实现重连（ADK 内置 resumption token 支持，2小时有效）

**30 种内置声音**（可为不同性格模式选不同声音）：
- 推荐嘲讽模式：Charon / Fenrir（低沉有力）
- 推荐温柔模式：Kore / Aoede（柔和）
- 推荐正经模式：Puck / Orus（专业）

**高级特性（需要 v1alpha 端点）**：
- **Proactive Audio** — 模型自主判断是否需要回应（适合"安静监听"场景）
- **Affective Dialog** — 感知用户语气，自动调整回应情感
- **Non-blocking Function Calling** — 后台执行工具不阻塞对话

### MuscleClaw 技术栈映射

| 层 | 原方案 | 比赛适配 |
|---|--------|---------|
| AI 框架 | 无 | → **Google ADK v1.27.0** |
| AI 对话 | Claude/GPT | → **Gemini 2.5 Flash Live**（Native Audio，128K 上下文） |
| 语音交互 | Hume EVI 3 / OpenAI Realtime | → **Gemini Live API**（ADK bidi-streaming 内置，无需单独 STT/TTS） |
| 图像生成 | SD ControlNet | → **Nano Banana 2**（`gemini-3.1-flash-image-preview`，自然语言编辑照片） |
| 骨骼识别 | MediaPipe BlazePose | **保留**（Google 技术，前端 @mediapipe/tasks-vision，30+ FPS） |
| 手势交互 | 无 | → **MediaPipe Hand Landmark**（21 点手部追踪，前端实时碰撞检测 AR 按钮） |
| 后端框架 | 未定 | → **FastAPI + ADK**（`adk deploy cloud_run --with_ui` 一键部署） |
| 后端部署 | 本地/未定 | → **Cloud Run**（WebSocket GA，超时 60 分钟，可选 GPU L4） |
| 数据存储 | 本地存储 | → **DatabaseSessionService**（SQLite/PostgreSQL）+ `user:` state 跨会话 |
| 前端 | Web（摄像头+Canvas） | **保留**（WebSocket 连 ADK 后端） |

### Gemini Live API 能力详情

**核心能力**：
- **视频帧输入** — 客户端截 JPEG 帧发送（1 FPS），Gemini 理解画面内容
- **双向音频** — 16kHz 输入 / 24kHz 输出，原生音频理解（不只是 STT，能感知语气/情绪/非语音声音）
- **打断能力（barge-in）** — 用户随时插嘴，AI 停下来听，pending 的 function call 会被取消
- **Function Calling** — 对话中可调用后端工具（手动处理响应），支持 Non-blocking 模式
- **Google Search Grounding** — 可搜索最新信息
- **30 种内置声音** — 可在 session 配置中选择
- **70 种语言** — 自动检测
- **输入/输出 Transcription** — 实时语音转文字（不需要单独 STT 服务）
- **Session Resumption** — 断线重连不丢上下文
- **Context Window Compression** — 滑动窗口压缩，支持无限时长会话

**不支持的功能**（Live API 限制）：
- ❌ Code Execution（不能在 Live 中执行代码）
- ❌ URL Context（不能读取 URL 内容）
- ❌ Google Maps 工具
- ❌ 直接文本输出（Native Audio 模型只输出音频，文本通过 transcription 获取）

**这意味着 MuscleClaw 的很多功能可以更简洁地实现**：
- 动作纠正：Gemini 看 1 FPS 截帧判断动作对错 + MediaPipe 前端实时骨骼点辅助
- 语音交互：Live API 内置，不需要单独的 TTS/STT 服务
- 安全检测：Gemini 看画面判断危险姿态，通过 function call 触发警报
- 性格系统：system instruction 定义人格 + 选不同 voice 配不同模式
- 训练数据：function call 调后端读写 session state（`user:` 作用域跨会话持久化）

### 关键参考资源

| 资源 | 链接 | 用途 |
|------|------|------|
| **ADK bidi-streaming demo** | https://github.com/google/adk-samples/tree/main/python/agents/bidi-demo | **起手模板** |
| ADK 开发指南 Part 1 | https://google.github.io/adk-docs/streaming/dev-guide/part1/ | 架构理解 |
| ADK 可视化指南 | https://medium.com/google-cloud/adk-bidi-streaming-a-visual-guide | 架构图参考 |
| Live API 示例集 | https://github.com/GoogleCloudPlatform/generative-ai/tree/main/gemini/multimodal-live-api | 更多 demo |
| Nano Banana 2 文档 | https://ai.google.dev/gemini-api/docs/image-generation | 图像生成/编辑 API |
| Codelab: 实时双向流 | https://codelabs.developers.google.com/way-back-home-level-3 | 动手教程 |
| Codelab: 实时监控 Agent | https://codelabs.developers.google.com/way-back-home-level-4 | 监控场景参考 |
| 语言学习 App 示例 | https://github.com/ZackAkil/immersive-language-learning-with-live-api | 完整项目参考 |
| GCP Credits 申请 | https://forms.gle/rKNPXA1o6XADvQGb7 | **免费额度** |
| MediaPipe Pose Web | https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js | 前端骨骼识别 |

---

## 六、MuscleClaw MVP 功能 vs 比赛得分映射

### 高得分功能（优先做）

| 功能 | 命中的评分维度 | 权重贡献 | 优先级 |
|------|--------------|---------|--------|
| **贾维斯对话核心** | Innovation(40%) + Tech(30%) | 核心 | P0 |
| **性格语音系统** | Innovation-Persona(40%) | 直接加分 | P0 |
| **实时动作教练** | Innovation-实时感知(40%) + Tech-Grounding(30%) | 核心演示 | P0 |
| **安全守卫模式** | Innovation-Context Aware(40%) + Demo-问题定义(30%) | 打动评委 | P0 |
| **AR 身体面板** | Innovation-Beyond Text(40%) + Demo-视觉(30%) | 视觉震撼 | P1 |
| **手势交互** | Innovation-Beyond Text(40%) | 免触碰操作，和其他项目拉开差距 | P1 |

### 加分功能（有时间就做）

| 功能 | 命中的评分维度 | 优先级 |
|------|--------------|--------|
| 体态扫描仪 | Innovation-多模态 | P2 |
| 零操作训练记录 | Innovation-自然交互 | P2 |
| 力量智脑 | Tech-数据 Grounding | P3 |
| 疲劳预警 | Tech-Agent 逻辑 | P3 |

### 加分亮点（用 Google 原生技术替代）

| 功能 | 原方案 | 比赛适配 | 优先级 |
|------|--------|---------|--------|
| 展示模式 · AI 生图 | SD ControlNet | → **Nano Banana 2**（`gemini-3.1-flash-image-preview`），上传照片 + 自然语言编辑，全 Google 技术栈 | P2 |

### 建议砍掉（比赛不需要）

| 功能 | 原因 |
|------|------|
| 杠铃路径可视化 | 实现复杂，对评分贡献低 |

---

## 七、得分最大化策略

### 4 分钟演示视频脚本建议

| 时间 | 内容 | 命中得分点 |
|------|------|----------|
| 0:00-0:30 | 痛点：独自训练不安全、请不起私教、手动记录烦 | Demo-问题定义 |
| 0:30-1:30 | 实机演示：走到摄像头前，语音对话安排训练 → AR 面板显示身体数据 | Innovation-Beyond Text + See/Hear/Speak |
| 1:30-2:30 | 训练中：做卧推 → AI 实时纠正动作 → 嘲讽模式吐槽 → 安全检测演示 | Innovation-Persona + Context Aware |
| 2:30-3:15 | 架构图 + 技术亮点（Gemini Live API + MediaPipe + Cloud Run） | Tech-实现 |
| 3:15-3:45 | 云部署证明（Cloud Run 控制台） | Demo-部署证明 |
| 3:45-4:00 | 总结 + 愿景 | 收尾 |

### 必须在视频中展示的关键要素

1. **真人做动作**（不是动画/mockup）
2. **实时语音对话**（展示打断能力）
3. **AI 看到画面并做出反应**（视觉理解）
4. **嘲讽模式**（展示独特人格，和其他项目区分开）
5. **安全检测**（展示解决真实痛点）

---

## 八、风险与注意事项

| 风险 | 影响 | 应对 |
|------|------|------|
| 功能范围大 | 无法一次实现全部 | 全部功能按设计文档实现，不砍需求 |
| 项目必须是新的 | 不能用已有代码 | 确保 commit 历史从比赛期间开始 |
| Gemini Live API 不熟 | 踩坑风险 | 读 ADK 源码理解 API，按设计文档实现 |
| 英文视频/字幕 | 需要额外工作 | 用英文字幕覆盖中文语音，或直接用英文演示 |
| 必须部署到 GCP | 需要 GCP 账号和配额 | 提前确认账号可用，用 Cloud Run 最省事 |

---

## 九、核心功能方案

**核心功能**：
1. Gemini Live API 实现实时语音+视频对话（贾维斯核心）
2. MediaPipe 骨骼识别 + Gemini 动作分析（实时动作教练）
3. 嘲讽模式语音人格（性格系统）
4. 基本安全检测（卡住检测）

**基础设施**：
- 前端：Web（摄像头 + Canvas + WebSocket）
- 后端：Python/Node.js → Cloud Run
- AI：Gemini Live API（音视频流）+ Gemini Pro（对话/分析）
- 感知：MediaPipe BlazePose（前端）

**提交物**：
- GitHub 公开 repo + README
- Cloud Run 部署
- 架构图
- 4 分钟演示视频（YouTube）
- 一篇 dev.to 博客（+0.2 bonus）

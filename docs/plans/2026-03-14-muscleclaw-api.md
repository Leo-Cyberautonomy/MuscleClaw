# MuscleClaw — API 设计

> 基于：`2026-03-14-muscleclaw-design.md` + `2026-03-14-muscleclaw-ui.md`

## 架构说明

MuscleClaw **不是传统 REST API 应用**。其核心通信是 ADK bidi-streaming WebSocket，"API 端点"本质上是三类接口：

1. **WebSocket 协议** — 前后端实时双向通信（音频、视频、CV 事件、UI 指令）
2. **ADK Tools** — Gemini Agent 可调用的后端工具函数（读写数据、触发动作）
3. **REST 端点** — 少量非实时接口（健康检查、静态资源、初始化）

```
前端 ──WebSocket──→ FastAPI ──→ ADK Runner ──→ Gemini Live API
                                    │
                                    ├── Tools（读写 SessionService state）
                                    ├── Sub-agents（ImageGen / Analysis）
                                    └── SessionService（SQLite/PostgreSQL）
```

---

## 一、数据模型（ADK State Schema）

所有持久化数据存储在 ADK `DatabaseSessionService` 中，通过 state key 的前缀区分作用域。

### 作用域规则

| 前缀 | 作用域 | 生命周期 | 用途 |
|------|--------|---------|------|
| `user:` | 用户级 | 跨会话永久 | 训练历史、身体档案、偏好 |
| `app:` | 全局 | 所有用户共享 | 动作库、规则配置 |
| 无前缀 | 会话级 | 当前 WebSocket 连接 | 当前训练状态 |
| `temp:` | 临时 | 单次工具调用 | 中间计算结果 |

### 实体 1：身体档案（user:body_profile）

**描述**：用户六大身体部位的力量数据和恢复状态。对应 UI：body_scan 模式的 AR 身体面板。

```typescript
type BodyProfile = {
  [part in BodyPart]: {
    max_weight: number;         // 该部位代表动作的最大重量(kg)
    exercise: string;           // 代表动作 ID（如 "bench_press"）
    last_trained: string;       // ISO 8601 日期 "2026-03-12"
    recovery_hours: number;     // 预估恢复所需小时数
    recovery_status: "recovered" | "recovering" | "fatigued";
    notes: string;              // 附加说明（如伤病）
  };
};

type BodyPart = "chest" | "shoulders" | "back" | "legs" | "core" | "arms";
```

**约束**：
- `max_weight` ≥ 0
- `exercise` 必须是 `app:exercise_library` 中已有的 key
- `recovery_status` 由系统根据 `last_trained` + `recovery_hours` 自动计算

**默认值**（新用户）：
```json
{
  "chest":     { "max_weight": 0, "exercise": "bench_press",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": "" },
  "shoulders": { "max_weight": 0, "exercise": "ohp",          "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": "" },
  "back":      { "max_weight": 0, "exercise": "barbell_row",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": "" },
  "legs":      { "max_weight": 0, "exercise": "squat",        "last_trained": "", "recovery_hours": 96, "recovery_status": "recovered", "notes": "" },
  "core":      { "max_weight": 0, "exercise": "plank",        "last_trained": "", "recovery_hours": 24, "recovery_status": "recovered", "notes": "" },
  "arms":      { "max_weight": 0, "exercise": "barbell_curl", "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": "" }
}
```

---

### 实体 2：训练历史（user:training_history）

**描述**：用户的所有训练记录。对应 UI：训练日历热力图、力量曲线图、力量智脑分析。

```typescript
type TrainingHistory = TrainingSession[];

type TrainingSession = {
  id: string;                  // UUID
  date: string;                // ISO 8601 日期 "2026-03-12"
  start_time: string;          // ISO 8601 时间 "2026-03-12T14:30:00Z"
  end_time: string | null;     // 训练结束时间（进行中为 null）
  exercises: ExerciseRecord[];
};

type ExerciseRecord = {
  exercise_id: string;         // 动作 ID（关联 app:exercise_library）
  sets: SetRecord[];
};

type SetRecord = {
  set_number: number;          // 第几组（从 1 开始）
  reps: number;                // 完成次数
  weight: number;              // 重量(kg)
  rpe: number | null;          // 自觉用力度 1-10（可选）
  rom_avg_degrees: number | null; // 平均 ROM 角度（CV 测量）
  symmetry_score: number | null;  // 对称性评分 0-100（CV 测量）
  duration_ms: number | null;  // 该组总时长（毫秒）
  notes: string;               // 备注（如"左肩有点疼"）
};
```

**约束**：
- `reps` ≥ 0
- `weight` ≥ 0
- `rpe` 范围 1-10 或 null
- `rom_avg_degrees` 范围 0-360 或 null
- `symmetry_score` 范围 0-100 或 null
- 按 `date` 降序排列

**存储策略**：保留最近 365 天（约 200-300 条 session，每条约 1KB），超出的归档或删除。

---

### 实体 3：用户偏好（user:preferences）

**描述**：用户的个性化设置。对应 UI：设置面板。

```typescript
type UserPreferences = {
  personality_mode: "professional" | "gentle" | "trash_talk";
  language: string;                // BCP-47 格式 "zh-CN"
  emergency_contact: string;       // 电话号码，如 "+86-138-xxxx-xxxx"
  rest_timer_seconds: number;      // 默认组间休息时间（秒）
  ai_volume: number;               // AI 语音音量 0-100
  safety_sensitivity: "low" | "medium" | "high";
  voice_name: string;              // Gemini 声音名称，跟随性格自动设置
  onboarding_completed: boolean;   // 是否完成首次引导
};
```

**默认值**：
```json
{
  "personality_mode": "trash_talk",
  "language": "zh-CN",
  "emergency_contact": "",
  "rest_timer_seconds": 120,
  "ai_volume": 70,
  "safety_sensitivity": "medium",
  "voice_name": "Charon",
  "onboarding_completed": false
}
```

**约束**：
- `rest_timer_seconds` 范围 30-600
- `ai_volume` 范围 0-100
- `voice_name` 必须是 Gemini 支持的 30 种声音之一

**性格→声音映射**（自动联动）：
| 性格 | 默认声音 | 备选 |
|------|---------|------|
| professional | Puck | Orus |
| gentle | Kore | Aoede |
| trash_talk | Charon | Fenrir |

---

### 实体 4：伤病记录（user:injuries）

**描述**：用户已知的伤病/限制。对应 UI：AI 规划训练时避开相关动作。

```typescript
type Injuries = Injury[];

type Injury = {
  id: string;
  body_part: BodyPart;
  description: string;         // "右肩肱骨前移"
  since: string;               // ISO 月份 "2026-01"
  severity: "mild" | "moderate" | "severe";
  avoid_exercises: string[];   // 需避开的动作 ID
  notes: string;
};
```

---

### 实体 5：体态快照（user:posture_snapshots）

**描述**：体态评估的历史记录。对应 UI：posture 模式的前后对比。

```typescript
type PostureSnapshots = PostureSnapshot[];

type PostureSnapshot = {
  id: string;
  timestamp: string;           // ISO 8601
  items: PostureItem[];
  overall_score: number;       // 0-100 综合评分
};

type PostureItem = {
  name: string;                // "骨盆前倾" "肩部对称性" "脊柱侧弯" "肱骨前移"
  status: "normal" | "mild" | "attention";
  angle_degrees: number | null;
  deviation_from_normal: number | null; // 偏离标准值的度数
  note: string;                // "右肩前移 5°"
};
```

**约束**：保留最近 50 条快照。

---

### 实体 6：动作库（app:exercise_library）

**描述**：全局共享的训练动作定义。对应 UI：训练模式的 CV 检测规则。

```typescript
type ExerciseLibrary = {
  [exercise_id: string]: ExerciseDefinition;
};

type ExerciseDefinition = {
  name: string;                    // "卧推"
  name_en: string;                 // "Bench Press"
  primary_muscles: BodyPart[];     // ["chest"]
  secondary_muscles: BodyPart[];   // ["shoulders", "arms"]
  tracking_joints: JointPair[];    // 用于 rep 计数的关节对
  rom_threshold_degrees: number;   // 最小 ROM（度），低于此值不计数
  symmetry_threshold_degrees: number; // 对称性阈值（度）
  safety_checks: SafetyCheck[];    // 安全检测规则
  common_errors: CommonError[];    // 常见错误模式
};

type JointPair = {
  joint_a: string;  // MediaPipe landmark name "LEFT_SHOULDER"
  joint_b: string;  // "LEFT_ELBOW"
  joint_c: string;  // "LEFT_WRIST"
  // 角度 = joint_a-joint_b-joint_c 三点角
};

type SafetyCheck = {
  name: string;              // "barbell_stall"
  description: string;       // "杠铃停滞在胸口"
  detection_rule: string;    // "shoulder_y_delta < 2px for 10 frames"
};

type CommonError = {
  name: string;              // "elbow_flare"
  description: string;       // "肘部过度外展"
  detection_rule: string;    // "elbow_angle > 75°"
  correction: string;        // "收紧肘部，约45度角"
};
```

**初始数据**：MVP 包含以下动作：

| ID | 名称 | 主要肌群 | 追踪关节 |
|----|------|---------|---------|
| bench_press | 卧推 | chest | 肩-肘-腕 |
| squat | 深蹲 | legs | 髋-膝-踝 |
| deadlift | 硬拉 | back, legs | 髋-膝-踝 + 肩-髋 |
| ohp | 推举 | shoulders | 肩-肘-腕 |
| barbell_row | 杠铃划船 | back | 肩-肘-腕 |
| barbell_curl | 杠铃弯举 | arms | 肩-肘-腕 |
| plank | 平板支撑 | core | 肩-髋-踝（保持角度） |

---

### 实体 7：会话状态（无前缀，session-scoped）

**描述**：当前训练会话的实时状态。WebSocket 断开即丢失（可通过 resumption 恢复）。

```typescript
type SessionState = {
  current_mode: "idle" | "body_scan" | "planning" | "training" | "posture" | "showcase";
  current_session_id: string | null;       // 当前 TrainingSession 的 ID
  current_exercise_id: string | null;      // 当前正在做的动作
  current_set_number: number;              // 当前第几组
  current_reps: number;                    // 当前组已完成 rep 数
  current_plan: TrainingPlan | null;       // 当前训练计划
  rest_timer_remaining: number;            // 休息倒计时剩余秒数（0=未在休息）
  safety_alert_active: boolean;            // 安全警报是否激活
  safety_countdown: number;                // 安全倒计时剩余秒数
  posture_scan_step: number;               // 体态扫描当前步骤（0=未开始, 1=正面, 2=左侧, 3=背面, 4=右侧）
};

type TrainingPlan = {
  target_parts: BodyPart[];                // 今天训练的部位
  exercises: PlannedExercise[];
};

type PlannedExercise = {
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight: number;
  completed: boolean;
};
```

---

### 实体关系

```
user:preferences (1:1)
     │
     user ─── user:body_profile (1:1)
     │
     ├── user:training_history (1:N sessions)
     │        └── exercises (1:N)
     │             └── sets (1:N)
     │
     ├── user:injuries (1:N)
     │
     └── user:posture_snapshots (1:N)

app:exercise_library (全局共享，所有用户只读)
```

---

## 二、WebSocket 协议

### 连接

```
ws(s)://{host}/ws/{user_id}

Query params:
  - session_id (optional): 恢复已有会话
  - resumption_token (optional): 断线重连 token（2小时有效）
```

### 消息格式

所有 JSON 消息遵循统一包装：

```typescript
// 前端 → 后端
type ClientMessage =
  | { type: "audio"; data: string }            // base64 PCM 16kHz chunk
  | { type: "video_frame"; data: string }      // base64 JPEG
  | { type: "cv_event"; event: CVEvent }       // CV 分析事件
  | { type: "text"; text: string }             // 文本输入（回退方案）
  | { type: "tool_response"; id: string; result: any } // 工具调用响应

// 后端 → 前端
type ServerMessage =
  | { type: "audio"; data: string }            // base64 PCM 24kHz chunk
  | { type: "transcript"; role: "user" | "model"; text: string }
  | { type: "ui_command"; command: UICommand }  // UI 指令
  | { type: "tool_call"; id: string; name: string; args: any } // 前端工具调用
  | { type: "state_update"; key: string; value: any } // 状态同步
  | { type: "error"; code: string; message: string }
  | { type: "connected"; session_id: string; resumption_token: string }
  | { type: "reconnected"; restored: boolean }
```

### CV 事件类型

```typescript
type CVEvent =
  | { type: "person_detected"; detected: boolean }
  | { type: "exercise_detected"; exercise_id: string; confidence: number }
  | { type: "rep_complete"; exercise_id: string; rep: number; rom_degrees: number; duration_ms: number }
  | { type: "form_issue"; exercise_id: string; issue: string; severity: "warning" | "danger"; details: string }
  | { type: "symmetry_issue"; exercise_id: string; left_angle: number; right_angle: number; diff: number }
  | { type: "safety_alert"; alert: "barbell_stall" | "body_collapse" | "extended_stillness"; confidence: number }
  | { type: "gesture"; gesture: "thumbs_up" | "ok" | "wave" | "point_click"; target?: string }
  | { type: "set_complete"; exercise_id: string; reps: number; estimated_rpe: number }
  | { type: "posture_snapshot"; landmarks: number[][]; analysis: PostureItem[] }
```

**发送规则**：
- `person_detected`: 状态变化时发送（进入/离开画面）
- `exercise_detected`: 检测到新动作或动作变化时
- `rep_complete`: 每完成一个 rep
- `form_issue`: 检测到问题时（同一问题 3 秒内不重复发送）
- `safety_alert`: 置信度 > 0.7 时发送
- `gesture`: 检测到手势时（同一手势 1 秒内不重复发送）

### UI 指令类型

```typescript
type UICommand =
  | { command: "switch_mode"; mode: SessionState["current_mode"] }
  | { command: "show_body_panel"; profile: BodyProfile; recommended_parts?: BodyPart[] }
  | { command: "show_training_plan"; plan: TrainingPlan }
  | { command: "update_set_info"; exercise: string; set_number: number; target_reps: number; target_weight: number }
  | { command: "start_rest_timer"; seconds: number }
  | { command: "show_posture_report"; report: PostureSnapshot }
  | { command: "show_posture_comparison"; before: PostureSnapshot; after: PostureSnapshot }
  | { command: "show_strength_chart"; data: { date: string; weight: number }[] }
  | { command: "show_image_result"; original_url: string; enhanced_url: string }
  | { command: "show_safety_alert"; countdown_seconds: number }
  | { command: "cancel_safety_alert" }
  | { command: "show_notification"; text: string; level: "info" | "success" | "warning" }
  | { command: "update_sidebar"; content: SidebarContent }
```

### 连接生命周期

```
1. 前端发起 WebSocket 连接: /ws/{user_id}
2. 后端返回: { type: "connected", session_id: "xxx", resumption_token: "yyy" }
3. 前端保存 resumption_token（localStorage）
4. 双向流开始：前端发 audio + video_frame + cv_event，后端发 audio + transcript + ui_command
5. 约 10 分钟后 WebSocket 断开（Gemini Live API 限制）
6. 前端自动重连: /ws/{user_id}?resumption_token=yyy
7. 后端返回: { type: "reconnected", restored: true }
8. 上下文恢复，继续对话
```

**断线重连策略**：
| 尝试次数 | 延迟 | 动作 |
|----------|------|------|
| 1 | 即时 | 用 resumption_token 重连 |
| 2 | 1s | 用 resumption_token 重连 |
| 3 | 3s | 用 resumption_token 重连 |
| 4 | 5s | 无 token 新建会话（上下文丢失） |
| 5 | 10s | 同上 |
| >5 | 停止 | 显示"连接失败"，用户手动重试 |

---

## 三、ADK Tools（Agent 可调用的工具）

每个 Tool 是一个 Python 函数，Gemini Agent 通过 function calling 调用。

### Tool 清单

| Tool | 对应 UI | 读/写 | 描述 |
|------|---------|------|------|
| `get_body_profile` | body_scan AR 面板 | 读 | 获取六大部位身体档案 |
| `update_body_profile` | 训练完成后自动 | 写 | 更新某部位数据 |
| `get_training_history` | 力量曲线图、日历 | 读 | 获取最近 N 天训练记录 |
| `record_training_set` | 每组结束时 | 写 | 记录一组训练数据 |
| `start_training_session` | 开始训练时 | 写 | 创建新训练会话 |
| `end_training_session` | 训练结束时 | 写 | 结束当前训练会话 |
| `generate_training_plan` | planning 模式 | 读+写 | 基于身体档案生成训练计划 |
| `get_exercise_info` | 训练模式 HUD | 读 | 获取动作定义（阈值、规则） |
| `analyze_posture` | posture 模式 | 读+写 | 分析体态数据并保存 |
| `get_posture_history` | posture 对比 | 读 | 获取历史体态快照 |
| `trigger_safety_alert` | 安全覆盖层 | 写 | 触发安全倒计时 |
| `cancel_safety_alert` | 取消安全警报 | 写 | 取消安全倒计时 |
| `get_user_preferences` | 设置面板 | 读 | 获取用户偏好 |
| `update_user_preferences` | 设置面板修改 | 写 | 更新用户偏好 |
| `get_injuries` | AI 规划时参考 | 读 | 获取伤病记录 |
| `update_injuries` | 用户报告伤病 | 写 | 添加/更新伤病 |
| `send_ui_command` | 所有 UI 模式 | — | 向前端发送 UI 指令 |
| `capture_screenshot` | 展示模式截图 | — | 请求前端截图 |

### Tool 详细定义

#### `get_body_profile`

```python
def get_body_profile(ctx) -> dict:
    """获取用户的六大身体部位档案。

    返回每个部位的代表力量、最近训练时间、恢复状态。
    用于身体扫描模式的 AR 面板展示和训练规划。

    Returns:
        dict: 六大部位数据，key 为 body part name
        示例: {
            "chest": {"max_weight": 110, "exercise": "bench_press",
                      "last_trained": "2026-03-12", "recovery_status": "recovered", ...},
            ...
        }
    """
```

**调用时机**：进入 body_scan 模式时
**对应 UI**：body_scan 模式 AR 身体面板 6 个卡片

---

#### `update_body_profile`

```python
def update_body_profile(ctx, part: str, max_weight: float = None,
                        last_trained: str = None, notes: str = None) -> str:
    """更新某个身体部位的数据。

    Args:
        part: 部位名称，"chest" | "shoulders" | "back" | "legs" | "core" | "arms"
        max_weight: 新的最大重量(kg)，如果本次训练突破了记录
        last_trained: 最近训练日期 ISO 8601，通常设为今天
        notes: 附加说明

    Returns:
        str: 确认信息 "已更新胸部数据：卧推 115kg"

    业务规则:
        - recovery_status 根据 last_trained + recovery_hours 自动重算
        - max_weight 只在新值 > 旧值时更新（不会因为轻重量日降低）
        - 除非显式传入 max_weight，否则不改变现有值
    """
```

**调用时机**：训练结束后 Agent 自动判断是否需要更新
**对应 UI**：下次 body_scan 时面板显示更新后的数据

---

#### `get_training_history`

```python
def get_training_history(ctx, days: int = 30,
                         exercise_id: str = None) -> dict:
    """获取用户最近 N 天的训练记录。

    Args:
        days: 查询最近多少天，默认 30，最大 365
        exercise_id: 可选，只返回指定动作的记录

    Returns:
        dict: {
            "sessions": [...],    # TrainingSession 列表
            "summary": {
                "total_sessions": 12,
                "total_sets": 48,
                "trained_parts": {"chest": 4, "back": 3, ...},  # 各部位训练次数
                "calendar": [{"date": "2026-03-12", "parts": ["chest", "back"]}, ...]
            }
        }

    业务规则:
        - 按日期降序返回
        - summary.calendar 用于训练日历热力图
        - 如果指定 exercise_id，summary 只统计该动作
    """
```

**调用时机**：body_scan 模式（日历）、训练模式（力量曲线）、力量智脑分析
**对应 UI**：训练日历热力图、力量曲线图、侧边栏历史数据

---

#### `record_training_set`

```python
def record_training_set(ctx, exercise_id: str, set_number: int,
                        reps: int, weight: float,
                        rpe: float = None,
                        rom_avg_degrees: float = None,
                        symmetry_score: float = None,
                        duration_ms: int = None,
                        notes: str = "") -> str:
    """记录一组训练数据。

    Args:
        exercise_id: 动作 ID
        set_number: 第几组（从 1 开始）
        reps: 完成次数
        weight: 重量(kg)
        rpe: 自觉用力度 1-10
        rom_avg_degrees: CV 测量的平均 ROM
        symmetry_score: CV 测量的对称性评分 0-100
        duration_ms: 该组总时长
        notes: 备注

    Returns:
        str: "已记录：卧推第2组 105kg×6 RPE8"

    业务规则:
        - 自动关联到 current_session_id（会话状态中）
        - 如果 current_session_id 为空，先自动调用 start_training_session
        - reps=0 表示这组失败（未完成任何 rep）
        - 如果 weight > body_profile 对应部位的 max_weight，自动更新 max_weight
    """
```

**调用时机**：每组结束后，Agent 语音确认后调用
**对应 UI**：侧边栏"本组数据"卡片更新

---

#### `start_training_session` / `end_training_session`

```python
def start_training_session(ctx, plan: dict = None) -> str:
    """创建新的训练会话。

    Args:
        plan: 可选，训练计划对象。如果不传则创建空会话

    Returns:
        str: "训练会话已开始，ID: xxx"

    业务规则:
        - 设置 session state: current_session_id, current_mode="training"
        - 如果有 plan，设置 current_plan
        - 记录 start_time
    """

def end_training_session(ctx) -> str:
    """结束当前训练会话。

    Returns:
        str: 训练总结 "今天完成：卧推4组、划船3组，总计45分钟"

    业务规则:
        - 设置 end_time
        - 更新相关部位的 body_profile.last_trained
        - 重算所有训练部位的 recovery_status
        - 清除会话级状态（current_exercise_id 等）
        - 发送 UI 指令显示训练总结
    """
```

---

#### `generate_training_plan`

```python
def generate_training_plan(ctx, target_parts: list[str] = None) -> dict:
    """基于用户身体档案和训练历史生成训练计划。

    Args:
        target_parts: 可选，指定训练部位。不传则自动推荐

    Returns:
        dict: TrainingPlan 对象
        示例: {
            "target_parts": ["chest", "back"],
            "exercises": [
                {"exercise_id": "bench_press", "target_sets": 4, "target_reps": 6, "target_weight": 105},
                {"exercise_id": "incline_press", "target_sets": 3, "target_reps": 8, "target_weight": 80},
                {"exercise_id": "barbell_row", "target_sets": 4, "target_reps": 8, "target_weight": 90},
            ]
        }

    业务规则:
        - 如果不指定 target_parts，根据 recovery_status 和训练频率自动推荐
        - target_weight 基于历史数据 + APRE 算法计算
        - 避开 user:injuries 中标记的动作
        - 结果保存到 session state current_plan
        - 发送 UI 指令 show_training_plan
    """
```

**调用时机**：用户说"帮我安排训练"后
**对应 UI**：planning 模式侧边栏训练计划表格

---

#### `analyze_posture`

```python
def analyze_posture(ctx, landmarks: list[list[float]],
                    direction: str) -> dict:
    """分析一个角度的体态数据。

    Args:
        landmarks: 33 个 MediaPipe landmark 的 [x, y, z] 坐标
        direction: "front" | "left" | "back" | "right"

    Returns:
        dict: {
            "direction": "front",
            "items": [
                {"name": "骨盆前倾", "status": "normal", "angle_degrees": 12, ...},
                {"name": "肩部对称性", "status": "mild", "angle_degrees": null, "deviation_from_normal": 5, ...},
            ]
        }

    业务规则:
        - 四个方向都完成后自动汇总为完整的 PostureSnapshot
        - 保存到 user:posture_snapshots
        - 发送 UI 指令 show_posture_report
    """
```

---

#### `trigger_safety_alert` / `cancel_safety_alert`

```python
def trigger_safety_alert(ctx, alert_type: str,
                         countdown_seconds: int = 10) -> str:
    """触发安全警报。

    Args:
        alert_type: "barbell_stall" | "body_collapse" | "unresponsive"
        countdown_seconds: 倒计时秒数，默认 10

    Returns:
        str: "安全警报已触发，10秒后拨打紧急联系人"

    业务规则:
        - 设置 session state: safety_alert_active=True, safety_countdown=N
        - 发送 UI 指令 show_safety_alert
        - Agent 必须立即用严肃语气语音通知用户
        - 倒计时由前端 UI 管理，到 0 时前端发送 timeout 事件
        - 如果 emergency_contact 为空，提示用户设置
    """

def cancel_safety_alert(ctx) -> str:
    """取消安全警报。

    Returns:
        str: "安全警报已取消"

    业务规则:
        - 设置 safety_alert_active=False
        - 发送 UI 指令 cancel_safety_alert
    """
```

---

#### `send_ui_command`

```python
def send_ui_command(ctx, command: str, data: dict = None) -> str:
    """向前端发送 UI 指令。

    这是 Agent 控制前端界面的唯一方式。

    Args:
        command: UI 指令名称（见 UICommand 类型定义）
        data: 指令数据负载

    Returns:
        str: "UI 指令已发送: {command}"

    业务规则:
        - 指令通过 WebSocket 的 ServerMessage 推送到前端
        - 前端接收后更新界面
        - 不等待前端确认（fire-and-forget）
    """
```

**调用时机**：任何需要更新前端 UI 的场景
**对应 UI**：模式切换、面板显示、数据更新等一切界面变化

---

#### `get_exercise_info`

```python
def get_exercise_info(ctx, exercise_id: str) -> dict:
    """获取动作定义信息。

    Args:
        exercise_id: 动作 ID

    Returns:
        dict: ExerciseDefinition 对象，包含名称、追踪关节、阈值、安全检查规则

    业务规则:
        - 从 app:exercise_library 读取
        - 如果 exercise_id 不存在，返回 None + Agent 语音说"这个动作我还不认识"
    """
```

---

## 四、REST 端点（非实时）

少量非 WebSocket 的 HTTP 端点，用于页面加载、健康检查等。

| 方法 | 路径 | 描述 | 对应 UI |
|------|------|------|---------|
| GET | `/` | 前端 SPA 入口页 | 页面加载 |
| GET | `/health` | 健康检查 | Cloud Run 探针 |
| GET | `/api/exercises` | 动作库列表 | 前端预加载 CV 规则 |
| POST | `/api/upload/screenshot` | 上传截图 | 展示模式截图保存 |
| GET | `/api/images/{id}` | 获取生成的图片 | 展示模式结果展示 |

### GET `/api/exercises`

```
用途：前端启动时预加载动作库，供 CV 引擎使用
认证：不需要（动作库是公开的）

响应 200:
{
  "data": {
    "bench_press": {
      "name": "卧推",
      "tracking_joints": [{"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"}],
      "rom_threshold_degrees": 140,
      "symmetry_threshold_degrees": 10,
      "safety_checks": [...]
    },
    ...
  }
}
```

### POST `/api/upload/screenshot`

```
用途：展示模式下上传用户摆姿截图，用于 AI 生图
认证：需要 user_id（URL param 或 header）

请求:
  Content-Type: multipart/form-data
  Body: file (JPEG, max 5MB)

响应 200:
{
  "data": {
    "screenshot_id": "uuid",
    "url": "/api/images/uuid"
  }
}

错误:
  413: 文件过大（>5MB）
  415: 不支持的文件格式
```

### GET `/api/images/{id}`

```
用途：获取截图或 AI 生成的图片
认证：需要 user_id

响应 200: image/jpeg binary
错误 404: 图片不存在
```

---

## 五、第三方集成

### Gemini Live API（核心）

| 项目 | 值 |
|------|-----|
| 端点 | `generativelanguage.googleapis.com` (API Key) 或 Vertex AI |
| 模型 | `gemini-2.5-flash-native-audio-preview-12-2025` |
| 协议 | WebSocket bidi-streaming（通过 ADK 封装） |
| 认证 | API Key（开发）/ Vertex AI Service Account（生产） |
| 音频输入 | PCM 16kHz 16-bit mono |
| 音频输出 | PCM 24kHz 16-bit mono |
| 视频输入 | JPEG base64，1fps |
| 上下文窗口 | 128K tokens |
| 会话限制 | 音频 15min / 音频+视频 2min（需 resumption 续期） |
| 速率限制 | 10 QPM（免费）/ 1000+ QPM（付费） |
| 费用 | ~$0.15/min 音频+视频（预估） |

### Gemini 2.5 Flash（分析）

| 项目 | 值 |
|------|-----|
| 模型 | `gemini-2.5-flash` |
| 协议 | REST / GenAI SDK（通过 ADK sub-agent） |
| 用途 | 力量智脑深度分析、训练计划生成 |
| 上下文窗口 | 1M tokens |

### Nano Banana 2（图像生成）

| 项目 | 值 |
|------|-----|
| 模型 | `gemini-3.1-flash-image-preview` |
| 协议 | REST / GenAI SDK（通过 ADK sub-agent） |
| 用途 | 展示模式 AI 肌肉增强生图 |
| 输入 | 用户照片 + 自然语言编辑指令 |
| 输出 | 编辑后的图片 |
| 限制 | 可能有内容安全过滤（裸露/不当内容） |

### MediaPipe（前端，无后端调用）

| 项目 | 值 |
|------|-----|
| 包 | `@mediapipe/tasks-vision` |
| 模型 | PoseLandmarker (33pt) + HandLandmarker (21pt) |
| 运行位置 | 浏览器（WASM） |
| 无后端 API | 纯前端处理，通过 CV 事件将结果发送到后端 |

---

## 六、认证与安全

### 认证方式

**MVP 阶段：简单 user_id 路由**

MuscleClaw MVP 是单用户本地使用场景（一个摄像头对应一个用户），不需要复杂认证：

- WebSocket 连接通过 URL 中的 `user_id` 标识用户
- `user_id` 由前端生成（UUID）并存储在 `localStorage`
- 后端通过 `user_id` 找到对应的 ADK session

**未来扩展**（MVP 不实现）：
- Google OAuth 登录
- JWT token 认证
- 多设备同步

### 安全考虑

| 风险 | 缓解 |
|------|------|
| user_id 猜测/伪造 | MVP 阶段可接受（单用户场景）；未来加 OAuth |
| WebSocket 未加密 | 生产环境强制 wss:// (TLS) |
| 截图隐私 | 截图存在服务器本地（Cloud Run 临时存储），不上传第三方 |
| 训练数据隐私 | 数据存在 ADK SessionService（Cloud Run 内部 SQLite/PostgreSQL） |
| Gemini API Key 泄露 | Key 只在后端使用，前端不接触 |
| CV 事件伪造 | MVP 阶段可接受；未来可加签名验证 |

---

## 七、API 约定

```
WebSocket URL:      ws(s)://{host}/ws/{user_id}
REST URL:           https://{host}/api/{resource}
请求格式:           JSON（WebSocket）/ JSON + multipart（REST）
响应格式:           JSON（统一包装 { data, error, meta }）
时间格式:           ISO 8601 "2026-03-14T14:30:00Z"
ID 格式:            UUID v4
错误格式:           { "error": { "code": "ERROR_CODE", "message": "..." } }
CV 事件去重:        同类型事件最小间隔见各事件定义
UI 指令:            fire-and-forget，不等待前端确认
State 持久化:       user: 前缀 → 跨会话 / 无前缀 → 当前会话 / app: → 全局只读
```

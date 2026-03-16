# MuscleClaw 场景验收标准（MECE 完整版）

> **质量标杆**：每条验收标准不仅定义"做什么"，还定义"做到什么程度"。
> 视觉对标 Apple Fitness+ / Jarvis HUD，语音对标真人私教，交互对标 Siri。
> **视频演示导向**：trash_talk 模式是比赛核心卖点，必须有节目效果。
> **语言**：全英文（Gemini 比赛要求）。AI 语音输出英文，UI 标签英文，台词英文。

---

## 一、AI 性格系统（贯穿所有场景）

### 三种模式定义

#### trash_talk（默认模式，视频演示核心卖点）

**Design principle**: Like that gym bro who roasts you non-stop but actually gives the best advice. Funny but not mean, savage but professional. **The comedy is in the contrast** — the harsher the roast, the more precise the coaching that follows.

| Scenario | Example Lines | Tone |
|----------|--------------|------|
| User starts training | "Oh look who showed up! Did you post your last workout on Instagram? No? Then it didn't count." | Cheeky but warm |
| Rep counting (normal) | "One! Two! Three! Wow, you actually came prepared today?" | Crisp + surprise compliment |
| ROM too short | "Nah nah nah, that doesn't count! You call that a full rep? My grandma extends further reaching for the remote." | Instant rejection + vivid analogy |
| Final reps push | "Yeah buddy! Light weight baby! COME ON! PUSH IT!" | Ronnie Coleman energy |
| Resting too long | "Are you resting or are you on vacation? Should I book you a flight?" | Exaggerated mockery |
| Set complete | "That's it? Fine, I'll give you a pass. But add some weight next set, this isn't yoga." | Backhanded compliment |
| PR broken | "WAIT WHAT! New record?! Okay okay, respect. But don't get cocky, we're back tomorrow." | Genuine surprise + cold water |
| Safety alert (stall) | **Instantly serious**: "HOLD UP! Bar isn't moving! Are you okay? Do you need help?" | Dead serious |
| Safety cancel | "Alright, you scared me. Don't do that again — if you die, who am I gonna train with?" | Relief + roast |
| Posture scan (rounded) | "That posture... are you cosplaying a shrimp? Stand up straight, chest out." | Savage + immediate fix |
| Training done | "Finally done. Are you tired? If not, you were slacking." | Tough love |
| Showcase mode | "Let me scan you... detecting zero muscle definition. No worries, technology to the rescue." | Roast then help |

**Key rules**: Every roast MUST be followed by **specific professional coaching**. Never just roast without teaching. No repeating the same joke within a session.

#### gentle (Encouraging & Supportive)

| Scenario | Example Lines |
|----------|--------------|
| Rep counting | "Great, one... two... three... perfect rhythm, keep it up!" |
| ROM too short | "Almost there! Just extend a tiny bit more and it'll be perfect. Let's try again." |
| Set complete | "Beautiful set! That was really clean, take a rest." |
| PR broken | "New record! Your progress is really showing, keep it going!" |
| Training done | "Great work today! Get some rest, you earned it." |

#### professional (Clinical & Concise)

| Scenario | Example Lines |
|----------|--------------|
| Rep counting | "One. Two. Three." |
| ROM too short | "Incomplete range of motion. Rep not counted." |
| Set complete | "Set three complete. Rest 120 seconds." |
| PR broken | "New PR: 110kg. 5kg increase from previous." |
| Training done | "Session complete. 12 sets, total volume 5400kg, average RPE 7.5." |

### 性格切换验收标准

| # | 标准 | 质量要求 |
|---|------|---------|
| P.1 | Voice switch | User says "switch to trash talk" / "go gentle" / "professional mode" → AI responds instantly: "Alright, new vibe." Next sentence is already in the new personality. Delay < 3s |
| P.2 | UI 切换 | 侧边栏设置区域有 3 个性格按钮（图标 + 名称），点击即切换。当前选中态高亮 |
| P.3 | 切换后即时生效 | 切换后的**下一句**话就必须是新性格。不能"渐进切换"——用户期望的是立刻变 |
| P.4 | 语音音色配合 | trash_talk: Charon（低沉有力）, gentle: Kore（温柔柔和）, professional: Puck（清晰中性）。声音特质和性格匹配 |
| P.5 | 持久化 | 切换后写入 Firestore `user:preferences`，下次打开保持上次的选择 |
| P.6 | 安全场景覆盖 | 不管什么性格模式，安全警报时**统一切到严肃语气**。警报解除后恢复原性格 |

---

## 二、交互方式完整清单

### 交互 A：语音对话

| # | 标准 | 质量要求 |
|---|------|---------|
| A.1 | 基础对话 | 用户说任何话 → AI < 2s 内语音回复。对话自然流畅，不卡顿 |
| A.2 | 语音指令清单 | 支持的指令（AI 必须识别并执行）：<br>"帮我制定训练计划" → 触发 workflow<br>"今天练什么" → 触发 workflow<br>"开始训练" → 切到 training 模式<br>"查看我的身体状态" → 切到 dashboard<br>"看看卧推的历史" → 查询 + 曲线图<br>"切换到嘲讽模式" → 性格切换<br>"进入展示模式" → showcase<br>"结束训练" → 训练完成流程 |
| A.3 | 打断处理 | 用户说话时 AI 正在说话 → AI 立刻停止当前语音，听用户说完，再回复 |
| A.4 | 静音/空白处理 | 用户 30s 内没说话 → AI 不主动打扰（除非在 training 模式组间休息到时） |

### 交互 B：文本输入

| # | 标准 | 质量要求 |
|---|------|---------|
| B.1 | 输入框位置 | 底部居中，pill 形状，半透明背景，不遮挡摄像头核心区域 |
| B.2 | 发送方式 | 回车发送，发送后清空输入框，focus 保持 |
| B.3 | AI 回复 | 文本输入的效果和语音完全一致——AI 既语音回复也执行工具。侧边栏显示对话记录 |
| B.4 | 对话历史 | 侧边栏 idle 模式或底部区域显示最近 N 条对话（用户 + AI 的文字转录） |

### 交互 C：鼠标/触摸 UI 操作

| # | 标准 | 质量要求 |
|---|------|---------|
| C.1 | 侧边栏模式切换 | ControlBar 按钮点击 → 平滑切换页面（slide/fade 300ms）。当前模式按钮高亮 |
| C.2 | Dashboard 卡片展开 | 点击肌群卡片 → 原地展开详情（PR、热力图、曲线图）。其他卡片收缩。动画 spring easing 400ms |
| C.3 | 计划卡片交互 | 训练中点击某组 → 标记完成/未完成。点击动作名 → 展开组详情 |
| C.4 | 设置按钮 | 侧边栏有设置入口（齿轮图标），点击展开性格选择、紧急联系人输入、休息时间设置 |
| C.5 | 生成计划按钮 | Planning 空态有"生成训练计划"按钮，点击等于发送文本"帮我制定训练计划" |

### 交互 D：人体点位交互（摄像头画面上）

| # | 标准 | 质量要求 |
|---|------|---------|
| D.1 | 点击身体部位 | 用户在摄像头画面上点击某个位置 → 计算最近的 MediaPipe landmark → 匹配到肌群（胸/肩/背/腿/核心/臂） |
| D.2 | 视觉反馈 | 点击后该部位的 BodyCard 高亮脉冲（border glow 0.5s），同时侧边栏自动展开该部位的 Dashboard 卡片 |
| D.3 | AI 语音配合 | 点击胸部 → AI 说"你的胸肌上次练是3天前，卧推PR 110公斤，恢复状态良好。" 延迟 < 3s |
| D.4 | 点击精度 | 点击容差 50px（手指大小），如果两个部位距离太近，选择更近的那个。不会误触到空白区域 |
| D.5 | 无人体时 | 没有检测到人体时点击摄像头无反应（不报错，不弹窗） |

### 交互 E：手势 + Air Touch

#### E-1: 语义手势

| # | 标准 | 质量要求 |
|---|------|---------|
| E.1 | 竖拇指 | 表示确认/同意。AI 收到 [CV] gesture thumbs_up 后当作"yes/confirm" |
| E.2 | OK 手势 | 表示"done/good"。可用于确认组完成、确认计划 |
| E.3 | 手势识别延迟 | 手势做出 → AI 响应 < 1s |
| E.4 | 误识别防护 | 手势需保持 > 0.5s 才触发（防止路过手势误触发） |

#### E-2: Air Touch（食指指向 = 鼠标点击）

| # | 标准 | 质量要求 |
|---|------|---------|
| E.5 | 食指指向检测 | HandLandmarker 检测食指伸出（index finger extended）+ 其他手指收拢 → 判定为 "pointing" 手势。指尖坐标映射到屏幕坐标 |
| E.6 | 光标显示 | 食指指向时，屏幕上显示一个半透明圆形光标（类似触摸点），跟随指尖位置移动。光标有发光效果（`box-shadow`），颜色 `rgba(94,92,230,0.5)` |
| E.7 | 光标平滑 | 光标位置用 lerp 插值（0.3 factor），消除抖动。视觉效果流畅不跳变 |
| E.8 | Air Click 触发 | 食指指尖在同一位置停留 > 0.8s → 触发 "click"（光标缩小脉冲动画 → 触发该位置的 click 事件）。或者：食指向前"戳"一下（z 轴位移检测）→ instant click |
| E.9 | 点击反馈 | click 触发时：光标爆开涟漪动画（ripple effect 300ms） + 轻微震动反馈（如果设备支持 Vibration API） |
| E.10 | 可交互元素 | Air touch 可以点击的元素：Side Button、BodyCard（摄像头上的浮动卡片）、侧边栏按钮。和鼠标点击行为完全一致 |

#### E-3: Side Button（主屏幕快捷按钮）

| # | 标准 | 质量要求 |
|---|------|---------|
| E.11 | 位置 | 摄像头画面右侧边缘中间，半圆形或箭头形状，常驻显示（不随模式变化）。尺寸 48×96px，足够被 air touch 或鼠标点击 |
| E.12 | 视觉设计 | 毛玻璃材质 + 微发光边框，有"可交互"的视觉暗示（轻微脉冲或呼吸灯）。图标：`›` 或 hamburger |
| E.13 | 点击/Air Touch 展开 | 点击 → 侧边栏从右侧横向滑出（slide-in 300ms spring easing）。再次点击或点击其他区域 → 收回 |
| E.14 | 展开内容 | 展开的就是现有的侧边栏（Dashboard/Planning/Training/Posture），不是新页面 |
| E.15 | Air Touch 交互 | 用户在摄像头画面中伸出食指 → 光标出现 → 指向 Side Button → 停留 0.8s → 侧边栏展开。和鼠标点击行为完全一致 |
| E.16 | 收起后画面最大化 | 侧边栏收起时摄像头画面占满全屏（含骨骼渲染 + BodyCard），最大化训练视野 |

---

## 三、UI 页面完整验收

### 页面 1：Idle（待机/欢迎）

| # | 标准 | 质量要求 |
|---|------|---------|
| I.1 | Welcome message | "Welcome back" + last training summary. First-time: "Hey, I'm MuscleClaw, your AI fitness coach." |
| I.2 | Quick action buttons | 3-4 shortcut buttons: Create Plan / Start Training / View History / Posture Scan |
| I.3 | 对话历史 | 最近 5 条对话记录（用户 + AI），可滚动 |
| I.4 | 连接状态 | 顶部显示 AI 状态（Online/Offline/Reconnecting），绿色圆点呼吸灯 |
| I.5 | Empty state (first time) | No training history → show guide: "Say 'create a training plan' to start your first workout" |

### 页面 2：Dashboard（训练仪表盘）

| # | 标准 | 质量要求 |
|---|------|---------|
| D.1 | AI Radar recommendation | Top purple gradient card showing today's AI recommendation ("Today: Chest + Back") + reason summary. Shimmer animation |
| D.2 | 6 个肌群卡片（收缩态） | 白卡 + 柔和阴影，左侧活力环（SVG 圆环，颜色按恢复百分比：绿/橙/红），部位名 16px 粗体，代表动作 + 最大重量，恢复 badge（READY / Xh left） |
| D.3 | 活力环动画 | 页面加载时环形从 0% 填充到当前值，800ms spring easing。100% 时环发光脉冲 |
| D.4 | 肌群卡片（展开态） | 点击展开显示：PR Records（动作+重量+日期）、Training Log 30天热力图、Form Quality（ROM/对称性）。展开动画 spring 400ms |
| D.5 | 整体训练日历 | 底部卡片：30天热力图 + 本月次数 + 连续天数 + 最长记录 |
| D.6 | Start training button | Bottom fixed, purple gradient, "Start Today's Training — Chest + Back", hover scale 1.02 |

### 页面 3：Planning（训练计划）

| # | 标准 | 质量要求 |
|---|------|---------|
| PL.1 | 有计划态 | 顶部标题"Today's Plan"，部位 tags，每个动作一张卡片（动作名、目标组×次×重量、进度条） |
| PL.2 | 空态 | "说 '帮我制定训练计划' 或点击下方按钮" + 生成按钮 |
| PL.3 | 工作流进度态 | SequentialAgent 执行中显示 3 步进度（分析→推荐→生成），当前步骤高亮 |
| PL.4 | 计划卡片动画 | stagger 入场（每张卡片间隔 0.1s），spring easing 弹入 |
| PL.5 | 开始训练按钮 | 有计划时底部显示"开始训练"按钮 |

### 页面 4：Training（训练中）

| # | 标准 | 质量要求 |
|---|------|---------|
| T.1 | 当前动作卡 | 大字显示当前动作名 + 目标重量，下方是组数进度（如 "第2组 / 共4组"） |
| T.2 | 实时 rep 计数器 | 大号数字（28px+）显示当前组的 rep 数，每次 +1 有弹跳动画 |
| T.3 | 组完成列表 | 已完成的组显示 ✓ + 实际重量 × 实际次数。未完成的灰色 |
| T.4 | 休息倒计时 | 组间休息时显示圆形倒计时环 + 数字 |
| T.5 | Session Metrics | 训练总时长、已完成组数、总容量（实时更新） |
| T.6 | 下一动作预览 | 当前动作全部组完成后，显示"下一个: 划船 4×8 75kg" |

### 页面 5：Posture（体态评估）

| # | 标准 | 质量要求 |
|---|------|---------|
| PS.1 | 引导态 | "面对摄像头站直，保持自然姿势 3 秒" + 倒计时 |
| PS.2 | 评估结果 | 整体评分（良好/需注意/建议就医），SVG 弧形仪表盘 |
| PS.3 | 问题卡片 | 每个检测到的问题一张卡片：类型 + 严重度 + 具体度数 + 改善建议 |
| PS.4 | AI 语音解读 | "你有轻微的圆肩，右肩比左肩高 5 度。建议多做面拉和外旋。" |

---

## 四、系统级场景

### S1：首次使用（Onboarding）

| # | 标准 | 质量要求 |
|---|------|---------|
| S1.1 | 摄像头权限请求 | 浏览器弹出权限提示前，页面显示"需要摄像头来识别你的动作"说明文字 |
| S1.2 | 麦克风权限请求 | 同上 |
| S1.3 | AI 欢迎语 | 权限获取后 AI 说："你好，我是 MuscleClaw，你的 AI 健身教练。我可以帮你制定训练计划、实时纠正动作、追踪进度。先告诉我，你今天想练什么？" |
| S1.4 | 默认数据 | body_profile 使用 DEFAULT_BODY_PROFILE（6 部位全部 recovered，重量为 0），不是空 |
| S1.5 | 空数据引导 | Dashboard 卡片显示 "— kg"（无历史），提示"完成第一次训练后这里会显示你的数据" |

### S2：断线重连

| # | 标准 | 质量要求 |
|---|------|---------|
| S2.1 | 断线检测 | WebSocket 断开 < 1s 内检测到，状态切为 "Reconnecting..." |
| S2.2 | 自动重连 | 最多 3 次，间隔 2s/4s/8s（指数退避）。重连期间显示"正在重新连接..." |
| S2.3 | 重连成功 | 状态恢复为 "Online"，AI 不重复说之前的话，从断点继续 |
| S2.4 | 重连失败 | 3 次都失败 → 显示"连接失败，请刷新页面重试"按钮。不显示英文错误 |
| S2.5 | 训练中断线 | 当前训练进度不丢失（已在 Firestore），重连后继续 |

### S3：错误处理

| # | 标准 | 质量要求 |
|---|------|---------|
| S3.1 | API 错误 | Gemini API 报错 → 中文提示"AI 服务暂时不可用，请稍后重试"，不显示 1007/1008 代码 |
| S3.2 | 工具执行失败 | 某个工具报错 → AI 语音说"抱歉，这个操作出了点问题，我再试一次"，自动重试 1 次 |
| S3.3 | CV 引擎初始化失败 | MediaPipe 加载失败 → 页面仍可用（语音+文本），摄像头画面正常但无骨骼渲染，提示"动作识别模块加载中" |
| S3.4 | 麦克风被拒绝 | 用户拒绝麦克风权限 → 仅文本模式可用，提示"授予麦克风权限以使用语音功能" |

### S4：偏好设置

| # | 标准 | 质量要求 |
|---|------|---------|
| S4.1 | 设置入口 | 侧边栏齿轮图标，点击展开设置面板（overlay 或侧滑） |
| S4.2 | 可设置项 | 性格模式（3选1）、紧急联系人（电话号码输入）、组间休息时间（slider 30-300s）、安全灵敏度（高/中/低） |
| S4.3 | 语音设置 | 用户说"把休息时间改成90秒"/"设置紧急联系人139xxxxxxxx" → AI 调用 update_user_preferences |
| S4.4 | 即时生效 | 任何设置变更立刻生效（不需要重启/刷新） |
| S4.5 | 持久化 | 所有设置写入 Firestore `user:preferences`，跨会话保持 |

---

## 五、场景 1-5（与之前相同，此处省略重复内容）

（见上方场景 1-5 的完整验收标准）

---

## 六、跨场景质量标准

### 语音质量

| 标准 | 要求 |
|------|------|
| Language | 100% English. No Chinese, German, or other languages. All UI labels, AI voice output, and text transcripts in English |
| No duplicate audio | Never play the same sentence twice (no dual-channel overlap bug) |
| Latency | User finishes speaking → AI first audio byte < 2s |
| Naturalness | Like a real human conversation — with pauses, breathing, intonation. Not a monotone text-to-speech readout |
| Personality consistency | Maintain the same personality_mode throughout the session. No random switches (unless user explicitly changes or safety scenario triggers) |
| trash_talk quality | **Every roast must be unique** (no repeating the same joke in a session). Every roast MUST be followed by professional coaching. Comedy comes from contrast and surprise. Tone like a gym bro, never like a bully |

### UI 质量

| 标准 | 要求 |
|------|------|
| 过渡动画 | 所有页面/组件切换必须有动画（fade/slide/spring），禁止硬切 |
| 加载状态 | 任何 > 1s 的操作必须有 loading 指示（骨架屏/spinner/进度条） |
| Error states | Error messages in English, specific and actionable ("Connection lost, reconnecting..."). No raw API error codes |
| 配色一致 | Apple Fitness+ Light 主题：侧边栏不透明白底 `#F2F2F7`，卡片纯白 `#FFFFFF` + 柔和阴影 |
| 字号可读 | 最小字号 11px，重要数据 ≥ 14px，标题 ≥ 16px |
| 响应式 | 侧边栏 360-420px 宽度内自适应，不出现横向滚动条 |

### 数据质量

| 标准 | 要求 |
|------|------|
| AI 引用数据 | AI 语音中提到的任何数字必须来自 Firestore 真实数据，禁止编造 |
| 持久化 | 所有训练记录、偏好变更、体态报告必须持久化到 Firestore，刷新不丢失 |
| 一致性 | 侧边栏显示的数据 = AI 语音提到的数据 = Firestore 存储的数据，三者一致 |

---

## 七、MECE 检查清单

| 维度 | 覆盖项 | 状态 |
|------|--------|------|
| **场景** | 身体扫描、计划生成、训练模式、训练完成、展示模式 | ✓ 5/5 |
| **UI 页面** | Idle、Dashboard、Planning、Training、Posture | ✓ 5/5 |
| **交互方式** | 语音、文本、鼠标/触摸、人体点位、手势 | ✓ 5/5 |
| **AI 性格** | trash_talk、gentle、professional + 切换机制 | ✓ 3+1 |
| **系统级** | 首次使用、断线重连、错误处理、偏好设置 | ✓ 4/4 |
| **跨场景** | 语音质量、UI 质量、数据质量 | ✓ 3/3 |

---

## 八、优先级

全部要求都要符合验收

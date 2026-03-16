"""MuscleClaw ADK Agent — SequentialAgent workflow architecture."""
import json
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent, SequentialAgent
from google.adk.tools.tool_context import ToolContext

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ══════════════════════════════════════════════════════════════════
# TOOLS — shared across agents (each agent only gets what it needs)
# ══════════════════════════════════════════════════════════════════

def get_body_profile(ctx: ToolContext) -> dict:
    """获取用户六大身体部位的力量数据和恢复状态。"""
    return ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)


def update_body_profile(ctx: ToolContext, part: str, max_weight: float = 0,
                        last_trained: str = "", notes: str = "") -> str:
    """更新某个身体部位的数据。part: chest|shoulders|back|legs|core|arms"""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE.copy())
    if part not in profile:
        return f"未知部位: {part}"
    if max_weight > 0 and max_weight > profile[part].get("max_weight", 0):
        profile[part]["max_weight"] = max_weight
    if last_trained:
        profile[part]["last_trained"] = last_trained
        profile[part]["recovery_status"] = "recovering"
    if notes:
        profile[part]["notes"] = notes
    ctx.session.state["user:body_profile"] = profile
    return f"已更新 {part}: max_weight={profile[part]['max_weight']}kg"


def get_training_history(ctx: ToolContext, days: int = 30, exercise_id: str = "") -> dict:
    """获取最近N天训练记录。exercise_id留空则返回全部。"""
    history = ctx.session.state.get("user:training_history", [])
    if exercise_id:
        filtered = []
        for session in history:
            matching = [e for e in session.get("exercises", []) if e["exercise_id"] == exercise_id]
            if matching:
                filtered.append({**session, "exercises": matching})
        history = filtered
    return {"sessions": history[-50:], "total": len(history)}


def record_training_set(ctx: ToolContext, exercise_id: str, set_number: int,
                        reps: int, weight: float, rpe: float = 0,
                        rom_avg_degrees: float = 0,
                        symmetry_score: float = 0) -> str:
    """记录一组训练数据。"""
    history = ctx.session.state.get("user:training_history", [])
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

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
        "rpe": rpe or None, "rom_avg_degrees": rom_avg_degrees or None,
        "symmetry_score": symmetry_score or None,
    })
    ctx.session.state["user:training_history"] = history

    ex_name = EXERCISE_LIBRARY.get(exercise_id, {}).get("name", exercise_id)
    return f"已记录: {ex_name} 第{set_number}组 {weight}kg×{reps}"


def generate_training_plan(ctx: ToolContext, target_parts: str = "") -> dict:
    """基于身体档案生成训练计划。target_parts: 逗号分隔的部位如'chest,shoulders'。留空则自动推荐已恢复部位。"""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)

    parts = [p.strip() for p in target_parts.split(",") if p.strip()] if target_parts else []
    if not parts:
        parts = [p for p, d in profile.items() if d["recovery_status"] == "recovered"]
        if not parts:
            parts = ["chest", "back"]

    exercises = []
    for part in parts:
        ex_id = profile.get(part, {}).get("exercise", "bench_press")
        max_w = profile.get(part, {}).get("max_weight", 0)
        target_w = round(max_w * 0.85, 1) if max_w > 0 else 20
        ex_info = EXERCISE_LIBRARY.get(ex_id, {})
        exercises.append({
            "exercise_id": ex_id,
            "name": ex_info.get("name", ex_id),
            "name_en": ex_info.get("name_en", ""),
            "primary_muscles": ex_info.get("primary_muscles", [part]),
            "secondary_muscles": ex_info.get("secondary_muscles", []),
            "target_sets": 4,
            "target_reps": 6,
            "target_weight": target_w,
            "completed_sets": 0,
        })

    plan = {"target_parts": parts, "exercises": exercises}
    ctx.session.state["current_plan"] = plan
    return plan


def trigger_safety_alert(ctx: ToolContext, alert_type: str, countdown_seconds: int = 10) -> str:
    """触发安全警报。alert_type: barbell_stall|body_collapse|unresponsive"""
    ctx.session.state["safety_alert_active"] = True
    ctx.session.state["safety_countdown"] = countdown_seconds
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    contact = prefs.get("emergency_contact", "")
    if not contact:
        return f"安全警报已触发({alert_type})，{countdown_seconds}秒倒计时。注意：未设置紧急联系人！"
    return f"安全警报已触发({alert_type})，{countdown_seconds}秒后拨打 {contact}"


def cancel_safety_alert(ctx: ToolContext) -> str:
    """取消安全警报。"""
    ctx.session.state["safety_alert_active"] = False
    return "安全警报已取消"


def get_user_preferences(ctx: ToolContext) -> dict:
    """获取用户偏好设置。"""
    return ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)


def update_user_preferences(ctx: ToolContext, personality_mode: str = "",
                            language: str = "",
                            emergency_contact: str = "",
                            rest_timer_seconds: int = 0,
                            safety_sensitivity: str = "") -> str:
    """更新用户偏好。只传需要修改的字段。personality_mode: professional|gentle|trash_talk"""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES.copy())
    updated = []
    if personality_mode:
        prefs["personality_mode"] = personality_mode
        prefs["voice_name"] = VOICE_MAP.get(personality_mode, "Charon")
        updated.append("personality_mode")
    if language:
        prefs["language"] = language
        updated.append("language")
    if emergency_contact:
        prefs["emergency_contact"] = emergency_contact
        updated.append("emergency_contact")
    if rest_timer_seconds > 0:
        prefs["rest_timer_seconds"] = rest_timer_seconds
        updated.append("rest_timer_seconds")
    if safety_sensitivity:
        prefs["safety_sensitivity"] = safety_sensitivity
        updated.append("safety_sensitivity")
    ctx.session.state["user:preferences"] = prefs
    return f"偏好已更新: {updated}" if updated else "没有需要更新的字段"


def get_exercise_info(ctx: ToolContext, exercise_id: str) -> dict:
    """获取动作定义（关节追踪、角度阈值、安全规则）。"""
    return EXERCISE_LIBRARY.get(exercise_id, {"error": f"未知动作: {exercise_id}"})


def analyze_posture(ctx: ToolContext, shoulder_tilt_degrees: float = 0,
                    pelvis_tilt_degrees: float = 0,
                    spine_curvature: str = "",
                    head_forward_cm: float = 0,
                    notes: str = "") -> dict:
    """分析用户体态并生成报告。"""
    issues = []
    if abs(shoulder_tilt_degrees) > 3:
        side = "右" if shoulder_tilt_degrees > 0 else "左"
        issues.append({
            "type": "shoulder_imbalance",
            "severity": "warning" if abs(shoulder_tilt_degrees) < 8 else "concern",
            "detail": f"{side}肩偏高 {abs(shoulder_tilt_degrees):.1f}°",
        })
    if pelvis_tilt_degrees > 15:
        issues.append({
            "type": "anterior_pelvic_tilt",
            "severity": "warning" if pelvis_tilt_degrees < 25 else "concern",
            "detail": f"骨盆前倾 {pelvis_tilt_degrees:.1f}°",
        })
    if head_forward_cm > 3:
        issues.append({
            "type": "forward_head",
            "severity": "warning" if head_forward_cm < 6 else "concern",
            "detail": f"头部前移 {head_forward_cm:.1f}cm",
        })
    if spine_curvature:
        issues.append({
            "type": "scoliosis",
            "severity": "concern",
            "detail": f"脊柱侧弯: {spine_curvature}",
        })

    report = {
        "issues": issues,
        "issue_count": len(issues),
        "overall": "良好" if len(issues) == 0 else ("需注意" if len(issues) <= 2 else "建议就医检查"),
    }
    if notes:
        report["notes"] = notes
    ctx.session.state["user:posture_report"] = report
    return report


def send_ui_command(ctx: ToolContext, command: str, data_json: str = "") -> str:
    """发送 UI 指令给前端。
    command: show_body_panel|show_training_plan|show_posture_report|start_rest_timer|switch_mode
    data_json: JSON 格式的数据负载
    """
    parsed_data = {}
    if data_json:
        try:
            parsed_data = json.loads(data_json)
        except json.JSONDecodeError:
            return f"data_json 解析失败: {data_json}"
    ctx.session.state["temp:last_ui_command"] = {
        "command": command, "data": parsed_data,
    }
    return f"UI 指令已发送: {command}"


# ══════════════════════════════════════════════════════════════════
# WORKFLOW TOOLS — save tools for SequentialAgent steps
# ══════════════════════════════════════════════════════════════════

def save_plan_review(ctx: ToolContext, summary: str) -> str:
    """保存恢复状态分析结果。summary: 对每个部位恢复状态的文字描述。"""
    ctx.session.state["plan_review"] = summary
    ctx.session.state["temp:workflow_step"] = {"step": "review", "status": "done"}
    return "已保存分析结果"


def save_plan_recommendation(ctx: ToolContext, target_parts: str, reasoning: str) -> str:
    """保存用户确认的训练部位。target_parts: 逗号分隔如 'chest,back'。reasoning: 推荐原因。"""
    ctx.session.state["plan_recommendation"] = target_parts
    ctx.session.state["plan_reasoning"] = reasoning
    ctx.session.state["temp:workflow_step"] = {"step": "recommend", "status": "done"}
    return f"已确认训练部位: {target_parts}"


# ══════════════════════════════════════════════════════════════════
# SEQUENTIAL WORKFLOW — training plan generation
# ══════════════════════════════════════════════════════════════════

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

step_review = Agent(
    name="step_review",
    model=LIVE_MODEL,
    instruction="""你是训练状态分析师。你的任务是查看用户的身体恢复状态。

步骤（必须按顺序执行）：
1. 调用 get_body_profile 获取六个部位的恢复数据
2. 调用 get_training_history 获取最近7天训练记录
3. 用中文语音逐一汇报每个部位的状态（恢复百分比、上次训练时间、最大重量）
4. 调用 save_plan_review 保存你的分析摘要（一段文字总结所有部位状态）

语音风格：简洁专业，每个部位一句话。语言：必须使用中文。""",
    tools=[get_body_profile, get_training_history, save_plan_review],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

step_recommend = Agent(
    name="step_recommend",
    model=LIVE_MODEL,
    instruction="""你是训练规划顾问。基于上一步的分析，推荐今日训练部位。

你可以从 session state 中读取 plan_review 获取分析摘要。

步骤（必须按顺序执行）：
1. 语音说出你推荐的训练部位（选已恢复的部位）
2. 说明推荐原因（哪些已恢复、哪些是弱项需加强、哪些还在恢复中应避免）
3. 问用户："这样安排可以吗？想加或减什么部位？"
4. 等待用户语音回复
5. 根据用户回复调整推荐
6. 调用 save_plan_recommendation 保存确认的部位和原因

注意：必须等用户确认后才能完成。不要替用户做决定。
语言：必须使用中文。""",
    tools=[save_plan_recommendation],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

step_generate = Agent(
    name="step_generate",
    model=LIVE_MODEL,
    instruction="""你是训练计划生成专家。基于用户确认的部位，生成详细训练计划。

你可以从 session state 中读取：
- plan_recommendation: 确认的训练部位（逗号分隔）
- plan_reasoning: 推荐原因

步骤（必须按顺序执行）：
1. 调用 generate_training_plan 工具，target_parts 设为确认的部位
2. 语音解释每个动作的选择理由，包括：
   - 工作重量是PR的70-85%（渐进超负荷原则）
   - 为什么选这个组数和次数
   - 恢复时间的科学依据
3. 调用 send_ui_command，command设为"switch_mode"，data_json设为'{"mode":"planning"}'
4. 语音说："计划已生成，看看右边的面板。有什么要调整的吗？"

语言：必须使用中文。""",
    tools=[generate_training_plan, send_ui_command],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

training_plan_workflow = SequentialAgent(
    name="training_plan_workflow",
    description="多步骤训练计划生成工作流。先分析恢复状态，然后推荐训练部位并和用户确认，最后生成详细计划。当用户说'制定训练计划'或'今天练什么'时使用。",
    sub_agents=[step_review, step_recommend, step_generate],
)


# ══════════════════════════════════════════════════════════════════
# ROOT AGENT — general conversation + workflow delegation
# ══════════════════════════════════════════════════════════════════

SYSTEM_INSTRUCTION = """你是 MuscleClaw，一个像贾维斯一样的 AI 健身教练。

## 语言规则（最高优先级）
- 你必须始终使用中文（普通话）回复，包括语音输出
- 绝对不要使用英语、德语或其他外语回复
- 唯一例外：用户主动用英文对话时，可以用英文回复

## 训练计划工作流
当用户要求生成训练计划时（"帮我制定训练计划"、"今天练什么"、"制定xx计划"等），
你必须 transfer 到 training_plan_workflow。
不要自己尝试回答训练计划相关的问题，交给专门的工作流处理。
工作流会自动完成：分析恢复状态 → 推荐部位 → 和用户确认 → 生成计划。

## 核心能力
- 你能收到前端 CV 引擎的精确分析事件（标记为 [CV]）
- 你有持久记忆，记得用户的所有训练历史和身体数据

## 性格模式
根据用户偏好的 personality_mode 调整你的语气：
- "professional": 专业简洁，像私教一样给指令
- "gentle": 温柔鼓励，耐心引导
- "trash_talk": 搞笑嘲讽激将法！这是默认模式。你会说：
  - rep不算时："嗯嗯不算！手不够直你在逗我？"
  - 鼓励时："行啊兄弟！轻重量宝贝儿！"
  - 偷懒时："你是在休息还是在度假？"
  - 完成时："就这？行吧，勉强算你过关。"

## 对 CV 事件的响应规则
当你收到标记为 [CV] 的消息时：
- rep_complete: 报数，如果 ROM 不够就吐槽"不算！"
- form_issue: 立即语音纠正
- safety_alert: 立即切换到严肃模式，必要时触发 trigger_safety_alert
- gesture thumbs_up: 当作用户确认
- set_complete: 记录数据，开始休息计时

## 你必须做到
- 永远记住用户的训练数据和偏好（用 get/update 工具）
- 训练建议基于用户真实数据，不瞎编
- 安全永远第一优先级
- 语音要简短有力，像真人教练，不要长篇大论
- 当用户要求"制定训练计划"时，必须 transfer 到 training_plan_workflow
"""

root_agent = Agent(
    name="muscleclaw",
    model=LIVE_MODEL,
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_body_profile, update_body_profile,
        get_training_history, record_training_set,
        # generate_training_plan removed — only available in workflow
        trigger_safety_alert, cancel_safety_alert,
        get_user_preferences, update_user_preferences,
        get_exercise_info,
        analyze_posture, send_ui_command,
    ],
    sub_agents=[training_plan_workflow],
)

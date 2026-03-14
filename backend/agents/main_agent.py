"""MuscleClaw ADK Agent — Jarvis-like AI fitness coach."""
import json
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ── Tool Definitions ──────────────────────────────────────────────

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
        exercises.append({
            "exercise_id": ex_id, "target_sets": 4,
            "target_reps": 6, "target_weight": target_w, "completed": False,
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
    """分析用户体态并生成报告。传入 CV 引擎检测到的体态数据。
    shoulder_tilt_degrees: 肩部倾斜角度（正=右肩高）
    pelvis_tilt_degrees: 骨盆前倾角度
    spine_curvature: 脊柱侧弯描述如'left_5deg'
    head_forward_cm: 头部前移距离
    notes: 其他观察
    """
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

    # Store latest posture report
    ctx.session.state["user:posture_report"] = report
    return report


def send_ui_command(ctx: ToolContext, command: str, data_json: str = "") -> str:
    """发送 UI 指令给前端。
    command: show_body_panel|show_training_plan|show_posture_report|start_rest_timer|switch_mode
    data_json: JSON 格式的数据负载，如 '{"seconds": 120}' 或 '{"mode": "training"}'
    """
    parsed_data = {}
    if data_json:
        try:
            parsed_data = json.loads(data_json)
        except json.JSONDecodeError:
            return f"data_json 解析失败: {data_json}"

    # Store the command so app.py can detect it via function call inspection
    ctx.session.state["temp:last_ui_command"] = {
        "command": command,
        "data": parsed_data,
    }
    return f"UI 指令已发送: {command}"


# ── Sub-Agents ────────────────────────────────────────────────────

image_gen_agent = Agent(
    name="image_generator",
    model="gemini-3.1-flash-image-preview",  # Nano Banana 2
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
        analyze_posture, send_ui_command,
    ],
    # Note: sub_agents disabled in Live mode — they use non-Live models
    # and their transfer_to_agent tool declarations may cause "invalid argument"
    # errors with the Live API. Re-enable when using Vertex AI.
    # sub_agents=[image_gen_agent, analysis_agent],
)

# Minimal agent for debugging Live API connection issues
minimal_test_agent = Agent(
    name="test",
    model="gemini-2.5-flash-native-audio-preview-12-2025",
    instruction="You are a test agent. Respond briefly in Chinese.",
)

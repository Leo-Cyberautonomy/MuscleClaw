"""MuscleClaw ADK Agent — Single agent with direct WebSocket push.

All prompts and tool responses in English (Gemini competition requirement).
SequentialAgent abandoned: Live mode native audio model doesn't reliably
call task_completed(), causing workflow to get stuck. Instead, we use a
single agent with strong prompt constraints for step-by-step behavior,
and _push_to_frontend() for reliable data delivery.
"""
import json
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ══════════════════════════════════════════════════════════════════
# LIVE MODE PUSH HELPER
# ══════════════════════════════════════════════════════════════════

def _push_to_frontend(ctx: ToolContext, key: str, data):
    """Push state_sync to frontend AND persist to Firestore.

    In Live mode, event.actions.state_delta doesn't propagate tool state
    changes. So tools must:
    1. Push data directly to frontend via WebSocket
    2. Persist user: prefixed data directly to Firestore
    """
    import asyncio
    try:
        from app import WS_REGISTRY
        ws = WS_REGISTRY.get(ctx.session.id)
        if ws:
            loop = asyncio.get_event_loop()
            # 1. Push to frontend
            asyncio.run_coroutine_threadsafe(
                ws.send_json({"type": "state_sync", "key": key, "data": data}),
                loop,
            )
            # 2. Persist user: keys to Firestore
            if key.startswith("user:"):
                firestore_key = key[len("user:"):]  # strip prefix
                asyncio.run_coroutine_threadsafe(
                    _persist_user_state(ctx, firestore_key, data),
                    loop,
                )
    except Exception as e:
        print(f"[Push] Failed to push {key}: {e}")


async def _persist_user_state(ctx: ToolContext, key: str, value):
    """Write a single user-state key directly to Firestore."""
    try:
        from app import session_service
        ref = session_service._user_state_ref(ctx.session.app_name, ctx.session.user_id)
        await ref.set({key: value}, merge=True)
        print(f"[Firestore] Persisted user:{key}")
    except Exception as e:
        print(f"[Firestore] Failed to persist user:{key}: {e}")


# ══════════════════════════════════════════════════════════════════
# TOOLS
# ══════════════════════════════════════════════════════════════════

def get_body_profile(ctx: ToolContext) -> str:
    """Get user's 6 muscle group strength data and recovery status."""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    _push_to_frontend(ctx, "user:body_profile", profile)
    lines = []
    for part, data in profile.items():
        ex = data.get("exercise", "unknown")
        mw = data.get("max_weight", 0)
        status = data.get("recovery_status", "unknown")
        last = data.get("last_trained", "never")
        lines.append(f"{part}: {ex} PR {mw}kg, status={status}, last={last}")
    return "\n".join(lines)


def update_body_profile(ctx: ToolContext, part: str, max_weight: float = 0,
                        last_trained: str = "", notes: str = "") -> str:
    """Update a muscle group's data. part: chest|shoulders|back|legs|core|arms"""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE.copy())
    if part not in profile:
        return f"Unknown body part: {part}"
    if max_weight > 0 and max_weight > profile[part].get("max_weight", 0):
        profile[part]["max_weight"] = max_weight
    if last_trained:
        profile[part]["last_trained"] = last_trained
        profile[part]["recovery_status"] = "recovering"
    if notes:
        profile[part]["notes"] = notes
    ctx.session.state["user:body_profile"] = profile
    _push_to_frontend(ctx, "user:body_profile", profile)
    return f"Updated {part}: max_weight={profile[part]['max_weight']}kg"


def get_training_history(ctx: ToolContext, days: int = 30, exercise_id: str = "") -> str:
    """Get recent training records. exercise_id: filter by exercise."""
    history = ctx.session.state.get("user:training_history", [])
    if exercise_id:
        filtered = []
        for session in history:
            matching = [e for e in session.get("exercises", []) if e["exercise_id"] == exercise_id]
            if matching:
                filtered.append({**session, "exercises": matching})
        history = filtered
    if not history:
        return "No training history found."
    lines = [f"Found {len(history)} sessions:"]
    for s in history[-10:]:
        date = s.get("date", "?")
        for ex in s.get("exercises", []):
            eid = ex.get("exercise_id", "?")
            sets = ex.get("sets", [])
            max_w = max((st.get("weight", 0) for st in sets), default=0)
            lines.append(f"  {date}: {eid} {len(sets)} sets, max {max_w}kg")
    return "\n".join(lines)


def record_training_set(ctx: ToolContext, exercise_id: str, set_number: int,
                        reps: int, weight: float, rpe: float = 0,
                        rom_avg_degrees: float = 0,
                        symmetry_score: float = 0) -> str:
    """Record one training set."""
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
    _push_to_frontend(ctx, "user:training_history", history)
    ex_name = EXERCISE_LIBRARY.get(exercise_id, {}).get("name_en", exercise_id)
    return f"Recorded: {ex_name} set {set_number}, {weight}kg x {reps}"


def generate_training_plan(ctx: ToolContext, target_parts: str = "") -> str:
    """Generate training plan. target_parts: comma-separated like 'chest,back'. Empty = auto."""
    print(f"[TOOL] generate_training_plan called with target_parts='{target_parts}'")
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    parts = [p.strip() for p in target_parts.split(",") if p.strip()] if target_parts else []
    if not parts:
        parts = [p for p, d in profile.items() if d["recovery_status"] == "recovered"]
        if not parts:
            parts = ["chest", "back"]

    exercises = []
    lines = [f"Plan for: {', '.join(parts)}"]
    for part in parts:
        ex_id = profile.get(part, {}).get("exercise", "bench_press")
        max_w = profile.get(part, {}).get("max_weight", 0)
        target_w = round(max_w * 0.85, 1) if max_w > 0 else 20
        ex_info = EXERCISE_LIBRARY.get(ex_id, {})
        ex_name = ex_info.get("name_en", ex_id)
        exercises.append({
            "exercise_id": ex_id,
            "name": ex_info.get("name", ex_id),
            "name_en": ex_name,
            "primary_muscles": ex_info.get("primary_muscles", [part]),
            "secondary_muscles": ex_info.get("secondary_muscles", []),
            "target_sets": 4, "target_reps": 6,
            "target_weight": target_w, "completed_sets": 0,
        })
        lines.append(f"  {ex_name}: 4x6 @ {target_w}kg (85% of {max_w}kg PR)")

    plan = {"target_parts": parts, "exercises": exercises}
    ctx.session.state["current_plan"] = plan
    _push_to_frontend(ctx, "current_plan", plan)
    return "\n".join(lines)


def trigger_safety_alert(ctx: ToolContext, alert_type: str, countdown_seconds: int = 10) -> str:
    """Trigger safety alert. alert_type: barbell_stall|body_collapse|unresponsive"""
    ctx.session.state["safety_alert_active"] = True
    ctx.session.state["safety_countdown"] = countdown_seconds
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    contact = prefs.get("emergency_contact", "")
    _push_to_frontend(ctx, "ui_command", {
        "command": "show_safety_alert",
        "data": {"countdown_seconds": countdown_seconds},
    })
    if not contact:
        return f"SAFETY ALERT ({alert_type}), {countdown_seconds}s countdown. No emergency contact set!"
    return f"SAFETY ALERT ({alert_type}), calling {contact} in {countdown_seconds}s"


def cancel_safety_alert(ctx: ToolContext) -> str:
    """Cancel active safety alert."""
    ctx.session.state["safety_alert_active"] = False
    _push_to_frontend(ctx, "ui_command", {"command": "cancel_safety_alert", "data": {}})
    return "Safety alert cancelled."


def get_user_preferences(ctx: ToolContext) -> str:
    """Get user preferences."""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    return f"personality={prefs.get('personality_mode')}, voice={prefs.get('voice_name')}, contact={prefs.get('emergency_contact','none')}, rest={prefs.get('rest_timer_seconds',120)}s"


def update_user_preferences(ctx: ToolContext, personality_mode: str = "",
                            language: str = "", emergency_contact: str = "",
                            rest_timer_seconds: int = 0,
                            safety_sensitivity: str = "") -> str:
    """Update preferences. personality_mode: professional|gentle|trash_talk"""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES.copy())
    updated = []
    if personality_mode:
        prefs["personality_mode"] = personality_mode
        prefs["voice_name"] = VOICE_MAP.get(personality_mode, "Charon")
        updated.append(f"personality={personality_mode}")
    if language:
        prefs["language"] = language
        updated.append(f"language={language}")
    if emergency_contact:
        prefs["emergency_contact"] = emergency_contact
        updated.append("emergency_contact")
    if rest_timer_seconds > 0:
        prefs["rest_timer_seconds"] = rest_timer_seconds
        updated.append(f"rest={rest_timer_seconds}s")
    if safety_sensitivity:
        prefs["safety_sensitivity"] = safety_sensitivity
        updated.append(f"safety={safety_sensitivity}")
    ctx.session.state["user:preferences"] = prefs
    _push_to_frontend(ctx, "user:preferences", prefs)
    return f"Updated: {', '.join(updated)}" if updated else "No changes."


def get_exercise_info(ctx: ToolContext, exercise_id: str) -> str:
    """Get exercise definition."""
    info = EXERCISE_LIBRARY.get(exercise_id, None)
    if not info:
        return f"Unknown exercise: {exercise_id}"
    return f"{info.get('name_en', exercise_id)}: joints={info.get('tracked_joints')}, primary={info.get('primary_muscles')}"


def analyze_posture(ctx: ToolContext, shoulder_tilt_degrees: float = 0,
                    pelvis_tilt_degrees: float = 0, spine_curvature: str = "",
                    head_forward_cm: float = 0, notes: str = "") -> str:
    """Analyze user posture and generate report."""
    issues = []
    if abs(shoulder_tilt_degrees) > 3:
        side = "right" if shoulder_tilt_degrees > 0 else "left"
        issues.append(f"{side} shoulder elevated {abs(shoulder_tilt_degrees):.1f}°")
    if pelvis_tilt_degrees > 15:
        issues.append(f"anterior pelvic tilt {pelvis_tilt_degrees:.1f}°")
    if head_forward_cm > 3:
        issues.append(f"forward head {head_forward_cm:.1f}cm")
    if spine_curvature:
        issues.append(f"spinal curvature: {spine_curvature}")
    severity = "good" if not issues else ("needs attention" if len(issues) <= 2 else "consult specialist")
    report = {"issues": issues, "issue_count": len(issues), "overall": severity}
    if notes:
        report["notes"] = notes
    ctx.session.state["user:posture_report"] = report
    _push_to_frontend(ctx, "user:posture_report", report)
    if not issues:
        return "Posture: Good. No issues."
    return f"Posture: {severity}. {'; '.join(issues)}"


def send_ui_command(ctx: ToolContext, command: str, data_json: str = "") -> str:
    """Send UI command to frontend. command: switch_mode|start_rest_timer|show_safety_alert"""
    parsed_data = {}
    if data_json:
        try:
            parsed_data = json.loads(data_json)
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
    _push_to_frontend(ctx, "ui_command", {"command": command, "data": parsed_data})
    return f"UI command sent: {command}"


# ══════════════════════════════════════════════════════════════════
# ROOT AGENT
# ══════════════════════════════════════════════════════════════════

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

SYSTEM_INSTRUCTION = """You are MuscleClaw, a Jarvis-like AI fitness coach.

## Language (HIGHEST PRIORITY)
ALWAYS speak English. Never Chinese, German, or other languages.

## Training Plan (CRITICAL — always call the tool!)
When user asks for a training plan, you MUST:
1. Call get_body_profile to check recovery
2. Call generate_training_plan with the target parts
3. Call send_ui_command(command="switch_mode", data_json='{"mode":"planning"}')
4. Explain the plan briefly

IMPORTANT: You MUST call generate_training_plan. Do NOT just talk about what you would do — actually call the tool. The frontend needs the tool result to display the plan.

## Personality Modes

### trash_talk (DEFAULT — star of the show!)
Gym bro who roasts but gives great advice. Comedy through contrast.
- Arrival: "Oh look who decided to show up!"
- Rep count: "One! Two! Three! Wow you came prepared?"
- Bad ROM: "Nah that doesn't count! My grandma extends further reaching for the remote."
- Final reps: "Yeah buddy! Light weight baby! COME ON!"
- Too much rest: "Are you resting or on vacation?"
- Set done: "That's it? Fine, pass. Add weight next set."
- Safety: IMMEDIATELY serious: "HOLD UP! Are you okay?!"
- After safety cancel: "Don't scare me like that — who am I gonna train with?"
RULE: Every roast MUST be followed by actual coaching.

### gentle
Warm, encouraging. "Great form! Just extend a tiny bit more..."

### professional
Clinical. "Set 3 complete. Rest 120 seconds. Volume on track."

## CV Event Rules
[CV] rep_complete → count it, roast if ROM bad
[CV] form_issue → correct immediately
[CV] safety_alert → SERIOUS mode regardless of personality
[CV] gesture thumbs_up → treat as "yes/confirm"
[CV] set_complete → record data, start rest timer

## Core Rules
- Reference REAL data from tools, never invent numbers
- Safety is ALWAYS #1 — override personality for emergencies
- Keep voice SHORT and punchy, like a real coach
- Follow the Training Plan Protocol exactly when asked for a plan
"""

root_agent = Agent(
    name="muscleclaw",
    model=LIVE_MODEL,
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_body_profile, update_body_profile,
        get_training_history, record_training_set,
        generate_training_plan,
        trigger_safety_alert, cancel_safety_alert,
        get_user_preferences, update_user_preferences,
        get_exercise_info, analyze_posture, send_ui_command,
    ],
)

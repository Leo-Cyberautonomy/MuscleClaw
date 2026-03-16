"""MuscleClaw ADK Agent — SequentialAgent workflow architecture.

All prompts and tool responses in English (Gemini competition requirement).
"""
import json
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent, SequentialAgent
from google.adk.tools.tool_context import ToolContext

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ══════════════════════════════════════════════════════════════════
# LIVE MODE PUSH HELPER
# ══════════════════════════════════════════════════════════════════

def _push_to_frontend(ctx: ToolContext, key: str, data):
    """Push state_sync directly to frontend via WebSocket registry.

    In Live mode, event.actions.state_delta doesn't propagate tool state changes,
    so tools must push data directly through the WebSocket.
    """
    import asyncio
    try:
        from app import WS_REGISTRY
        ws = WS_REGISTRY.get(ctx.session.id)
        if ws:
            loop = asyncio.get_event_loop()
            asyncio.run_coroutine_threadsafe(
                ws.send_json({"type": "state_sync", "key": key, "data": data}),
                loop,
            )
    except Exception as e:
        print(f"[Push] Failed to push {key}: {e}")


# ══════════════════════════════════════════════════════════════════
# TOOLS
# ══════════════════════════════════════════════════════════════════

def get_body_profile(ctx: ToolContext) -> str:
    """Get user's 6 muscle group strength data and recovery status. Returns a human-readable summary."""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    _push_to_frontend(ctx, "user:body_profile", profile)
    lines = []
    for part, data in profile.items():
        ex = data.get("exercise", "unknown")
        mw = data.get("max_weight", 0)
        status = data.get("recovery_status", "unknown")
        last = data.get("last_trained", "never")
        rec_h = data.get("recovery_hours", 0)
        lines.append(f"{part}: {ex} PR {mw}kg, status={status}, last_trained={last}, recovery_hours={rec_h}")
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
    return f"Updated {part}: max_weight={profile[part]['max_weight']}kg"


def get_training_history(ctx: ToolContext, days: int = 30, exercise_id: str = "") -> str:
    """Get recent training records. Returns human-readable summary. exercise_id: filter by exercise."""
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
        exs = s.get("exercises", [])
        for ex in exs:
            eid = ex.get("exercise_id", "?")
            sets = ex.get("sets", [])
            max_w = max((st.get("weight", 0) for st in sets), default=0)
            total_reps = sum(st.get("reps", 0) for st in sets)
            lines.append(f"  {date}: {eid} - {len(sets)} sets, max {max_w}kg, total {total_reps} reps")
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

    ex_name = EXERCISE_LIBRARY.get(exercise_id, {}).get("name_en", exercise_id)
    return f"Recorded: {ex_name} set {set_number}, {weight}kg x {reps} reps"


def generate_training_plan(ctx: ToolContext, target_parts: str = "") -> str:
    """Generate a training plan based on body profile. target_parts: comma-separated like 'chest,back'. Leave empty for auto-recommendation."""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)

    parts = [p.strip() for p in target_parts.split(",") if p.strip()] if target_parts else []
    if not parts:
        parts = [p for p, d in profile.items() if d["recovery_status"] == "recovered"]
        if not parts:
            parts = ["chest", "back"]

    exercises = []
    lines = [f"Training plan for: {', '.join(parts)}"]
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
            "target_sets": 4,
            "target_reps": 6,
            "target_weight": target_w,
            "completed_sets": 0,
        })

    # Push plan directly to frontend via WebSocket registry
    # (Live mode state_delta doesn't propagate tool state changes)
    plan = {"target_parts": parts, "exercises": exercises}
    _push_to_frontend(ctx, "current_plan", plan)
        lines.append(f"  {ex_name}: 4 sets x 6 reps @ {target_w}kg (85% of {max_w}kg PR)")

    plan = {"target_parts": parts, "exercises": exercises}
    ctx.session.state["current_plan"] = plan
    return "\n".join(lines)


def trigger_safety_alert(ctx: ToolContext, alert_type: str, countdown_seconds: int = 10) -> str:
    """Trigger safety alert. alert_type: barbell_stall|body_collapse|unresponsive"""
    ctx.session.state["safety_alert_active"] = True
    ctx.session.state["safety_countdown"] = countdown_seconds
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    contact = prefs.get("emergency_contact", "")
    if not contact:
        return f"SAFETY ALERT triggered ({alert_type}), {countdown_seconds}s countdown. WARNING: No emergency contact set!"
    return f"SAFETY ALERT triggered ({alert_type}), calling {contact} in {countdown_seconds}s"


def cancel_safety_alert(ctx: ToolContext) -> str:
    """Cancel active safety alert."""
    ctx.session.state["safety_alert_active"] = False
    return "Safety alert cancelled."


def get_user_preferences(ctx: ToolContext) -> str:
    """Get user preferences (personality, language, emergency contact, etc.)."""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES)
    return f"personality={prefs.get('personality_mode')}, voice={prefs.get('voice_name')}, contact={prefs.get('emergency_contact','none')}, rest={prefs.get('rest_timer_seconds',120)}s"


def update_user_preferences(ctx: ToolContext, personality_mode: str = "",
                            language: str = "",
                            emergency_contact: str = "",
                            rest_timer_seconds: int = 0,
                            safety_sensitivity: str = "") -> str:
    """Update user preferences. Only pass fields you want to change. personality_mode: professional|gentle|trash_talk"""
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
        updated.append(f"rest_timer={rest_timer_seconds}s")
    if safety_sensitivity:
        prefs["safety_sensitivity"] = safety_sensitivity
        updated.append(f"safety={safety_sensitivity}")
    ctx.session.state["user:preferences"] = prefs
    return f"Preferences updated: {', '.join(updated)}" if updated else "No changes."


def get_exercise_info(ctx: ToolContext, exercise_id: str) -> str:
    """Get exercise definition (joints, angle thresholds, safety rules)."""
    info = EXERCISE_LIBRARY.get(exercise_id, None)
    if not info:
        return f"Unknown exercise: {exercise_id}"
    return f"{info.get('name_en', exercise_id)}: joints={info.get('tracked_joints')}, ROM={info.get('rom_threshold')}, primary={info.get('primary_muscles')}"


def analyze_posture(ctx: ToolContext, shoulder_tilt_degrees: float = 0,
                    pelvis_tilt_degrees: float = 0,
                    spine_curvature: str = "",
                    head_forward_cm: float = 0,
                    notes: str = "") -> str:
    """Analyze user posture and generate report."""
    issues = []
    if abs(shoulder_tilt_degrees) > 3:
        side = "right" if shoulder_tilt_degrees > 0 else "left"
        issues.append(f"{side} shoulder elevated {abs(shoulder_tilt_degrees):.1f} degrees")
    if pelvis_tilt_degrees > 15:
        issues.append(f"anterior pelvic tilt {pelvis_tilt_degrees:.1f} degrees")
    if head_forward_cm > 3:
        issues.append(f"forward head posture {head_forward_cm:.1f}cm")
    if spine_curvature:
        issues.append(f"spinal curvature: {spine_curvature}")

    severity = "good" if not issues else ("needs attention" if len(issues) <= 2 else "consult a specialist")
    report = {
        "issues": issues,
        "issue_count": len(issues),
        "overall": severity,
    }
    if notes:
        report["notes"] = notes
    ctx.session.state["user:posture_report"] = report
    _push_to_frontend(ctx, "user:posture_report", report)

    if not issues:
        return "Posture analysis: Good. No significant issues detected."
    return f"Posture analysis: {severity}. Issues found: {'; '.join(issues)}"


def send_ui_command(ctx: ToolContext, command: str, data_json: str = "") -> str:
    """Send UI command to frontend.
    command: switch_mode|show_body_panel|start_rest_timer
    data_json: JSON payload like '{"mode": "dashboard"}' or '{"seconds": 120}'
    """
    parsed_data = {}
    if data_json:
        try:
            parsed_data = json.loads(data_json)
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
    ctx.session.state["temp:last_ui_command"] = {
        "command": command, "data": parsed_data,
    }
    _push_to_frontend(ctx, "ui_command", {"command": command, "data": parsed_data})
    return f"UI command sent: {command}"


# ══════════════════════════════════════════════════════════════════
# WORKFLOW TOOLS — save tools for SequentialAgent steps
# ══════════════════════════════════════════════════════════════════

def save_plan_review(ctx: ToolContext, summary: str) -> str:
    """Save the recovery analysis summary. summary: text describing each body part's recovery status."""
    ctx.session.state["plan_review"] = summary
    ctx.session.state["temp:workflow_step"] = {"step": "review", "status": "done"}
    return "Recovery analysis saved."


def save_plan_recommendation(ctx: ToolContext, target_parts: str, reasoning: str) -> str:
    """Save user-confirmed training parts. target_parts: comma-separated like 'chest,back'. reasoning: why these parts."""
    ctx.session.state["plan_recommendation"] = target_parts
    ctx.session.state["plan_reasoning"] = reasoning
    ctx.session.state["temp:workflow_step"] = {"step": "recommend", "status": "done"}
    return f"Confirmed target parts: {target_parts}"


# ══════════════════════════════════════════════════════════════════
# SEQUENTIAL WORKFLOW — training plan generation
# ══════════════════════════════════════════════════════════════════

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

step_review = Agent(
    name="step_review",
    model=LIVE_MODEL,
    instruction="""You are a Recovery Analyst. Your job is to check the user's body recovery status and report it conversationally.

Steps (execute in order):
1. Call send_ui_command with command="switch_mode" and data_json='{"mode":"dashboard"}' to show the dashboard.
2. Say: "Let me check your recovery status..."
3. Call get_body_profile to read all 6 muscle groups.
4. Call get_training_history to see recent sessions.
5. Summarize recovery status NATURALLY in conversation — DO NOT read raw data. Example:
   "Your chest is fully recovered from 3 days ago, good to go. Back hasn't been trained in 5 days, definitely ready. Shoulders were hit yesterday, still recovering — I'd skip those today."
   Keep it casual and conversational, like talking to a friend. Mention only the important parts, skip obvious ones.
6. Call save_plan_review with a text summary of all parts.

IMPORTANT: Speak in English only. Be concise — max 3-4 sentences total. Do NOT list every field from the data.""",
    tools=[get_body_profile, get_training_history, save_plan_review, send_ui_command],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

step_recommend = Agent(
    name="step_recommend",
    model=LIVE_MODEL,
    instruction="""You are a Training Advisor. Based on the previous recovery analysis, recommend today's muscle groups.

You can read session state key "plan_review" for the analysis summary.

Steps:
1. Recommend which muscle groups to train today, and explain WHY:
   - Which parts are recovered and ready
   - Which parts are weak points that need extra work
   - Which parts are still recovering and should be avoided
   Example: "Based on your recovery, I recommend chest and back today. Chest has fully recovered and is in the supercompensation window. Back is your relative weak point, so extra work will help balance your physique."
2. Ask the user: "Does that sound good? Want to add or swap anything?"
3. WAIT for the user to respond via voice. Do NOT proceed without confirmation.
4. After user confirms (or adjusts), call save_plan_recommendation with the final parts.

IMPORTANT: You MUST wait for user input before completing. Do not decide for the user.
Language: English only.""",
    tools=[save_plan_recommendation],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

step_generate = Agent(
    name="step_generate",
    model=LIVE_MODEL,
    instruction="""You are a Training Plan Generator. Create a detailed plan based on user-confirmed muscle groups.

Read from session state:
- "plan_recommendation": confirmed target parts (comma-separated)
- "plan_reasoning": why these parts were chosen

Steps:
1. Call get_body_profile to get each part's PR weights.
2. Call get_training_history to check recent performance trends.
3. Call generate_training_plan with the confirmed target_parts.
4. Explain your plan with scientific rationale. Example:
   "Looking at your history, your bench press has been progressing nicely — 100, 105, 110kg over the last 3 sessions. Following progressive overload, today we'll work at 85% of your PR, so 93kg for 4 sets of 6. This targets the hypertrophy-strength sweet spot while keeping volume manageable."
   Reference REAL numbers from the data. Mention at least one training principle (progressive overload, volume landmarks, RPE, recovery window).
5. Call send_ui_command with command="switch_mode" and data_json='{"mode":"planning"}' to show the plan.
6. Say: "Your plan is ready — check the panel on the right. Want to adjust anything?"

Language: English only. Sound like an expert coach, not a textbook.""",
    tools=[generate_training_plan, get_body_profile, get_training_history, send_ui_command],
    disallow_transfer_to_parent=True,
    disallow_transfer_to_peers=True,
)

training_plan_workflow = SequentialAgent(
    name="training_plan_workflow",
    description="Multi-step training plan generation workflow. Analyzes recovery, recommends muscle groups with user confirmation, then generates a detailed plan with scientific rationale. Use when user says 'create a training plan', 'what should I train today', etc.",
    sub_agents=[step_review, step_recommend, step_generate],
)


# ══════════════════════════════════════════════════════════════════
# ROOT AGENT — general conversation + workflow delegation
# ══════════════════════════════════════════════════════════════════

SYSTEM_INSTRUCTION = """You are MuscleClaw, a Jarvis-like AI fitness coach with personality.

## Language (HIGHEST PRIORITY)
- ALWAYS speak English. Never use Chinese, German, or any other language.
- All voice output must be in English.

## Training Plan Workflow
When the user asks to create a training plan ("create a training plan", "what should I train today", "make me a chest plan", etc.),
you MUST transfer to training_plan_workflow.
Do NOT try to generate plans yourself — the workflow handles it automatically:
analyze recovery → recommend parts → get user confirmation → generate plan.

## Personality Modes
Adjust your tone based on personality_mode preference:

### trash_talk (DEFAULT — this is the star of the show!)
You're like that gym bro who roasts everyone but gives the best advice. Comedy through contrast.
- When they show up: "Oh look who decided to grace us with their presence!"
- Rep counting: "One! Two! Three! Wow, you actually came prepared today?"
- ROM too short: "Nah nah nah, that doesn't count! My grandma extends further reaching for the remote."
- Final reps: "Yeah buddy! Light weight baby! COME ON!"
- Resting too long: "Are you resting or on vacation? Should I book you a flight?"
- Set done: "That's it? Fine, I'll give you a pass. Add some weight next set."
- Safety alert: IMMEDIATELY switch to serious: "HOLD UP! Are you okay?!"
- After safety cancel: "Alright you scared me. Don't do that again — if you die who am I gonna train with?"
RULE: Every roast MUST be followed by actual coaching advice. Never just mock.

### gentle
Warm, encouraging, patient. "Great form! Just extend a tiny bit more... perfect!"

### professional
Clinical, data-driven. "Set 3 complete. Rest 120 seconds. Volume on track."

## CV Event Rules
When you receive messages tagged [CV]:
- rep_complete: count it, roast if ROM was bad
- form_issue: correct immediately ("Left arm is dropping, raise it up!")
- safety_alert: switch to SERIOUS mode regardless of personality
- gesture thumbs_up: treat as "yes/confirm"
- set_complete: record data, start rest timer

## Core Rules
- Always reference REAL user data from tools, never make up numbers
- Safety is ALWAYS #1 priority — override personality for emergencies
- Keep voice responses SHORT and punchy, like a real coach
- When user asks for a training plan, ALWAYS transfer to training_plan_workflow
"""

root_agent = Agent(
    name="muscleclaw",
    model=LIVE_MODEL,
    instruction=SYSTEM_INSTRUCTION,
    tools=[
        get_body_profile, update_body_profile,
        get_training_history, record_training_set,
        # generate_training_plan removed — only in workflow
        trigger_safety_alert, cancel_safety_alert,
        get_user_preferences, update_user_preferences,
        get_exercise_info,
        analyze_posture, send_ui_command,
    ],
    sub_agents=[training_plan_workflow],
)

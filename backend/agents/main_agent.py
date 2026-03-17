"""MuscleClaw ADK Agent — 6 domain-grouped tools.

Architecture: LLM (ToolRouter) generates data → Tools validate + persist.
Google ADK best practice: ≤10 tools, each covers a data domain.
"""
import json
import os
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from config.defaults import DEFAULT_BODY_PROFILE, DEFAULT_PREFERENCES, VOICE_MAP
from config.exercise_library import EXERCISE_LIBRARY


# ══════════════════════════════════════════════════════════════════
# LIVE MODE PUSH HELPER
# ══════════════════════════════════════════════════════════════════

def _push_to_frontend(ctx, key: str, data):
    """Push state_sync to frontend WebSocket + persist user: keys to Firestore."""
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
            if key.startswith("user:"):
                firestore_key = key[len("user:"):]
                asyncio.run_coroutine_threadsafe(
                    _persist_user_state(ctx, firestore_key, data),
                    loop,
                )
    except Exception as e:
        print(f"[Push] Failed to push {key}: {e}")


async def _persist_user_state(ctx, key: str, value):
    """Write a single user-state key directly to Firestore."""
    try:
        from app import session_service
        ref = session_service._user_state_ref(ctx.session.app_name, ctx.session.user_id)
        await ref.set({key: value}, merge=True)
    except Exception as e:
        print(f"[Firestore] Failed to persist user:{key}: {e}")


# ══════════════════════════════════════════════════════════════════
# TOOL 1: manage_profile
# ══════════════════════════════════════════════════════════════════

def manage_profile(ctx: ToolContext, action: str, part: str = "all", data_json: str = "") -> str:
    """Manage body profile and posture. action: read|write|write_posture.
    part: all|chest|shoulders|back|legs|core|arms (for read/write).
    For write: data_json like '{"max_weight":120}'.
    For write_posture: data_json like '{"issues":["right shoulder elevated 5°"],"overall":"needs attention"}'."""
    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE.copy())

    if action == "read":
        _push_to_frontend(ctx, "user:body_profile", profile)
        if part != "all" and part in profile:
            d = profile[part]
            return f"{part}: {d.get('exercise','?')} PR {d.get('max_weight',0)}kg, status={d.get('recovery_status','?')}, last={d.get('last_trained','never')}"
        lines = []
        for p, d in profile.items():
            if not isinstance(d, dict):
                continue
            lines.append(f"{p}: {d.get('exercise','?')} PR {d.get('max_weight',0)}kg, status={d.get('recovery_status','?')}, last={d.get('last_trained','never')}")
        return "\n".join(lines)

    elif action == "write":
        if part == "all" or part not in profile:
            return f"Error: specify a valid part (chest|shoulders|back|legs|core|arms), got '{part}'"
        try:
            data = json.loads(data_json) if data_json else {}
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
        for k, v in data.items():
            if k == "max_weight" and isinstance(v, (int, float)):
                if v > profile[part].get("max_weight", 0):
                    profile[part]["max_weight"] = v
            elif k == "last_trained":
                profile[part]["last_trained"] = v
                profile[part]["recovery_status"] = "recovering"
            else:
                profile[part][k] = v
        ctx.session.state["user:body_profile"] = profile
        _push_to_frontend(ctx, "user:body_profile", profile)
        return f"Updated {part}: {json.dumps(profile[part], default=str)}"

    elif action == "write_posture":
        # LLM generates the posture report, tool just validates and persists.
        # data_json: '{"issues":["right shoulder elevated 5°","forward head 4cm"],"overall":"needs attention"}'
        try:
            report = json.loads(data_json) if data_json else {}
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
        if "issues" not in report:
            report["issues"] = []
        report["issue_count"] = len(report.get("issues", []))
        if "overall" not in report:
            report["overall"] = "good" if not report["issues"] else "needs attention"
        ctx.session.state["user:posture_report"] = report
        _push_to_frontend(ctx, "user:posture_report", report)
        if not report["issues"]:
            return "Posture: Good. No issues detected."
        return f"Posture: {report['overall']}. {'; '.join(report['issues'])}"

    return f"Unknown action: {action}"


# ══════════════════════════════════════════════════════════════════
# TOOL 2: manage_training
# ══════════════════════════════════════════════════════════════════

def manage_training(ctx: ToolContext, action: str, data_json: str = "") -> str:
    """Manage training data. action: read_history|write_set|generate_plan|modify_plan|read_plan.
    data_json varies by action — see examples in tool router prompt."""

    if action == "read_history":
        history = ctx.session.state.get("user:training_history", [])
        if not history or not isinstance(history, list):
            return "No training history."
        lines = [f"{len(history)} sessions:"]
        for s in history[-10:]:
            if not isinstance(s, dict):
                continue
            date = s.get("date", "?")
            for ex in s.get("exercises", []):
                eid = ex.get("exercise_id", "?")
                sets = ex.get("sets", [])
                max_w = max((st.get("weight", 0) for st in sets), default=0)
                lines.append(f"  {date}: {eid} {len(sets)} sets, max {max_w}kg")
        return "\n".join(lines)

    elif action == "write_set":
        try:
            data = json.loads(data_json) if data_json else {}
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
        history = ctx.session.state.get("user:training_history", [])
        if not isinstance(history, list):
            history = []
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_session = next((s for s in history if isinstance(s, dict) and s.get("date") == today), None)
        if not today_session:
            today_session = {"id": str(uuid.uuid4()), "date": today,
                             "start_time": datetime.now(timezone.utc).isoformat(),
                             "end_time": None, "exercises": []}
            history.append(today_session)
        eid = data.get("exercise_id", "unknown")
        ex_record = next((e for e in today_session["exercises"] if e.get("exercise_id") == eid), None)
        if not ex_record:
            ex_record = {"exercise_id": eid, "sets": []}
            today_session["exercises"].append(ex_record)
        ex_record["sets"].append({
            "set_number": data.get("set_number", len(ex_record["sets"]) + 1),
            "reps": data.get("reps", 0), "weight": data.get("weight", 0),
            "rpe": data.get("rpe"), "rom_avg_degrees": data.get("rom_avg_degrees"),
            "symmetry_score": data.get("symmetry_score"),
        })
        ctx.session.state["user:training_history"] = history
        _push_to_frontend(ctx, "user:training_history", history)
        name = EXERCISE_LIBRARY.get(eid, {}).get("name_en", eid)
        return f"Recorded: {name} set {data.get('set_number', '?')}, {data.get('weight', 0)}kg x {data.get('reps', 0)}"

    elif action == "generate_plan":
        return _generate_plan(ctx, data_json)

    elif action == "modify_plan":
        return _modify_plan(ctx, data_json)

    elif action == "read_plan":
        plan = ctx.session.state.get("current_plan")
        if not plan:
            return "No current plan."
        _push_to_frontend(ctx, "current_plan", plan)
        lines = [f"Plan: {', '.join(plan.get('target_parts', []))}"]
        for ex in plan.get("exercises", []):
            lines.append(f"  {ex.get('name_en', '?')}: {ex.get('target_sets')}x{ex.get('target_reps')} @ {ex.get('target_weight')}kg")
        return "\n".join(lines)

    return f"Unknown action: {action}"


def _generate_plan(ctx, data_json: str) -> str:
    """AI-generates a training plan using Gemini."""
    from google import genai
    from google.genai import types as gtypes

    try:
        data = json.loads(data_json) if data_json else {}
    except json.JSONDecodeError:
        data = {}

    profile = ctx.session.state.get("user:body_profile", DEFAULT_BODY_PROFILE)
    history = ctx.session.state.get("user:training_history", [])
    target = data.get("target_parts", "")
    parts = [p.strip() for p in target.split(",") if p.strip()] if target else []
    if not parts:
        parts = [p for p, d in profile.items() if isinstance(d, dict) and d.get("recovery_status") == "recovered"]
        if not parts:
            parts = ["chest", "back"]

    profile_lines = []
    for p, d in profile.items():
        if isinstance(d, dict):
            profile_lines.append(f"{p}: {d.get('exercise','?')} PR {d.get('max_weight',0)}kg, status={d.get('recovery_status','?')}, last={d.get('last_trained','never')}")

    history_lines = []
    for s in (history[-5:] if isinstance(history, list) else []):
        if not isinstance(s, dict):
            continue
        for ex in s.get("exercises", []):
            sets = ex.get("sets", [])
            mw = max((st.get("weight", 0) for st in sets), default=0)
            history_lines.append(f"{s.get('date','?')}: {ex.get('exercise_id','?')} {len(sets)} sets, max {mw}kg")

    exercises_avail = [f"{eid}: {info.get('name_en', eid)} ({info.get('name', '')}), primary={info.get('primary_muscles')}"
                       for eid, info in EXERCISE_LIBRARY.items()]

    prompt = f"""You are an expert strength coach. Generate a training plan for today.

TARGET MUSCLE GROUPS: {', '.join(parts)}

USER DATA:
{chr(10).join(profile_lines)}

RECENT TRAINING (last 5 sessions):
{chr(10).join(history_lines) or 'No history — this is a beginner. Start conservative.'}

AVAILABLE EXERCISES:
{chr(10).join(exercises_avail)}

TRAINING SCIENCE PRINCIPLES (apply these):

1. EXERCISE SELECTION
   - Start with compound movements (bench_press, squat, deadlift, barbell_row, ohp)
   - Finish with isolation (barbell_curl, plank)
   - 2-4 exercises per session. More is not better.
   - Choose exercises that match the target muscles

2. PROGRESSIVE OVERLOAD
   - Working weight = 75-85% of PR for strength (3-6 reps)
   - Working weight = 65-75% of PR for hypertrophy (8-12 reps)
   - If user hit a PR recently, back off 10% for a deload session
   - If no PR data (0kg), prescribe moderate weight based on exercise type

3. VOLUME
   - 3-4 working sets per exercise (not counting warm-up)
   - Total session: 12-20 working sets
   - Don't exceed 20 sets — diminishing returns

4. RECOVERY AWARENESS
   - If a muscle was trained yesterday → skip it or use very light weight
   - If "recovering" status → reduce volume (2-3 sets instead of 4)
   - If "recovered" → full volume

5. REP RANGES (match to goal)
   - Strength: 3-6 reps, heavier weight, longer rest
   - Hypertrophy: 8-12 reps, moderate weight
   - Endurance/pump: 12-15 reps, lighter weight
   - Mix rep ranges across exercises for variety

6. VARIETY
   - Don't repeat the exact same plan as recent sessions
   - Vary rep ranges, exercise order, or working weight
   - If user did 4x6 last time, try 3x10 or 5x5 this time

Return ONLY valid JSON. No markdown, no explanation.

JSON FORMAT:
{{"target_parts":["chest","back"],"exercises":[{{"exercise_id":"bench_press","name":"卧推","name_en":"Bench Press","primary_muscles":["chest"],"secondary_muscles":["shoulders","arms"],"target_sets":4,"target_reps":8,"target_weight":85.0,"completed_sets":0}}]}}"""

    try:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[gtypes.Content(role="user", parts=[gtypes.Part(text=prompt)])],
            config=gtypes.GenerateContentConfig(temperature=0.7, response_mime_type="application/json"),
        )
        plan = json.loads(resp.text.strip())
    except Exception as e:
        print(f"[Plan] AI failed: {e}, fallback")
        exercises = []
        for p in parts:
            d = profile.get(p, {}) if isinstance(profile.get(p), dict) else {}
            eid = d.get("exercise", "bench_press")
            mw = d.get("max_weight", 0)
            tw = round(mw * 0.85, 1) if mw > 0 else 20
            info = EXERCISE_LIBRARY.get(eid, {})
            exercises.append({"exercise_id": eid, "name": info.get("name", eid), "name_en": info.get("name_en", eid),
                              "primary_muscles": info.get("primary_muscles", [p]), "secondary_muscles": info.get("secondary_muscles", []),
                              "target_sets": 4, "target_reps": 6, "target_weight": tw, "completed_sets": 0})
        plan = {"target_parts": parts, "exercises": exercises}

    ctx.session.state["current_plan"] = plan
    _push_to_frontend(ctx, "current_plan", plan)
    lines = [f"Plan: {', '.join(plan.get('target_parts', parts))}"]
    for ex in plan.get("exercises", []):
        lines.append(f"  {ex.get('name_en','?')}: {ex.get('target_sets',4)}x{ex.get('target_reps',6)} @ {ex.get('target_weight',0)}kg")
    return "\n".join(lines)


def _modify_plan(ctx, data_json: str) -> str:
    """AI-modifies the current plan based on user request."""
    from google import genai
    from google.genai import types as gtypes

    plan = ctx.session.state.get("current_plan")
    if not plan:
        return "No current plan to modify. Generate one first."

    try:
        data = json.loads(data_json) if data_json else {}
    except json.JSONDecodeError:
        data = {"modification": data_json}

    modification = data.get("modification", "")
    if not modification:
        return "No modification specified."

    prompt = f"""Modify this training plan based on the user's request.

CURRENT PLAN:
{json.dumps(plan, ensure_ascii=False, indent=2)}

USER REQUEST: {modification}

RULES: Return the COMPLETE modified plan as valid JSON. Same structure as input. Only change what the user asked for. Keep everything else the same."""

    try:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[gtypes.Content(role="user", parts=[gtypes.Part(text=prompt)])],
            config=gtypes.GenerateContentConfig(temperature=0.2, response_mime_type="application/json"),
        )
        new_plan = json.loads(resp.text.strip())
    except Exception as e:
        return f"Failed to modify plan: {e}"

    ctx.session.state["current_plan"] = new_plan
    _push_to_frontend(ctx, "current_plan", new_plan)
    lines = [f"Modified plan: {', '.join(new_plan.get('target_parts', []))}"]
    for ex in new_plan.get("exercises", []):
        lines.append(f"  {ex.get('name_en','?')}: {ex.get('target_sets',4)}x{ex.get('target_reps',6)} @ {ex.get('target_weight',0)}kg")
    return "\n".join(lines)


# ══════════════════════════════════════════════════════════════════
# TOOL 3: manage_preferences
# ══════════════════════════════════════════════════════════════════

def manage_preferences(ctx: ToolContext, action: str, data_json: str = "") -> str:
    """Manage user preferences. action: read|write.
    For write: data_json like '{"personality_mode":"gentle"}' or '{"rest_timer_seconds":90}'."""
    prefs = ctx.session.state.get("user:preferences", DEFAULT_PREFERENCES.copy())

    if action == "read":
        return f"personality={prefs.get('personality_mode')}, voice={prefs.get('voice_name')}, contact={prefs.get('emergency_contact','none')}, rest={prefs.get('rest_timer_seconds',120)}s"

    elif action == "write":
        try:
            data = json.loads(data_json) if data_json else {}
        except json.JSONDecodeError:
            return f"Invalid JSON: {data_json}"
        updated = []
        if "personality_mode" in data:
            prefs["personality_mode"] = data["personality_mode"]
            prefs["voice_name"] = VOICE_MAP.get(data["personality_mode"], "Charon")
            updated.append(f"personality={data['personality_mode']}")
        if "emergency_contact" in data:
            prefs["emergency_contact"] = data["emergency_contact"]
            updated.append("emergency_contact")
        if "rest_timer_seconds" in data:
            prefs["rest_timer_seconds"] = data["rest_timer_seconds"]
            updated.append(f"rest={data['rest_timer_seconds']}s")
        if "language" in data:
            prefs["language"] = data["language"]
            updated.append(f"language={data['language']}")
        if "safety_sensitivity" in data:
            prefs["safety_sensitivity"] = data["safety_sensitivity"]
            updated.append(f"safety={data['safety_sensitivity']}")
        ctx.session.state["user:preferences"] = prefs
        _push_to_frontend(ctx, "user:preferences", prefs)
        return f"Updated: {', '.join(updated)}" if updated else "No changes."

    return f"Unknown action: {action}"


# ══════════════════════════════════════════════════════════════════
# TOOL 4: safety_control
# ══════════════════════════════════════════════════════════════════

def safety_control(ctx: ToolContext, action: str, data_json: str = "") -> str:
    """Safety alert control. action: trigger|cancel.
    For trigger: data_json like '{"alert_type":"barbell_stall","countdown_seconds":10}'."""
    if action == "trigger":
        try:
            data = json.loads(data_json) if data_json else {}
        except json.JSONDecodeError:
            data = {}
        alert_type = data.get("alert_type", "unknown")
        countdown = data.get("countdown_seconds", 10)
        ctx.session.state["safety_alert_active"] = True
        ctx.session.state["safety_countdown"] = countdown
        _push_to_frontend(ctx, "ui_command", {
            "command": "show_safety_alert",
            "data": {"countdown_seconds": countdown},
        })
        contact = ctx.session.state.get("user:preferences", {}).get("emergency_contact", "")
        if not contact:
            return f"SAFETY ALERT ({alert_type}), {countdown}s. No emergency contact!"
        return f"SAFETY ALERT ({alert_type}), calling {contact} in {countdown}s"

    elif action == "cancel":
        ctx.session.state["safety_alert_active"] = False
        _push_to_frontend(ctx, "ui_command", {"command": "cancel_safety_alert", "data": {}})
        return "Safety alert cancelled."

    return f"Unknown action: {action}"


# ══════════════════════════════════════════════════════════════════
# TOOL 5: ui_navigate
# ══════════════════════════════════════════════════════════════════

def ui_navigate(ctx: ToolContext, command: str, data_json: str = "") -> str:
    """Control frontend UI. command: switch_mode|start_rest_timer.
    data_json: '{"mode":"planning"}' or '{"seconds":120}'."""
    try:
        data = json.loads(data_json) if data_json else {}
    except json.JSONDecodeError:
        return f"Invalid JSON: {data_json}"
    _push_to_frontend(ctx, "ui_command", {"command": command, "data": data})
    return f"UI: {command}"


# ══════════════════════════════════════════════════════════════════
# ROOT AGENT
# ══════════════════════════════════════════════════════════════════

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

SYSTEM_INSTRUCTION = """You are MuscleClaw, a Jarvis-like AI fitness coach.

## Language (HIGHEST PRIORITY)
ALWAYS speak English. Never Chinese, German, or other languages.

## Conversation Style
This is a real-time voice conversation. Be natural — like a real coach in a gym, not a script.

## Tool Results
A separate system handles all tool calls and UI navigation automatically.
You will see [TOOL_RESULT] messages with real data from the database.
When you see [TOOL_RESULT], describe the data naturally using the EXACT numbers. Never invent or round numbers.
If no [TOOL_RESULT] appears, the user is just chatting — respond conversationally.

## Personality Modes

### trash_talk (DEFAULT — the star of the show!)
You're that gym bro who roasts everyone but secretly gives the best advice. Comedy through contrast — the harsher the roast, the more precise the coaching that follows.
- First meeting: "Well well well, look who decided to grace us with their presence!"
- Rep counting: "One! Two! Three! Wow, you actually came prepared today? I'm shocked."
- Bad ROM: "Nah nah nah, that does NOT count! My grandmother extends further reaching for the TV remote."
- Final reps push: "YEAH BUDDY! LIGHT WEIGHT BABY! COME ON! PUSH IT!"
- Resting too long: "Are you resting or are you on vacation? Should I book you a flight?"
- Set complete: "That's it? Fine, I'll give you a pass. But add some weight next set, this isn't yoga."
- New PR: "WAIT WHAT?! New record?! Okay okay, respect. But don't get cocky, we're back tomorrow."
- Safety alert: **INSTANTLY switch to dead serious**: "HOLD UP. Bar isn't moving. Are you okay? Do you need help?"
- After safety cancel: "Alright, you scared me. Don't do that again — if you die, who am I gonna train with?"
- Posture issues: "That posture... are you cosplaying a shrimp? Stand up straight, chest out."
- Training done: "Finally done. Are you tired? If not, you were slacking."
RULES: Every roast MUST be followed by specific coaching advice. Never just mock without teaching. No repeating the same joke in one session.

### gentle (Warm & Encouraging)
- Rep counting: "Great, one... two... three... perfect rhythm, keep it up!"
- Bad ROM: "Almost there! Just extend a tiny bit more and it'll be perfect. You got this."
- Set complete: "Beautiful set! Really clean form, take a well-deserved rest."
- New PR: "New personal record! Your hard work is really paying off, so proud of you!"
- Safety: Switch to concerned but calm: "Hey, are you alright? Take a moment."
- Training done: "Great work today! You earned a good rest. See you next time!"

### professional (Clinical & Data-Driven)
- Rep counting: "One. Two. Three. ROM acceptable."
- Bad ROM: "Incomplete range of motion. Rep not counted. Extend fully."
- Set complete: "Set three complete. Rest 120 seconds. Volume tracking nominal."
- New PR: "New PR recorded: 110kg. 5kg increase from previous maximum."
- Safety: "Alert triggered. Barbell stall detected. Initiating safety protocol."
- Training done: "Session complete. 12 sets executed. Total volume 5400kg. Average RPE 7.5."

## Training Flow
React to [CV] events naturally: count reps, correct form, announce rest.

## CV Event Response
When you receive [CV] tagged messages from the computer vision system:
- rep_complete: Count it out loud. If ROM is low, reject it with personality.
- form_issue: Correct immediately ("Left arm dropping — raise it up!")
- safety_alert: Override personality → dead serious. Ask if they need help.
- gesture thumbs_up: Treat as "yes" or "confirm"
- set_complete: Announce rest period, encourage

## Core Rules
- Use EXACT numbers from [TOOL_RESULT], never invent data
- Safety overrides personality
- Be concise — like a real coach, not a lecture
"""

root_agent = Agent(
    name="muscleclaw",
    model=LIVE_MODEL,
    instruction=SYSTEM_INSTRUCTION,
    # No tools — ToolRouter (text model) handles all tool calls.
    # Audio model only speaks + reacts to [TOOL_RESULT].
    # UI navigation is auto-chained in app.py based on data tool called.
    tools=[],
)

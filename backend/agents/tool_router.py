"""ToolRouter — Text model for reliable tool calling (6 domain tools).

Uses gemini-2.5-flash with mode=ANY for 100% tool call reliability.
Audio model handles voice only. This handles all data operations.
"""
import os
from google import genai
from google.genai import types

TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="manage_profile",
        description="Read/write body profile or posture data. Actions: read (check recovery), write (update PR/dates), write_posture (save posture analysis).",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="read, write, or write_posture"),
                "part": types.Schema(type="STRING", description="all, chest, shoulders, back, legs, core, or arms (for read/write)"),
                "data_json": types.Schema(type="STRING", description='For write: {"max_weight":120}. For write_posture: {"issues":["right shoulder elevated 5°"],"overall":"needs attention"}'),
            },
            required=["action"],
        ),
    ),
    types.FunctionDeclaration(
        name="manage_training",
        description="Manage training plans and history. Actions: read_history (view past sessions), write_set (record a set), generate_plan (AI creates new plan), modify_plan (change existing plan), read_plan (view current plan), start_session (begin training from current plan).",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="read_history, write_set, generate_plan, modify_plan, or read_plan"),
                "data_json": types.Schema(type="STRING", description='JSON varies by action. generate_plan: {"target_parts":"chest,back"}. write_set: {"exercise_id":"bench_press","set_number":1,"reps":8,"weight":100}. modify_plan: {"modification":"change bench press weight to 90kg"}. start_session: not needed.'),
            },
            required=["action"],
        ),
    ),
    types.FunctionDeclaration(
        name="manage_preferences",
        description="Read or write user preferences (personality mode, rest timer, emergency contact).",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="read or write"),
                "data_json": types.Schema(type="STRING", description='JSON for write, e.g. {"personality_mode":"gentle"} or {"rest_timer_seconds":90} or {"emergency_contact":"999"}'),
            },
            required=["action"],
        ),
    ),
    types.FunctionDeclaration(
        name="safety_control",
        description="Trigger or cancel safety alert. Use for barbell stall, body collapse, or unresponsive user.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="trigger or cancel"),
                "data_json": types.Schema(type="STRING", description='For trigger: {"alert_type":"barbell_stall","countdown_seconds":10}'),
            },
            required=["action"],
        ),
    ),
    types.FunctionDeclaration(
        name="ui_navigate",
        description="Switch frontend page. Use when user wants to navigate without data operations: start training, enter showcase, show dashboard.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "command": types.Schema(type="STRING", description="switch_mode or start_rest_timer"),
                "data_json": types.Schema(type="STRING", description='{"mode":"training"} or {"mode":"showcase"} or {"mode":"dashboard"} or {"seconds":120}'),
            },
            required=["command"],
        ),
    ),
    types.FunctionDeclaration(
        name="no_action",
        description="No tool needed — casual conversation, greeting, or question that doesn't require data changes.",
        parameters=types.Schema(type="OBJECT", properties={}),
    ),
]

ROUTER_PROMPT = """You are a tool router for a fitness AI coach. Given a user message, call exactly ONE tool.

AVAILABLE EXERCISE IDs (use these exact strings):
- bench_press (Bench Press) — chest
- squat (Squat) — legs
- deadlift (Deadlift) — back, legs
- ohp (Overhead Press) — shoulders
- barbell_row (Barbell Row) — back
- barbell_curl (Barbell Curl) — arms
- plank (Plank) — core

ROUTING RULES:
- "show/check my profile/body/status/recovery" → manage_profile(action="read")
- "update chest PR to 120" → manage_profile(action="write", part="chest", data_json='{"max_weight":120}')
- "create/make a plan" or "what should I train" → manage_training(action="generate_plan", data_json='{"target_parts":"chest,back"}')
  Extract target muscles from user message. If none specified, leave target_parts empty for auto.
- "change bench to 90kg" or "add squat to plan" → manage_training(action="modify_plan", data_json='{"modification":"<exact user request>"}')
- "show my plan" → manage_training(action="read_plan")
- "record bench press 100kg 8 reps" → manage_training(action="write_set", data_json='{"exercise_id":"bench_press","reps":8,"weight":100}')
  Map exercise names to exercise_id from the list above.
- "start training" / "let's go" / "begin workout" → manage_training(action="start_session")
- "show training history" → manage_training(action="read_history")
- "switch to gentle/trash talk/professional" → manage_preferences(action="write", data_json='{"personality_mode":"gentle"}')
- "set rest to 90 seconds" → manage_preferences(action="write", data_json='{"rest_timer_seconds":90}')
- "set emergency contact 999" → manage_preferences(action="write", data_json='{"emergency_contact":"999"}')
- "show dashboard" / "show my status" → manage_profile(action="read") [auto-switches to dashboard]
- "show plan" / "show my plan" → manage_training(action="read_plan") [auto-switches to planning]
- "start training" / "let's go" / "begin workout" → manage_training(action="start_session")
- "enter showcase" / "showcase mode" / "show off" → ui_navigate(command="switch_mode", data_json='{"mode":"showcase"}')
- "ready" / "take the photo" / "go" / "capture" / "shoot" (in showcase mode) → ui_navigate(command="showcase_capture", data_json='{}')
- "analyze posture" → manage_profile(action="write_posture", data_json='{"issues":[],"overall":"good"}') [auto-switches to posture]
- "trigger safety alert" → safety_control(action="trigger", data_json='{"alert_type":"barbell_stall","countdown_seconds":10}')
- "cancel safety alert" → safety_control(action="cancel")
- Greetings, chat, questions, compliments → no_action()

IMPORTANT:
- For modify_plan, include the user's EXACT request in the modification field.
- For write_set, always map exercise names to exercise_id (e.g. "bench press" → "bench_press").
- Always call exactly one tool. Never respond with text only."""


class ToolRouter:
    def __init__(self):
        self._client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    async def route(self, user_text: str) -> tuple[str | None, dict | None]:
        """Return (tool_name, args_dict) or (None, None) for no_action."""
        try:
            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[types.Content(role="user", parts=[types.Part(text=user_text)])],
                config=types.GenerateContentConfig(
                    system_instruction=ROUTER_PROMPT,
                    tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(mode="ANY"),
                    ),
                    temperature=0.0,
                ),
            )
            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        name = part.function_call.name
                        args = dict(part.function_call.args) if part.function_call.args else {}
                        if name == "no_action":
                            return None, None
                        print(f"[Router] {user_text[:50]}... → {name}({args})")
                        return name, args
            return None, None
        except Exception as e:
            print(f"[Router] Error: {e}")
            return None, None

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
        description="Read or write body profile data (6 muscle groups: chest, shoulders, back, legs, core, arms). Use 'read' to check recovery status, 'write' to update PR weights or training dates.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="read or write"),
                "part": types.Schema(type="STRING", description="all, chest, shoulders, back, legs, core, or arms"),
                "data_json": types.Schema(type="STRING", description='JSON for write, e.g. {"max_weight":120,"last_trained":"2026-03-17"}'),
            },
            required=["action"],
        ),
    ),
    types.FunctionDeclaration(
        name="manage_training",
        description="Manage training plans and history. Actions: read_history (view past sessions), write_set (record a set), generate_plan (AI creates new plan), modify_plan (change existing plan), read_plan (view current plan).",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "action": types.Schema(type="STRING", description="read_history, write_set, generate_plan, modify_plan, or read_plan"),
                "data_json": types.Schema(type="STRING", description='JSON varies by action. generate_plan: {"target_parts":"chest,back"}. write_set: {"exercise_id":"bench_press","set_number":1,"reps":8,"weight":100}. modify_plan: {"modification":"change bench press weight to 90kg"}.'),
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
        description="Control frontend UI. Switch pages or start timers.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "command": types.Schema(type="STRING", description="switch_mode or start_rest_timer"),
                "data_json": types.Schema(type="STRING", description='{"mode":"dashboard"} or {"mode":"planning"} or {"seconds":120}'),
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

ROUTING RULES:
- "show/check my profile/body/status/recovery" → manage_profile(action="read")
- "update chest/weight to X" → manage_profile(action="write", part="chest", data_json='{"max_weight":X}')
- "create/make/generate a plan" → manage_training(action="generate_plan", data_json='{"target_parts":"chest,back"}')
- "change/modify plan: bench to 90kg" → manage_training(action="modify_plan", data_json='{"modification":"change bench press weight to 90kg"}')
- "show/read my plan" → manage_training(action="read_plan")
- "record set: bench 100kg 8 reps" → manage_training(action="write_set", data_json='{"exercise_id":"bench_press","set_number":1,"reps":8,"weight":100}')
- "show training history" → manage_training(action="read_history")
- "switch to gentle/trash talk/pro" → manage_preferences(action="write", data_json='{"personality_mode":"gentle"}')
- "set rest timer to 90s" → manage_preferences(action="write", data_json='{"rest_timer_seconds":90}')
- "show dashboard/plan/training" → ui_navigate(command="switch_mode", data_json='{"mode":"dashboard"}')
- "trigger/cancel safety alert" → safety_control(action="trigger/cancel")
- Greetings, chat, questions → no_action()

IMPORTANT: For modify_plan, put the user's exact modification request in data_json.modification field.
Always call a tool. Never respond with text only."""


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

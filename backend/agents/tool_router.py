"""ToolRouter — Text model for reliable tool calling.

Native audio model (preview) has ~50% tool calling reliability.
This module uses gemini-2.5-flash (text, stable) to analyze user
messages, decide which tools to call, and execute them directly.

The audio model handles voice I/O and personality only.
"""
import json
import os
from google import genai
from google.genai import types

# Tool declarations for the text model (matching main_agent.py tools)
TOOL_DECLARATIONS = [
    types.FunctionDeclaration(
        name="get_body_profile",
        description="Get user's 6 muscle group strength data and recovery status.",
        parameters=types.Schema(type="OBJECT", properties={}),
    ),
    types.FunctionDeclaration(
        name="update_body_profile",
        description="Update a muscle group's data.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "part": types.Schema(type="STRING", description="chest|shoulders|back|legs|core|arms"),
                "max_weight": types.Schema(type="NUMBER", description="New max weight in kg"),
                "last_trained": types.Schema(type="STRING", description="Date like 2026-03-17"),
            },
            required=["part"],
        ),
    ),
    types.FunctionDeclaration(
        name="generate_training_plan",
        description="Generate a training plan. target_parts: comma-separated like 'chest,back'. Empty = auto.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "target_parts": types.Schema(type="STRING", description="Comma-separated muscle groups"),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="record_training_set",
        description="Record one training set.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "exercise_id": types.Schema(type="STRING"),
                "set_number": types.Schema(type="INTEGER"),
                "reps": types.Schema(type="INTEGER"),
                "weight": types.Schema(type="NUMBER"),
                "rpe": types.Schema(type="NUMBER"),
            },
            required=["exercise_id", "set_number", "reps", "weight"],
        ),
    ),
    types.FunctionDeclaration(
        name="update_user_preferences",
        description="Update user preferences. personality_mode: professional|gentle|trash_talk",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "personality_mode": types.Schema(type="STRING"),
                "emergency_contact": types.Schema(type="STRING"),
                "rest_timer_seconds": types.Schema(type="INTEGER"),
            },
        ),
    ),
    types.FunctionDeclaration(
        name="trigger_safety_alert",
        description="Trigger safety alert.",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "alert_type": types.Schema(type="STRING", description="barbell_stall|body_collapse|unresponsive"),
                "countdown_seconds": types.Schema(type="INTEGER"),
            },
            required=["alert_type"],
        ),
    ),
    types.FunctionDeclaration(
        name="cancel_safety_alert",
        description="Cancel active safety alert.",
        parameters=types.Schema(type="OBJECT", properties={}),
    ),
    types.FunctionDeclaration(
        name="send_ui_command",
        description="Send UI command. command: switch_mode|start_rest_timer",
        parameters=types.Schema(
            type="OBJECT",
            properties={
                "command": types.Schema(type="STRING"),
                "data_json": types.Schema(type="STRING", description="JSON payload"),
            },
            required=["command"],
        ),
    ),
    types.FunctionDeclaration(
        name="no_tool_needed",
        description="No tool call needed — this is just casual conversation, greeting, or a question.",
        parameters=types.Schema(type="OBJECT", properties={}),
    ),
]

ROUTER_PROMPT = """You are a tool-calling router for a fitness AI coach.

Given a user message, decide which tool to call. You MUST call exactly ONE tool.
If the message is just casual chat (hello, thanks, etc.), call no_tool_needed.

Rules:
- "create/make a plan" or "what should I train" → generate_training_plan
- "update my chest/weight" or any body part data update → update_body_profile
- "record this set / I did X reps" → record_training_set
- "switch to gentle/trash talk/pro" → update_user_preferences
- "show dashboard / switch mode" → send_ui_command
- "show my profile" → get_body_profile
- "trigger/cancel safety" → trigger_safety_alert or cancel_safety_alert
- Greetings, questions, chat → no_tool_needed

Always call the tool. Never just respond with text."""


class ToolRouter:
    """Routes user messages to tool calls via text model."""

    def __init__(self):
        self._client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    async def route(self, user_text: str) -> tuple[str | None, dict | None]:
        """Analyze user text and return (tool_name, tool_args) or (None, None).

        Returns:
            (tool_name, args_dict) if a tool should be called
            (None, None) if no tool needed (casual chat)
        """
        try:
            response = self._client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[types.Content(role="user", parts=[types.Part(text=user_text)])],
                config=types.GenerateContentConfig(
                    system_instruction=ROUTER_PROMPT,
                    tools=[types.Tool(function_declarations=TOOL_DECLARATIONS)],
                    tool_config=types.ToolConfig(
                        function_calling_config=types.FunctionCallingConfig(
                            mode="ANY",  # Force function calling
                        ),
                    ),
                    temperature=0.0,  # Deterministic
                ),
            )

            # Extract function call
            if response.candidates and response.candidates[0].content:
                for part in response.candidates[0].content.parts:
                    if part.function_call:
                        name = part.function_call.name
                        args = dict(part.function_call.args) if part.function_call.args else {}
                        if name == "no_tool_needed":
                            return None, None
                        print(f"[Router] {user_text[:40]}... → {name}({args})")
                        return name, args

            return None, None

        except Exception as e:
            print(f"[Router] Error: {e}")
            return None, None

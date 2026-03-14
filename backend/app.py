"""MuscleClaw FastAPI backend — bridges frontend WebSocket to ADK Live Agent."""
import asyncio
import base64
import json
import os
import pathlib
import traceback

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from sessions.firestore_session_service import FirestoreSessionService
from google.genai import types

from agents.main_agent import root_agent
from config.defaults import DEFAULT_PREFERENCES
from config.exercise_library import EXERCISE_LIBRARY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session service — Firestore for true persistence on Cloud Run
session_service = FirestoreSessionService(project=os.getenv("GCP_PROJECT", "muscleclaw"))

runner = Runner(
    app_name="muscleclaw",
    agent=root_agent,
    session_service=session_service,
)


# ── UI command mapping: function_name → frontend command ──────────
UI_COMMAND_MAP = {
    "trigger_safety_alert": "show_safety_alert",
    "cancel_safety_alert": "cancel_safety_alert",
    "generate_training_plan": "show_training_plan",
    "analyze_posture": "show_posture_report",
    "send_ui_command": None,  # handled specially — reads command from args
}


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "muscleclaw"}


@app.get("/api/exercises")
async def get_exercises():
    return {"data": EXERCISE_LIBRARY}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()

    # Always create a fresh session per WebSocket connection.
    # User-level data (body_profile, training_history, preferences) persists
    # via Firestore user: prefix — not tied to individual sessions.
    # Reusing old sessions causes "invalid argument" errors because
    # stale event history gets replayed to the Live API.
    session = await session_service.create_session(
        app_name="muscleclaw", user_id=user_id
    )

    # Create live request queue for bidi-streaming
    live_queue = LiveRequestQueue()

    # Voice config from user preferences
    prefs = session.state.get("user:preferences", DEFAULT_PREFERENCES)
    voice_name = prefs.get("voice_name", "Charon")

    # Minimal RunConfig — only voice and audio modality.
    # Advanced features (affective_dialog, proactivity, session_resumption,
    # context_window_compression) require Vertex AI (v1alpha endpoint).
    run_config = RunConfig(
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            )
        ),
        response_modalities=["AUDIO"],
    )

    await websocket.send_json({
        "type": "connected",
        "session_id": session.id,
    })

    # Background task: consume events from run_live → forward to WebSocket
    async def forward_events():
        try:
            async for event in runner.run_live(
                user_id=user_id,
                session_id=session.id,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        # Audio output → send as binary WebSocket frame
                        if (part.inline_data
                                and part.inline_data.mime_type
                                and part.inline_data.mime_type.startswith("audio/")):
                            await websocket.send_bytes(part.inline_data.data)

                        # Text transcript → send as JSON
                        elif part.text and not event.partial:
                            await websocket.send_json({
                                "type": "transcript",
                                "role": "model",
                                "text": part.text,
                            })

                # Detect function responses — tool return values
                for fr in (event.get_function_responses() or []):
                    if fr.name == "generate_training_plan" and fr.response:
                        plan_data = fr.response.get("result", fr.response)
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": "show_training_plan",
                            "data": {"plan": plan_data},
                        })
                    elif fr.name == "analyze_posture" and fr.response:
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": "show_posture_report",
                            "data": fr.response.get("result", fr.response),
                        })

                # Detect function calls for UI-triggering tools
                for fc in (event.get_function_calls() or []):
                    if fc.name == "send_ui_command":
                        args = fc.args or {}
                        data = {}
                        if args.get("data_json"):
                            try:
                                data = json.loads(args["data_json"])
                            except (json.JSONDecodeError, TypeError):
                                data = {}
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": args.get("command", ""),
                            "data": data,
                        })
                    elif fc.name == "trigger_safety_alert":
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": "show_safety_alert",
                            "data": fc.args or {},
                        })
                    elif fc.name == "cancel_safety_alert":
                        await websocket.send_json({
                            "type": "ui_command",
                            "command": "cancel_safety_alert",
                            "data": {},
                        })

        except asyncio.CancelledError:
            print(f"[Live] Cancelled for user {user_id}")
        except Exception as e:
            print(f"[Live] ERROR for user {user_id}: {type(e).__name__}: {e}")
            traceback.print_exc()
            try:
                await websocket.send_json({
                    "type": "transcript",
                    "role": "model",
                    "text": f"连接错误: {str(e)[:200]}",
                })
            except Exception:
                pass

    event_task = asyncio.create_task(forward_events())

    try:
        while True:
            data = await websocket.receive()

            if "bytes" in data and data["bytes"]:
                # Audio binary from browser mic → Gemini Live
                live_queue.send_realtime(types.Blob(
                    mime_type="audio/pcm;rate=16000",
                    data=data["bytes"],
                ))

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])

                if msg["type"] == "text":
                    # Text input → send as turn-by-turn content
                    live_queue.send_content(types.Content(
                        role="user",
                        parts=[types.Part(text=msg["text"])],
                    ))

                elif msg["type"] == "cv_event":
                    # CV engine event → inject as text context
                    cv_text = f"[CV] {json.dumps(msg['event'], ensure_ascii=False)}"
                    live_queue.send_content(types.Content(
                        role="user",
                        parts=[types.Part(text=cv_text)],
                    ))

                elif msg["type"] == "video_frame":
                    # Video frames not supported by native-audio model.
                    # Visual understanding relies on CV engine events instead.
                    # Enable when using a model that supports video input.
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error for user {user_id}: {e}")
        traceback.print_exc()
    finally:
        live_queue.close()
        event_task.cancel()


# Serve frontend static files in production
frontend_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

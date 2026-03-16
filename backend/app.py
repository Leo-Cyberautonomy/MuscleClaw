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

# Global WebSocket registry for tools to push data directly
# (Live mode state_delta doesn't propagate tool state changes)
WS_REGISTRY: dict[str, WebSocket] = {}

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

    # Register WebSocket so tools can push data directly
    WS_REGISTRY[session.id] = websocket

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

    # Initial state push: read user data via a background task
    # (Firestore async reads hang in the main handler context on Cloud Run,
    # so we push initial data as part of the first event cycle instead)
    # The frontend will get data via state_sync when tools are called,
    # or via the function_response fallback in forward_events.

    # Background task: consume events from run_live → forward to WebSocket
    # With auto-retry on transient Gemini API errors (1008, etc.)
    async def forward_events():
        max_retries = 3
        current_session_id = session.id

        for attempt in range(max_retries):
            try:
                async for event in runner.run_live(
                    user_id=user_id,
                    session_id=current_session_id,
                    live_request_queue=live_queue,
                    run_config=run_config,
                ):
                    if event.content and event.content.parts:
                        for part in event.content.parts:
                            if (part.inline_data
                                    and part.inline_data.mime_type
                                    and part.inline_data.mime_type.startswith("audio/")):
                                await websocket.send_bytes(part.inline_data.data)
                            elif part.text and not event.partial:
                                await websocket.send_json({
                                    "type": "transcript",
                                    "role": "model",
                                    "text": part.text,
                                })

                    # Data layer: push state changes to frontend
                    if event.actions:
                        if event.actions.state_delta:
                            print(f"[WS] state_delta keys: {list(event.actions.state_delta.keys())}")
                    if event.actions and event.actions.state_delta:
                        for key, value in event.actions.state_delta.items():
                            # current_plan, user:body_profile etc. are pushed directly by tools
                            # via _push_to_frontend. Only forward keys NOT handled by direct push.
                            # Skip current_plan to avoid null override race condition.
                            if key == "current_plan":
                                continue
                            if key.startswith("user:") or key.startswith("temp:"):
                                await websocket.send_json({
                                    "type": "state_sync",
                                    "key": key,
                                    "data": value,
                                })

                    # All tool data is pushed directly by _push_to_frontend() in tools.
                    # No fn_responses or function_calls processing needed here.
                    # This eliminates race conditions where state_delta null values
                    # overwrite data that was already pushed by the tool.

                # Normal exit — stream ended cleanly
                break

            except asyncio.CancelledError:
                print(f"[Live] Cancelled for user {user_id}")
                return
            except Exception as e:
                print(f"[Live] ERROR for user {user_id} (attempt {attempt+1}/{max_retries}): {type(e).__name__}: {e}")
                if attempt < max_retries - 1:
                    # Create a fresh session and retry
                    await asyncio.sleep(1)
                    try:
                        new_session = await session_service.create_session(
                            app_name="muscleclaw", user_id=user_id
                        )
                        current_session_id = new_session.id
                        print(f"[Live] Retrying with new session {current_session_id[:8]}...")
                    except Exception as retry_err:
                        print(f"[Live] Failed to create retry session: {retry_err}")
                        break
                else:
                    traceback.print_exc()
                    # Show user-friendly message instead of raw API error
                    err_str = str(e)
                    if "1008" in err_str:
                        user_msg = "AI voice service temporarily unavailable. Please try again in a moment."
                    elif "1007" in err_str:
                        user_msg = "Connection error. Please refresh the page."
                    else:
                        user_msg = f"Connection lost. Attempting to reconnect... ({type(e).__name__})"
                    try:
                        await websocket.send_json({
                            "type": "transcript",
                            "role": "model",
                            "text": user_msg,
                        })
                    except Exception:
                        pass

    event_task = asyncio.create_task(forward_events())

    # Audio sample rate from browser (may be 16k, 44.1k, or 48k)
    audio_sample_rate = 16000

    try:
        while True:
            data = await websocket.receive()

            if "bytes" in data and data["bytes"]:
                # Audio binary from browser mic → Gemini Live
                live_queue.send_realtime(types.Blob(
                    mime_type=f"audio/pcm;rate={audio_sample_rate}",
                    data=data["bytes"],
                ))

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])

                if msg["type"] == "audio_config":
                    # Browser reports actual mic sample rate
                    audio_sample_rate = int(msg.get("sample_rate", 16000))
                    print(f"[WS] Audio sample rate: {audio_sample_rate}Hz")

                elif msg["type"] == "text":
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
        # Unregister WebSocket
        WS_REGISTRY.pop(session.id, None)


# Serve frontend static files in production
frontend_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

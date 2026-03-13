"""MuscleClaw FastAPI backend — bridges frontend WebSocket to ADK agent."""
import asyncio
import json
import os
import pathlib

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.main_agent import root_agent
from config.exercise_library import EXERCISE_LIBRARY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session service
session_service = InMemorySessionService()

runner = Runner(
    app_name="muscleclaw",
    agent=root_agent,
    session_service=session_service,
)


@app.get("/health")
async def health():
    return {"status": "ok", "agent": "muscleclaw"}


@app.get("/api/exercises")
async def get_exercises():
    return {"data": EXERCISE_LIBRARY}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await websocket.accept()

    # Get or create session
    sessions = await session_service.list_sessions(app_name="muscleclaw", user_id=user_id)
    if sessions and sessions.sessions:
        session = sessions.sessions[0]
    else:
        session = await session_service.create_session(
            app_name="muscleclaw", user_id=user_id
        )

    await websocket.send_json({
        "type": "connected",
        "session_id": session.id,
    })

    try:
        while True:
            data = await websocket.receive()

            if "bytes" in data and data["bytes"]:
                # Binary audio from frontend — forward to Gemini
                # TODO: integrate with ADK run_live for bidi-streaming
                pass

            elif "text" in data and data["text"]:
                msg = json.loads(data["text"])

                if msg["type"] == "text":
                    # Text message → run agent
                    async for event in runner.run_async(
                        user_id=user_id,
                        session_id=session.id,
                        new_message=types.Content(
                            role="user",
                            parts=[types.Part(text=msg["text"])]
                        ),
                    ):
                        if event.content and event.content.parts:
                            for part in event.content.parts:
                                if part.text:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "model",
                                        "text": part.text,
                                    })

                elif msg["type"] == "cv_event":
                    # CV event → inject as user message
                    cv_text = f"[CV] {json.dumps(msg['event'], ensure_ascii=False)}"
                    async for event in runner.run_async(
                        user_id=user_id,
                        session_id=session.id,
                        new_message=types.Content(
                            role="user",
                            parts=[types.Part(text=cv_text)]
                        ),
                    ):
                        if event.content and event.content.parts:
                            for part in event.content.parts:
                                if part.text:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "role": "model",
                                        "text": part.text,
                                    })

                elif msg["type"] == "video_frame":
                    # Video frame — will integrate with run_live for Gemini vision
                    pass

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[WS] Error for user {user_id}: {e}")


# Serve frontend static files in production
frontend_dist = pathlib.Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

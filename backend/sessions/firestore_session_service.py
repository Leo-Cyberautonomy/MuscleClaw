"""Firestore-backed ADK SessionService for Cloud Run deployment.

Stores session state in Google Cloud Firestore for true persistence
across stateless container restarts. State is scoped per ADK convention:
  - app:{key}   → apps/{app_name}/app_state
  - user:{key}  → apps/{app_name}/users/{user_id}/user_state
  - {key}       → apps/{app_name}/users/{user_id}/sessions/{session_id}
  - temp:{key}  → not persisted (handled by base class)
"""

from __future__ import annotations

import asyncio
import logging
from copy import deepcopy
from typing import Any, Optional

from google.adk.events.event import Event
from google.adk.sessions.base_session_service import (
    BaseSessionService,
    GetSessionConfig,
    ListSessionsResponse,
)
from google.adk.sessions.session import Session
from google.adk.sessions._session_util import extract_state_delta
from google.cloud.firestore import AsyncClient as AsyncFirestore

logger = logging.getLogger(__name__)


def _merge_state(
    app_state: dict[str, Any],
    user_state: dict[str, Any],
    session_state: dict[str, Any],
) -> dict[str, Any]:
    """Merge three state scopes into a single dict with correct prefixes."""
    merged = deepcopy(session_state)
    for key, value in app_state.items():
        merged[f"app:{key}"] = value
    for key, value in user_state.items():
        merged[f"user:{key}"] = value
    return merged


class FirestoreSessionService(BaseSessionService):
    """ADK SessionService backed by Google Cloud Firestore.

    Collection structure:
        apps/{app_name}/app_state          — single doc with app-level state
        apps/{app_name}/users/{user_id}
            /user_state                    — single doc with user-level state
            /sessions/{session_id}         — session doc with session-level state
            /sessions/{session_id}/events  — subcollection of event docs
    """

    def __init__(self, *, project: Optional[str] = None):
        self._db = AsyncFirestore(project=project)
        self._locks: dict[str, asyncio.Lock] = {}

    def _session_lock(self, session_id: str) -> asyncio.Lock:
        if session_id not in self._locks:
            self._locks[session_id] = asyncio.Lock()
        return self._locks[session_id]

    # ── Collection references ──────────────────────────────────────

    def _app_state_ref(self, app_name: str):
        return self._db.collection("apps").document(app_name).collection("meta").document("app_state")

    def _user_state_ref(self, app_name: str, user_id: str):
        return (
            self._db.collection("apps").document(app_name)
            .collection("users").document(user_id)
            .collection("meta").document("user_state")
        )

    def _session_ref(self, app_name: str, user_id: str, session_id: str):
        return (
            self._db.collection("apps").document(app_name)
            .collection("users").document(user_id)
            .collection("sessions").document(session_id)
        )

    def _events_col(self, app_name: str, user_id: str, session_id: str):
        return self._session_ref(app_name, user_id, session_id).collection("events")

    # ── State helpers ──────────────────────────────────────────────

    async def _get_app_state(self, app_name: str) -> dict[str, Any]:
        doc = await self._app_state_ref(app_name).get()
        return doc.to_dict() or {} if doc.exists else {}

    async def _get_user_state(self, app_name: str, user_id: str) -> dict[str, Any]:
        doc = await self._user_state_ref(app_name, user_id).get()
        return doc.to_dict() or {} if doc.exists else {}

    async def _get_session_state(
        self, app_name: str, user_id: str, session_id: str
    ) -> Optional[dict[str, Any]]:
        doc = await self._session_ref(app_name, user_id, session_id).get()
        if not doc.exists:
            return None
        return doc.to_dict() or {}

    # ── CRUD ───────────────────────────────────────────────────────

    async def create_session(
        self,
        *,
        app_name: str,
        user_id: str,
        state: Optional[dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Session:
        import time
        from google.adk.utils import platform_uuid

        if session_id is None:
            session_id = platform_uuid.new_uuid()

        # Check for existing session
        existing = await self._session_ref(app_name, user_id, session_id).get()
        if existing.exists:
            from google.adk.errors import AlreadyExistsError
            raise AlreadyExistsError(f"Session {session_id} already exists")

        now = time.time()

        # Split initial state into scoped deltas
        deltas = extract_state_delta(state or {})

        # Persist each scope
        if deltas["app"]:
            await self._app_state_ref(app_name).set(deltas["app"], merge=True)
        if deltas["user"]:
            await self._user_state_ref(app_name, user_id).set(deltas["user"], merge=True)

        session_data = {
            **deltas["session"],
            "_update_time": now,
        }
        await self._session_ref(app_name, user_id, session_id).set(session_data)

        # Build merged state for the returned Session object
        app_state = await self._get_app_state(app_name)
        user_state = await self._get_user_state(app_name, user_id)
        merged = _merge_state(app_state, user_state, deltas["session"])

        return Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=merged,
            events=[],
            last_update_time=now,
        )

    async def get_session(
        self,
        *,
        app_name: str,
        user_id: str,
        session_id: str,
        config: Optional[GetSessionConfig] = None,
    ) -> Optional[Session]:
        session_data = await self._get_session_state(app_name, user_id, session_id)
        if session_data is None:
            return None

        update_time = session_data.pop("_update_time", 0.0)

        # Fetch events
        events_col = self._events_col(app_name, user_id, session_id)
        query = events_col.order_by("_timestamp")

        if config and config.after_timestamp:
            query = query.where("_timestamp", ">", config.after_timestamp)

        event_docs = []
        async for doc in query.stream():
            event_docs.append(doc)

        if config and config.num_recent_events is not None:
            event_docs = event_docs[-config.num_recent_events:]

        events = []
        for doc in event_docs:
            data = doc.to_dict()
            data.pop("_timestamp", None)
            events.append(Event.model_validate(data))

        # Merge state
        app_state = await self._get_app_state(app_name)
        user_state = await self._get_user_state(app_name, user_id)
        merged = _merge_state(app_state, user_state, session_data)

        return Session(
            id=session_id,
            app_name=app_name,
            user_id=user_id,
            state=merged,
            events=events,
            last_update_time=update_time,
        )

    async def list_sessions(
        self, *, app_name: str, user_id: Optional[str] = None
    ) -> ListSessionsResponse:
        sessions: list[Session] = []

        if user_id:
            user_ids = [user_id]
        else:
            # List all users under this app
            users_col = self._db.collection("apps").document(app_name).collection("users")
            user_ids = []
            async for doc in users_col.list_documents():
                user_ids.append(doc.id)

        app_state = await self._get_app_state(app_name)

        for uid in user_ids:
            user_state = await self._get_user_state(app_name, uid)
            sessions_col = (
                self._db.collection("apps").document(app_name)
                .collection("users").document(uid)
                .collection("sessions")
            )
            async for doc in sessions_col.stream():
                data = doc.to_dict() or {}
                update_time = data.pop("_update_time", 0.0)
                merged = _merge_state(app_state, user_state, data)
                sessions.append(Session(
                    id=doc.id,
                    app_name=app_name,
                    user_id=uid,
                    state=merged,
                    events=[],
                    last_update_time=update_time,
                ))

        return ListSessionsResponse(sessions=sessions)

    async def delete_session(
        self, *, app_name: str, user_id: str, session_id: str
    ) -> None:
        # Delete all events first
        events_col = self._events_col(app_name, user_id, session_id)
        async for doc in events_col.stream():
            await doc.reference.delete()

        # Delete the session document
        await self._session_ref(app_name, user_id, session_id).delete()

    async def append_event(self, session: Session, event: Event) -> Event:
        if event.partial:
            return event

        # Apply temp state before trimming (base class logic)
        self._apply_temp_state(session, event)
        event = self._trim_temp_delta_state(event)

        async with self._session_lock(session.id):
            import time
            now = time.time()

            # Extract state deltas from event
            if event.actions and event.actions.state_delta:
                deltas = extract_state_delta(event.actions.state_delta)

                if deltas["app"]:
                    await self._app_state_ref(session.app_name).set(
                        deltas["app"], merge=True
                    )
                if deltas["user"]:
                    await self._user_state_ref(
                        session.app_name, session.user_id
                    ).set(deltas["user"], merge=True)
                if deltas["session"]:
                    await self._session_ref(
                        session.app_name, session.user_id, session.id
                    ).set({**deltas["session"], "_update_time": now}, merge=True)
                else:
                    await self._session_ref(
                        session.app_name, session.user_id, session.id
                    ).set({"_update_time": now}, merge=True)
            else:
                await self._session_ref(
                    session.app_name, session.user_id, session.id
                ).set({"_update_time": now}, merge=True)

            # Persist event
            event_data = event.model_dump(mode="json", by_alias=True, exclude_none=True)
            event_data["_timestamp"] = now
            await self._events_col(
                session.app_name, session.user_id, session.id
            ).add(event_data)

            session.last_update_time = now

        # Update in-memory state
        self._update_session_state(session, event)
        session.events.append(event)
        return event

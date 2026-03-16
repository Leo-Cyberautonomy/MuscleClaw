"""Seed realistic user data into Firestore for the browser user."""
import json
import requests
import subprocess
from datetime import datetime, timedelta, timezone

UID = "400a5699-d0e3-4794-9b60-49a4ddbdf62c"
PROJECT = "muscleclaw"
now = datetime.now(timezone.utc)


def get_token():
    return subprocess.check_output([
        "C:/Users/Leo23/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd",
        "auth", "print-access-token", "--project", PROJECT,
    ]).decode().strip()


def make_session(days_ago, exercises_data):
    d = now - timedelta(days=days_ago)
    return {
        "id": f"session-{days_ago}",
        "date": d.strftime("%Y-%m-%d"),
        "start_time": d.replace(hour=18, minute=0).isoformat(),
        "end_time": d.replace(hour=19, minute=15).isoformat(),
        "exercises": exercises_data,
    }


def make_sets(data):
    return [
        {
            "set_number": i + 1, "reps": r, "weight": w,
            "rpe": rpe, "rom_avg_degrees": rom, "symmetry_score": sym,
        }
        for i, (w, r, rpe, rom, sym) in enumerate(data)
    ]


# ── Body Profile ──
# Bench 100kg, Pull-up BW+65kg, Deadlift 150kg
# OHP ~62.5kg, Squat ~125kg, Row ~80kg, Curl ~42.5kg
# Chest & Back: 100% recovered (4 days ago)
# Shoulders & Arms: ~75% (2 days ago)
# Legs & Core: ~60% (yesterday)
body_profile = {
    "chest": {
        "max_weight": 100, "exercise": "bench_press",
        "last_trained": (now - timedelta(days=4)).strftime("%Y-%m-%d"),
        "recovery_hours": 72, "recovery_status": "recovered",
        "notes": "PR 100kg hit last week. Solid progress.",
    },
    "back": {
        "max_weight": 80, "exercise": "barbell_row",
        "last_trained": (now - timedelta(days=4)).strftime("%Y-%m-%d"),
        "recovery_hours": 72, "recovery_status": "recovered",
        "notes": "Row PR: 80kg. Weighted pull-up PR: BW+65kg.",
    },
    "shoulders": {
        "max_weight": 62.5, "exercise": "ohp",
        "last_trained": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
        "recovery_hours": 60, "recovery_status": "recovering",
        "notes": "OHP progressing steadily.",
    },
    "legs": {
        "max_weight": 125, "exercise": "squat",
        "last_trained": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
        "recovery_hours": 84, "recovery_status": "recovering",
        "notes": "Squat 125kg. Deadlift PR: 150kg.",
    },
    "core": {
        "max_weight": 0, "exercise": "plank",
        "last_trained": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
        "recovery_hours": 24, "recovery_status": "recovering",
        "notes": "3min plank hold. Trained with leg day.",
    },
    "arms": {
        "max_weight": 42.5, "exercise": "barbell_curl",
        "last_trained": (now - timedelta(days=2)).strftime("%Y-%m-%d"),
        "recovery_hours": 36, "recovery_status": "recovering",
        "notes": "Curl PR: 42.5kg. Trained with shoulders.",
    },
}

# ── Training History (3 weeks, 10 sessions) ──
training_history = [
    # Week 3: base phase
    make_session(20, [
        {"exercise_id": "bench_press", "sets": make_sets([
            (80, 8, 6.5, 142, 97), (85, 6, 7, 140, 96),
            (85, 6, 7.5, 138, 95), (90, 5, 8, 135, 94),
        ])},
        {"exercise_id": "barbell_row", "sets": make_sets([
            (60, 8, 6, 88, 96), (65, 8, 7, 86, 95), (70, 6, 7.5, 85, 94),
        ])},
    ]),
    make_session(18, [
        {"exercise_id": "squat", "sets": make_sets([
            (100, 6, 7, 92, 97), (105, 5, 7.5, 90, 96),
            (110, 4, 8, 88, 95), (110, 4, 8.5, 87, 94),
        ])},
        {"exercise_id": "deadlift", "sets": make_sets([
            (120, 5, 7, 162, 96), (130, 3, 8, 158, 95), (135, 3, 8.5, 155, 94),
        ])},
    ]),
    make_session(16, [
        {"exercise_id": "ohp", "sets": make_sets([
            (45, 8, 6, 158, 96), (50, 6, 7, 155, 95),
            (52.5, 5, 7.5, 152, 94), (55, 4, 8, 150, 93),
        ])},
        {"exercise_id": "barbell_curl", "sets": make_sets([
            (30, 10, 6, 128, 97), (35, 8, 7, 125, 96), (37.5, 6, 7.5, 122, 95),
        ])},
    ]),
    # Week 2: volume phase
    make_session(13, [
        {"exercise_id": "bench_press", "sets": make_sets([
            (85, 6, 7, 143, 97), (90, 5, 7.5, 140, 96),
            (92.5, 4, 8, 138, 95), (95, 3, 8.5, 136, 94),
        ])},
        {"exercise_id": "barbell_row", "sets": make_sets([
            (65, 8, 6.5, 89, 96), (70, 6, 7, 87, 95),
            (72.5, 6, 7.5, 86, 95), (75, 5, 8, 84, 94),
        ])},
    ]),
    make_session(11, [
        {"exercise_id": "squat", "sets": make_sets([
            (105, 6, 7, 91, 97), (110, 5, 7.5, 89, 96),
            (115, 4, 8, 87, 95), (115, 4, 8.5, 86, 94),
        ])},
        {"exercise_id": "deadlift", "sets": make_sets([
            (130, 4, 7.5, 160, 96), (140, 3, 8, 157, 95), (145, 2, 9, 154, 93),
        ])},
    ]),
    make_session(9, [
        {"exercise_id": "ohp", "sets": make_sets([
            (50, 6, 7, 157, 96), (55, 5, 7.5, 154, 95),
            (57.5, 4, 8, 151, 94), (60, 3, 8.5, 148, 93),
        ])},
        {"exercise_id": "barbell_curl", "sets": make_sets([
            (32.5, 10, 6, 129, 97), (37.5, 8, 7, 126, 96), (40, 6, 7.5, 123, 95),
        ])},
    ]),
    # Last week: PR week
    make_session(6, [
        {"exercise_id": "bench_press", "sets": make_sets([
            (90, 5, 7, 144, 97), (95, 4, 8, 141, 96),
            (97.5, 3, 8.5, 139, 95), (100, 2, 9.5, 136, 94),
        ])},
        {"exercise_id": "barbell_row", "sets": make_sets([
            (70, 6, 7, 90, 96), (75, 5, 7.5, 88, 95),
            (77.5, 5, 8, 86, 94), (80, 4, 8.5, 84, 93),
        ])},
    ]),
    # 4 days ago: chest+back deload (matches body_profile)
    make_session(4, [
        {"exercise_id": "bench_press", "sets": make_sets([
            (85, 6, 6.5, 145, 97), (90, 5, 7, 142, 96),
            (90, 5, 7.5, 140, 96), (85, 6, 7, 143, 97),
        ])},
        {"exercise_id": "barbell_row", "sets": make_sets([
            (65, 8, 6, 91, 97), (70, 6, 7, 89, 96), (75, 5, 7.5, 87, 95),
        ])},
    ]),
    # 2 days ago: shoulders + arms
    make_session(2, [
        {"exercise_id": "ohp", "sets": make_sets([
            (52.5, 6, 7, 158, 96), (57.5, 5, 7.5, 155, 95),
            (60, 4, 8, 152, 94), (62.5, 3, 9, 148, 93),
        ])},
        {"exercise_id": "barbell_curl", "sets": make_sets([
            (35, 8, 6.5, 130, 97), (40, 6, 7, 127, 96), (42.5, 5, 8, 124, 95),
        ])},
    ]),
    # Yesterday: legs + core
    make_session(1, [
        {"exercise_id": "squat", "sets": make_sets([
            (110, 5, 7.5, 91, 97), (115, 4, 8, 89, 96),
            (120, 3, 8.5, 87, 95), (125, 2, 9.5, 85, 93),
        ])},
        {"exercise_id": "deadlift", "sets": make_sets([
            (135, 3, 8, 161, 96), (145, 2, 8.5, 158, 95), (150, 1, 10, 155, 93),
        ])},
    ]),
]

# ── Preferences ──
preferences = {
    "personality_mode": "trash_talk",
    "language": "en",
    "emergency_contact": "999",
    "rest_timer_seconds": 120,
    "ai_volume": 70,
    "safety_sensitivity": "medium",
    "voice_name": "Charon",
    "onboarding_completed": True,
}

# ── Write to Firestore ──
def to_fv(v):
    """Convert Python value to Firestore REST API format."""
    if isinstance(v, bool):
        return {"booleanValue": v}
    elif isinstance(v, int):
        return {"integerValue": str(v)}
    elif isinstance(v, float):
        return {"doubleValue": v}
    elif isinstance(v, str):
        return {"stringValue": v}
    elif isinstance(v, list):
        return {"arrayValue": {"values": [to_fv(i) for i in v]}}
    elif isinstance(v, dict):
        return {"mapValue": {"fields": {k: to_fv(val) for k, val in v.items()}}}
    elif v is None:
        return {"nullValue": None}
    return {"stringValue": str(v)}


token = get_token()
base = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

doc_path = f"{base}/apps/muscleclaw/users/{UID}/meta/user_state"
payload = {
    "fields": {
        "body_profile": to_fv(body_profile),
        "training_history": to_fv(training_history),
        "preferences": to_fv(preferences),
    }
}

r = requests.patch(doc_path, headers=h, json=payload)
if r.status_code == 200:
    print("SUCCESS: All data written")
    print(f"  User: {UID}")
    print(f"  Body profile: 6 parts")
    print(f"    Chest: 100kg (recovered)")
    print(f"    Back: 80kg row / BW+65kg pull-up (recovered)")
    print(f"    Shoulders: 62.5kg OHP (recovering, 2 days ago)")
    print(f"    Legs: 125kg squat / 150kg deadlift (recovering, yesterday)")
    print(f"    Core: plank (recovering, yesterday)")
    print(f"    Arms: 42.5kg curl (recovering, 2 days ago)")
    print(f"  Training history: {len(training_history)} sessions over 3 weeks")
    print(f"  Emergency contact: 999")
    print(f"  Personality: trash_talk (Charon voice)")
else:
    print(f"ERROR {r.status_code}: {r.text[:300]}")

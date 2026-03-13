DEFAULT_BODY_PROFILE = {
    "chest":     {"max_weight": 0, "exercise": "bench_press",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": ""},
    "shoulders": {"max_weight": 0, "exercise": "ohp",          "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": ""},
    "back":      {"max_weight": 0, "exercise": "barbell_row",  "last_trained": "", "recovery_hours": 72, "recovery_status": "recovered", "notes": ""},
    "legs":      {"max_weight": 0, "exercise": "squat",        "last_trained": "", "recovery_hours": 96, "recovery_status": "recovered", "notes": ""},
    "core":      {"max_weight": 0, "exercise": "plank",        "last_trained": "", "recovery_hours": 24, "recovery_status": "recovered", "notes": ""},
    "arms":      {"max_weight": 0, "exercise": "barbell_curl", "last_trained": "", "recovery_hours": 48, "recovery_status": "recovered", "notes": ""},
}

DEFAULT_PREFERENCES = {
    "personality_mode": "trash_talk",
    "language": "zh-CN",
    "emergency_contact": "",
    "rest_timer_seconds": 120,
    "ai_volume": 70,
    "safety_sensitivity": "medium",
    "voice_name": "Charon",
    "onboarding_completed": False,
}

VOICE_MAP = {
    "professional": "Puck",
    "gentle": "Kore",
    "trash_talk": "Charon",
}

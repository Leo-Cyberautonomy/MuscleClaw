EXERCISE_LIBRARY = {
    "bench_press": {
        "name": "卧推", "name_en": "Bench Press",
        "primary_muscles": ["chest"], "secondary_muscles": ["shoulders", "arms"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 140, "symmetry_threshold_degrees": 10,
    },
    "squat": {
        "name": "深蹲", "name_en": "Squat",
        "primary_muscles": ["legs"], "secondary_muscles": ["core"],
        "tracking_joints": [
            {"joint_a": "LEFT_HIP", "joint_b": "LEFT_KNEE", "joint_c": "LEFT_ANKLE"},
            {"joint_a": "RIGHT_HIP", "joint_b": "RIGHT_KNEE", "joint_c": "RIGHT_ANKLE"},
        ],
        "rom_threshold_degrees": 90, "symmetry_threshold_degrees": 8,
    },
    "deadlift": {
        "name": "硬拉", "name_en": "Deadlift",
        "primary_muscles": ["back", "legs"], "secondary_muscles": ["core"],
        "tracking_joints": [
            {"joint_a": "LEFT_HIP", "joint_b": "LEFT_KNEE", "joint_c": "LEFT_ANKLE"},
            {"joint_a": "RIGHT_HIP", "joint_b": "RIGHT_KNEE", "joint_c": "RIGHT_ANKLE"},
        ],
        "rom_threshold_degrees": 160, "symmetry_threshold_degrees": 10,
    },
    "ohp": {
        "name": "推举", "name_en": "Overhead Press",
        "primary_muscles": ["shoulders"], "secondary_muscles": ["arms", "core"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 160, "symmetry_threshold_degrees": 10,
    },
    "barbell_row": {
        "name": "杠铃划船", "name_en": "Barbell Row",
        "primary_muscles": ["back"], "secondary_muscles": ["arms"],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 90, "symmetry_threshold_degrees": 10,
    },
    "barbell_curl": {
        "name": "杠铃弯举", "name_en": "Barbell Curl",
        "primary_muscles": ["arms"], "secondary_muscles": [],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_ELBOW", "joint_c": "LEFT_WRIST"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_ELBOW", "joint_c": "RIGHT_WRIST"},
        ],
        "rom_threshold_degrees": 130, "symmetry_threshold_degrees": 10,
    },
    "plank": {
        "name": "平板支撑", "name_en": "Plank",
        "primary_muscles": ["core"], "secondary_muscles": [],
        "tracking_joints": [
            {"joint_a": "LEFT_SHOULDER", "joint_b": "LEFT_HIP", "joint_c": "LEFT_ANKLE"},
            {"joint_a": "RIGHT_SHOULDER", "joint_b": "RIGHT_HIP", "joint_c": "RIGHT_ANKLE"},
        ],
        "rom_threshold_degrees": 170, "symmetry_threshold_degrees": 5,
    },
}

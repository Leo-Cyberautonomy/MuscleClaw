# MuscleClaw Tool Architecture Analysis

**Date:** 2026-03-17
**Scope:** Complete mapping of 12 tools, data flows, business logic, and Gemini prompt potential

---

## Executive Summary

MuscleClaw uses a **hybrid dual-model architecture**:
1. **Audio model** (gemini-2.5-flash-native-audio): Handles voice I/O and personality only
2. **Text model** (gemini-2.5-flash): Routes user intent to tools with 95% reliability
3. **Tools** (12 functions): Execute business logic, manipulate session.state, and push directly to frontend

**Key insight:** Tools currently contain **some business logic that could migrate to Gemini** (plan generation, posture analysis, safety decision-making), while data CRUD operations (body_profile, training_history) appropriately stay in tools.

---

## Tool Inventory & Architecture

### Tool 1: `get_body_profile`

| Category | Detail |
|----------|--------|
| **Reads from session.state** | `user:body_profile` (6 muscle groups: chest, shoulders, back, legs, core, arms) |
| **Writes to session.state** | None (read-only) |
| **Pushes to frontend** | `_push_to_frontend(ctx, "user:body_profile", profile)` → ADK → appStore.setBodyProfile() |
| **Business logic** | Formats 6-part dict into human-readable text (part, exercise name, PR weight, recovery status, last_trained date). No calculations. |
| **Can move to Gemini?** | **NO** — This is data retrieval with formatting. Tool ownership of state is correct. |
| **Data format expected by frontend** | `{ "chest": { "max_weight": 0, "exercise": "bench_press", "recovery_status": "recovered", "last_trained": "" }, ... }` |

---

### Tool 2: `update_body_profile`

| Category | Detail |
|----------|--------|
| **Parameters** | `part` (chest\|shoulders\|back\|legs\|core\|arms), `max_weight` (float, optional), `last_trained` (str, optional), `notes` (str, optional) |
| **Reads from session.state** | `user:body_profile` |
| **Writes to session.state** | Updates `user:body_profile[part]` with new max_weight (only if greater), last_trained, recovery_status="recovering", notes |
| **Firestore persistence** | Via `_push_to_frontend()` → strips "user:" prefix → writes to Firestore |
| **Pushes to frontend** | Same dict structure as Tool 1 |
| **Business logic** | Progressive overload check: only accepts new max_weight if > old max_weight. Sets recovery_status="recovering" when trained. |
| **Can move to Gemini?** | **NO** — This is data mutation. Tools own state writes. |

---

### Tool 3: `get_training_history`

| Category | Detail |
|----------|--------|
| **Parameters** | `days` (int, default 30), `exercise_id` (str, optional for filtering) |
| **Reads from session.state** | `user:training_history` (array of session objects) |
| **Writes to session.state** | None (read-only) |
| **Pushes to frontend** | None (formatting only for voice) |
| **Business logic** | Filters history by days (ignored in code) and optionally by exercise_id. Extracts last 10 sessions, summarizes each: date, exercise_id, set count, max weight, total reps. |
| **Can move to Gemini?** | **NO** — Read-only data retrieval. |
| **Data format expected by frontend** | `{ "id": "uuid", "date": "2026-03-17", "start_time": "ISO", "exercises": [{ "exercise_id": "bench_press", "sets": [{ "set_number": 1, "reps": 8, "weight": 80, "rpe": 8 }] }] }` |

---

### Tool 4: `record_training_set`

| Category | Detail |
|----------|--------|
| **Parameters** | `exercise_id` (str), `set_number` (int), `reps` (int), `weight` (float), `rpe` (float, optional), `rom_avg_degrees` (float, optional), `symmetry_score` (float, optional) |
| **Reads from session.state** | `user:training_history` |
| **Writes to session.state** | Creates/updates today's session in `user:training_history`, appends set object to exercise record, updates `start_time` on first set |
| **Firestore persistence** | Via `_push_to_frontend()` |
| **Pushes to frontend** | Full `user:training_history` array |
| **Business logic** | Session grouping: finds or creates today's session (by date), finds or creates exercise record within session, appends set. Handles UUID generation for new sessions. |
| **Can move to Gemini?** | **NO** — Core data mutation: session/exercise/set creation logic must stay in tool. |

---

### Tool 5: `generate_training_plan`

| Category | Detail |
|----------|--------|
| **Parameters** | `target_parts` (comma-separated string: "chest,back" or empty for auto) |
| **Reads from session.state** | `user:body_profile`, `user:training_history` |
| **Writes to session.state** | `current_plan` with full plan object |
| **Pushes to frontend** | `_push_to_frontend(ctx, "current_plan", plan)` + auto-chain: `send_ui_command(ctx, "switch_mode", '{"mode":"planning"}')` |
| **Business logic** | **SIGNIFICANT LOGIC HERE**: <br> 1. Auto-detect target parts if not specified (parts with recovery_status=="recovered", fallback to chest+back)<br> 2. Build profile summary for Gemini<br> 3. Fetch recent 5 sessions, max weight per exercise<br> 4. Build available exercises list from EXERCISE_LIBRARY<br> 5. **Call Gemini 2.5 Flash** with complex prompt demanding JSON output<br> 6. Parse JSON response into plan structure: `{ "target_parts": [...], "exercises": [{ "exercise_id", "name", "name_en", "primary_muscles", "secondary_muscles", "target_sets", "target_reps", "target_weight", "completed_sets" }] }`<br> 7. Fallback: If Gemini fails, generate deterministic plan (85% of PR, 4x6 sets/reps) |
| **Can move to Gemini?** | **PARTIALLY** — Gemini already does exercise selection + weight calculation. But **requires tool ownership of**: session grouping (recovery detection), auto-target-parts logic. <br><br> **Proposal:** Keep tool structure (detection + Gemini call), but move deterministic fallback to Gemini prompt instead of code. |
| **Data format expected by frontend** | `{ "target_parts": ["chest", "back"], "exercises": [...] }` → trainingStore.setTrainingPlan() |

---

### Tool 6: `trigger_safety_alert`

| Category | Detail |
|----------|--------|
| **Parameters** | `alert_type` (barbell_stall\|body_collapse\|unresponsive), `countdown_seconds` (int, default 10) |
| **Reads from session.state** | `user:preferences` for emergency_contact |
| **Writes to session.state** | `safety_alert_active=True`, `safety_countdown=countdown_seconds` |
| **Pushes to frontend** | `ui_command` with command="show_safety_alert", data.countdown_seconds |
| **Business logic** | **Minimal logic.** Sets state flags. Checks if emergency contact exists, returns different message. **CRITICAL SAFETY DECISION** (deciding to trigger) is delegated to Gemini prompt (CV events trigger this tool call). |
| **Can move to Gemini?** | **NO** — Tool execution confirms the alert. Decision-making lives in Gemini system instruction. |

---

### Tool 7: `cancel_safety_alert`

| Category | Detail |
|----------|--------|
| **Parameters** | None |
| **Reads from session.state** | None |
| **Writes to session.state** | `safety_alert_active=False` |
| **Pushes to frontend** | `ui_command` with command="cancel_safety_alert" |
| **Business logic** | Simple state reset. |
| **Can move to Gemini?** | **NO** — This is state mutation. |

---

### Tool 8: `get_user_preferences`

| Category | Detail |
|----------|--------|
| **Parameters** | None |
| **Reads from session.state** | `user:preferences` |
| **Writes to session.state** | None |
| **Pushes to frontend** | None (formatting for voice only) |
| **Business logic** | Formats preferences dict into human-readable text. |
| **Can move to Gemini?** | **NO** — Read-only data retrieval. |
| **Data format expected by frontend** | `{ "personality_mode": "trash_talk", "language": "zh-CN", "emergency_contact": "", "rest_timer_seconds": 120, "voice_name": "Charon" }` |

---

### Tool 9: `update_user_preferences`

| Category | Detail |
|----------|--------|
| **Parameters** | `personality_mode` (professional\|gentle\|trash_talk), `language` (str), `emergency_contact` (str), `rest_timer_seconds` (int), `safety_sensitivity` (str) |
| **Reads from session.state** | `user:preferences` |
| **Writes to session.state** | Conditionally updates fields in `user:preferences`. **Maps personality_mode → voice_name via VOICE_MAP**. |
| **Firestore persistence** | Via `_push_to_frontend()` |
| **Pushes to frontend** | Full `user:preferences` dict |
| **Business logic** | Enum mapping: personality_mode → voice_name lookup. Builds "updated" list for voice response. |
| **Can move to Gemini?** | **NO** — Data mutation + voice selection mapping is tool-owned. |

---

### Tool 10: `get_exercise_info`

| Category | Detail |
|----------|--------|
| **Parameters** | `exercise_id` (str, e.g., "bench_press") |
| **Reads from session.state** | None (reads EXERCISE_LIBRARY constant) |
| **Writes to session.state** | None |
| **Pushes to frontend** | None |
| **Business logic** | Lookup exercise_id in EXERCISE_LIBRARY constant. Format name, joints, primary muscles. |
| **Can move to Gemini?** | **NO** — Static reference data. Tool correctly serves as data provider. |
| **Data format** | EXERCISE_LIBRARY structure: `{ "bench_press": { "name_en": "Bench Press", "tracked_joints": ["shoulder", "elbow"], "primary_muscles": ["chest"] } }` |

---

### Tool 11: `analyze_posture`

| Category | Detail |
|----------|--------|
| **Parameters** | `shoulder_tilt_degrees` (float), `pelvis_tilt_degrees` (float), `spine_curvature` (str), `head_forward_cm` (float), `notes` (str) |
| **Reads from session.state** | None |
| **Writes to session.state** | `user:posture_report` with analysis result |
| **Firestore persistence** | Via `_push_to_frontend()` |
| **Pushes to frontend** | `_push_to_frontend(ctx, "user:posture_report", report)` + implicit UI command via state_delta |
| **Business logic** | **ANALYSIS LOGIC**: <br> 1. Threshold checks: shoulder >3°, pelvis >15°, head >3cm, spine any curvature<br> 2. Builds issues list<br> 3. Severity rating: "good" (0 issues), "needs attention" (1-2), "consult specialist" (3+)<br> 4. Returns dict with issues array, count, overall rating |
| **Can move to Gemini?** | **MAYBE** — Thresholds and severity rules could live in Gemini prompt instead of hardcoded. But keeping in tool is fine if thresholds are evidence-based. **Question for user:** Are 3°, 15°, 3cm based on validated biomechanics, or arbitrary? If arbitrary → could move to prompt for flexibility. If scientific → keep in tool. |
| **Data format expected by frontend** | `{ "issues": ["right shoulder elevated 5.2°", ...], "issue_count": 2, "overall": "needs attention", "notes": "..." }` |

---

### Tool 12: `send_ui_command`

| Category | Detail |
|----------|--------|
| **Parameters** | `command` (str), `data_json` (str, optional JSON string) |
| **Reads from session.state** | None |
| **Writes to session.state** | None |
| **Pushes to frontend** | `_push_to_frontend(ctx, "ui_command", { "command": command, "data": parsed_data })` |
| **Business logic** | JSON parse helper: validates data_json, returns error if malformed. |
| **Can move to Gemini?** | **NO** — This is a utility. Gemini calls it when custom UI commands needed. |

---

## Frontend Data Structures

### State Sync Keys (pushed via `_push_to_frontend`)

| Key | Shape | Frontend Store | Handler |
|-----|-------|----------------|---------|
| `user:body_profile` | `{ "chest": { max_weight, exercise, last_trained, recovery_status, ... }, ... }` | `appStore.bodyProfile` | `handleStateSync()` → `setBodyProfile()` |
| `user:training_history` | `[{ id, date, start_time, end_time, exercises: [...] }, ...]` | `trainingStore.trainingHistory` | `setTrainingHistory()` |
| `user:preferences` | `{ personality_mode, language, emergency_contact, rest_timer_seconds, voice_name, ... }` | `appStore.preferences` | `setPreferences()` |
| `user:posture_report` | `{ issues: [...], issue_count, overall, notes }` | `poseStore.postureReport` | `setPostureReport()` |
| `current_plan` | `{ target_parts: [...], exercises: [{ exercise_id, name, name_en, target_sets, target_reps, target_weight, completed_sets }, ...] }` | `trainingStore.trainingPlan` | `setTrainingPlan()` |
| `temp:workflow_step` | User-defined (optional) | `trainingStore.workflowStep` | `setWorkflowStep()` |
| `ui_command` | `{ command, data: {...} }` | Various | `handleUICommand()` |

### UI Commands (routed via `handleUICommand`)

| Command | Data Structure | Frontend Action |
|---------|-----------------|-----------------|
| `switch_mode` | `{ mode: "planning"\|"dashboard"\|"posture"\|... }` | `appStore.setMode(d.mode)` |
| `show_body_panel` | `{ profile: {...} }` | Sets profile + switches to dashboard mode |
| `show_training_plan` | `{ exercises: [...] }` (full plan or partial) | `trainingStore.setTrainingPlan()` + switches to planning mode |
| `show_posture_report` | `{}` (data in state_sync) | Switches to posture mode |
| `show_safety_alert` | `{ countdown_seconds: 10 }` | `uiStore.setSafetyAlert(true, seconds)` |
| `cancel_safety_alert` | `{}` | `uiStore.setSafetyAlert(false)` |
| `start_rest_timer` | `{ seconds: 120 }` | `trainingStore.setRestTimer(seconds)` |
| `update_set_info` | `{ set_number, reps, weight, ... }` | `trainingStore.updateTraining(d)` |

---

## Data Flow Architecture

### Push Mechanism: `_push_to_frontend(ctx, key, data)`

```
Tool execution (main_agent.py)
  ↓
Tool calls _push_to_frontend(ctx, key, data)
  ↓
[Branch 1: WebSocket Push]
  Get WS from WS_REGISTRY[session.id]
  → send_json({ "type": "state_sync", "key": key, "data": data })
  → Browser receives
  → adkClient.handleStateSync(key, data)
  → Route to store (appStore, trainingStore, poseStore, uiStore)

[Branch 2: Firestore Persistence]
  If key.startswith("user:")
    Strip "user:" prefix
    → session_service._user_state_ref()
    → set(ref, {firestore_key: value}, merge=True)
    → Next WebSocket connection loads data via Firestore restore
```

### Tool Call Flow

```
User speaks or types message
  ↓
WebSocket → app.py websocket_endpoint()
  ↓
[Parallel: Voice + Tools]

[Left: Voice Response]
  live_queue.send_content(Content(role="user", text=user_text))
  → Runner.run_live()
  → Audio model (gemini-2.5-flash-native-audio)
  → Speaks response
  → Sends back event.content (audio + transcript)

[Right: Tool Execution]
  asyncio.create_task(_route_and_execute(user_text, session, ws))
  → ToolRouter.route(user_text) [gemini-2.5-flash text model]
  → Returns (tool_name, tool_args)
  → TOOL_MAP[tool_name](ctx, **clean_args)
  → Tool executes, calls _push_to_frontend()
  → Tool returns result_text
  → Inject into live_queue: [TOOL_RESULT] {result_text}
  → Audio model speaks about REAL data (not invented)
```

---

## Business Logic Assessment

### Tools with Minimal Logic (CRUD Only)
- `get_body_profile`: Reads + formats
- `update_body_profile`: Validates max_weight, sets recovery status
- `get_training_history`: Reads + filters + formats
- `record_training_set`: Session grouping logic (creates/appends)
- `trigger_safety_alert`: State flag setter
- `cancel_safety_alert`: State flag resetter
- `get_user_preferences`: Reads + formats
- `update_user_preferences`: Conditional updates + voice mapping
- `get_exercise_info`: Static data lookup
- `send_ui_command`: JSON validation helper

### Tools with Significant Logic
1. **`generate_training_plan`** (60 lines of logic)
   - Auto-detect target parts based on recovery status
   - Build context summaries for Gemini
   - Call Gemini 2.5 Flash for exercise selection + weight calculation
   - Fallback: Deterministic plan if Gemini fails

2. **`analyze_posture`** (20 lines of logic)
   - Threshold-based issue detection
   - Severity rating based on issue count

---

## Opportunities for Logic Migration to Gemini

### Candidate 1: `generate_training_plan` Fallback Logic
**Current:** If Gemini fails, tool generates deterministic plan (85% PR, 4x6)
**Proposal:** Move to Gemini prompt as secondary instruction
**Why:** Reduces tool complexity, keeps all plan logic in one place (Gemini)
**Tradeoff:** Requires Gemini to handle JSON formatting in fallback scenario

### Candidate 2: `analyze_posture` Thresholds
**Current:** Hardcoded thresholds (3°, 15°, 3cm, severities)
**Proposal:** Move to Gemini system instruction if thresholds are not biomechanically grounded
**Why:** Thresholds might need adjustment; easier to tweak in prompt
**Tradeoff:** None, if CV engine provides continuous posture measurements

### Candidate 3: `update_body_profile` Progressive Overload Check
**Current:** Only accept new max_weight if > old max_weight
**Proposal:** Could move to Gemini decision-making
**Why:** Prevents user from logging "failures" (lower weights)
**Tradeoff:** Reduces tool autonomy; Gemini might need to validate every weight update

### Decision Summary
| Logic | Stay in Tool? | Why |
|-------|---------------|-----|
| Session grouping (record_training_set) | ✓ YES | Core data structure; tool owns schema |
| Recovery detection (generate_training_plan) | ✓ YES | Requires consistent body_profile state reading |
| Auto-target-parts logic | ✓ YES | Stateful decision (reads body_profile) |
| Gemini plan generation | ✓ YES | Can't run in Gemini itself; tool bridges |
| Deterministic fallback | ✗ MAYBE | Could move to Gemini prompt |
| Voice name mapping | ✓ YES | Config-driven enum (tool-owned) |
| Progressive overload validation | ✓ YES | Business rule; validates user input |
| Posture thresholds | ✗ MAYBE | Could move to Gemini if not biomechanically grounded |

---

## System Instruction & Personality

### Audio Model System Instruction (LIVE_MODEL)
- **Model:** gemini-2.5-flash-native-audio-preview-12-2025
- **Personality modes:** trash_talk (default), gentle, professional
- **Tool availability:** NONE (no tools declared on agent itself)
- **Input:** [TOOL_RESULT] messages from ToolRouter
- **Output:** Voice response + transcript

### Text Model (ToolRouter)
- **Model:** gemini-2.5-flash
- **Role:** Analyze user intent → decide which tool to call
- **Tool declarations:** 8 function declarations (get_body_profile, update_body_profile, record_training_set, generate_training_plan, update_user_preferences, trigger_safety_alert, cancel_safety_alert, send_ui_command)
- **Fallback:** no_tool_needed (casual chat)
- **Reliability:** ~95% (vs ~50% for native audio model)

---

## Complete Tool Dependency Map

```
User Input
  ↓
ToolRouter.route() [text model]
  ↓
Tool Execution (main_agent.py)

Tool                          Reads                    Writes                      Pushes
────────────────────────────────────────────────────────────────────────────────────────────
get_body_profile              user:body_profile        (none)                      user:body_profile
update_body_profile           user:body_profile        user:body_profile           user:body_profile
get_training_history          user:training_history    (none)                      (none)
record_training_set           user:training_history    user:training_history       user:training_history
generate_training_plan        user:body_profile        current_plan                current_plan
                              user:training_history
                              EXERCISE_LIBRARY         (auto: switch_mode cmd)     ui_command
trigger_safety_alert          user:preferences         safety_alert_active         ui_command
cancel_safety_alert           (none)                   safety_alert_active         ui_command
get_user_preferences          user:preferences         (none)                      (none)
update_user_preferences       user:preferences         user:preferences            user:preferences
get_exercise_info             EXERCISE_LIBRARY         (none)                      (none)
analyze_posture               (none)                   user:posture_report         user:posture_report
send_ui_command               (none)                   (none)                      ui_command
────────────────────────────────────────────────────────────────────────────────────────────

Key State Objects:
  user:body_profile         → appStore (frontend)
  user:training_history     → trainingStore (frontend)
  user:preferences          → appStore (frontend)
  current_plan              → trainingStore (frontend)
  user:posture_report       → poseStore (frontend)
  safety_alert_active       → uiStore (frontend)
```

---

## Known Quirks & Edge Cases

1. **Firestore Persistence** (app.py lines 43-49, main_agent.py lines 54-62)
   - Only "user:" prefixed keys are persisted to Firestore
   - "temp:" and "current_plan" live in memory only for this session
   - Next session loads user data from Firestore

2. **current_plan Race Condition** (app.py lines 272-273)
   - current_plan is pushed directly by tool, skipped in state_delta forwarding
   - Prevents null override race condition where Gemini state_delta might overwrite tool push

3. **CV Events** (app.py lines 364-370)
   - Vision system sends [CV] events as text context to Live API
   - Not processed by ToolRouter; audio model handles them
   - Examples: rep_complete, form_issue, safety_alert from pose detection

4. **Session Lifecycle**
   - Fresh session created per WebSocket connection (line 172)
   - User-level data (user:* keys) persisted to Firestore
   - Session-level data (temp:*, current_plan) lost on disconnect

5. **Auto-Chain** (app.py line 116)
   - After generate_training_plan executes, auto-runs send_ui_command to switch UI to "planning" mode
   - Example of tool orchestration (tool1 → tool2) without explicit Gemini decision

---

## Summary Tables

### Tool I/O Matrix

| Tool | Read State | Write State | Push Frontend | Firestore |
|------|-----------|-----------|---------------|-----------|
| get_body_profile | ✓ profile | ✗ | ✓ profile | ✗ |
| update_body_profile | ✓ profile | ✓ profile | ✓ profile | ✓ |
| get_training_history | ✓ history | ✗ | ✗ | ✗ |
| record_training_set | ✓ history | ✓ history | ✓ history | ✓ |
| generate_training_plan | ✓ profile, history | ✓ current_plan | ✓ current_plan | ✗ (memory) |
| trigger_safety_alert | ✓ prefs | ✓ alert flags | ✓ ui_command | ✗ |
| cancel_safety_alert | ✗ | ✓ alert flags | ✓ ui_command | ✗ |
| get_user_preferences | ✓ prefs | ✗ | ✗ | ✗ |
| update_user_preferences | ✓ prefs | ✓ prefs | ✓ prefs | ✓ |
| get_exercise_info | ✗ (static data) | ✗ | ✗ | ✗ |
| analyze_posture | ✗ | ✓ posture_report | ✓ posture_report | ✓ |
| send_ui_command | ✗ | ✗ | ✓ ui_command | ✗ |

### Business Logic Density

| Tool | Complexity | Movable to Gemini? |
|------|-----------|-------------------|
| get_body_profile | LOW (format) | NO |
| update_body_profile | LOW (validate weight) | NO |
| get_training_history | LOW (filter + format) | NO |
| record_training_set | MEDIUM (session grouping) | NO |
| generate_training_plan | **HIGH** (Gemini call + fallback) | PARTIAL (fallback) |
| trigger_safety_alert | LOW (set flags) | NO |
| cancel_safety_alert | LOW (reset flags) | NO |
| get_user_preferences | LOW (format) | NO |
| update_user_preferences | LOW (validate + map) | NO |
| get_exercise_info | LOW (lookup) | NO |
| analyze_posture | MEDIUM (threshold logic) | MAYBE |
| send_ui_command | LOW (JSON validate) | NO |

---

## Recommendations for Architecture Review

1. **Clarify posture thresholds:** Are 3°, 15°, 3cm biomechanically justified, or heuristic? If heuristic → move to Gemini prompt for easier tuning.

2. **Test ToolRouter reliability:** Logs show 95% tool calling success for text model. Verify against real user patterns (not lab conditions).

3. **Plan memory persistence:** current_plan is memory-only. Decide: should training plans persist across sessions? If yes, add "user:current_plan" to Firestore.

4. **CV → Gemini bridge:** Currently CV events injected as text. Consider structured CV event schema (JSON) if vision system needs tool parameters.

5. **Fallback strategy:** If Gemini fails in generate_training_plan, tool falls back to deterministic plan. Monitor real failure rates; may need to improve fallback or add user notification.

6. **Tool execution timing:** _route_and_execute runs in async background task (asyncio.create_task). Verify tool execution completes before frontend expects result.


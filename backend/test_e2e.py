"""Full E2E test for all 12 ADK tools + Firestore persistence."""
import asyncio
import json
import subprocess
import websockets
import requests

BASE = "wss://muscleclaw-1058434722594.us-central1.run.app/ws"
P, F = 0, 0


def r(name, ok, detail=""):
    global P, F
    P += 1 if ok else 0
    F += 0 if ok else 1
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail else ""
    print(f"  [{mark}] {name}{suffix}")


async def collect(ws, timeout=15, max_msgs=30):
    audio, syncs, transcripts = 0, {}, []
    try:
        for _ in range(max_msgs):
            msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
            if isinstance(msg, bytes):
                audio += 1
            else:
                d = json.loads(msg)
                t = d.get("type", "")
                if t == "state_sync":
                    syncs[d["key"]] = d.get("data")
                elif t == "transcript":
                    transcripts.append(d.get("text", "")[:60])
    except asyncio.TimeoutError:
        pass
    return audio, syncs, transcripts


async def main():
    print("=" * 50)
    print("MuscleClaw ADK Full Feature Test")
    print("=" * 50)
    print()

    # 1. Connect
    print("[1/12] WebSocket Connect")
    async with websockets.connect(f"{BASE}/t-connect", open_timeout=20) as ws:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        r("Connect", msg.get("type") == "connected")

    # 2. Basic Chat
    print("[2/12] Basic Chat")
    async with websockets.connect(f"{BASE}/t-chat", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Hello"}))
        a, s, t = await collect(ws, timeout=12)
        r("Audio reply", a > 0, f"{a} chunks")

    # 3. get_body_profile
    print("[3/12] get_body_profile")
    async with websockets.connect(f"{BASE}/t-bp", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Show my body profile"}))
        a, s, t = await collect(ws, timeout=15)
        r("body_profile synced", "user:body_profile" in s)

    # 4. update_body_profile
    print("[4/12] update_body_profile")
    async with websockets.connect(f"{BASE}/t-upd-bp", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Update chest max weight to 120kg"}))
        a, s, t = await collect(ws, timeout=15)
        r("Profile synced", "user:body_profile" in s)

    # 5. generate_training_plan
    print("[5/12] generate_training_plan")
    async with websockets.connect(f"{BASE}/t-plan", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Create a chest training plan"}))
        a, s, t = await collect(ws, timeout=20, max_msgs=50)
        plan = s.get("current_plan")
        has_ex = isinstance(plan, dict) and len(plan.get("exercises", [])) > 0
        r("Plan delivered", "current_plan" in s)
        r("Has exercises", has_ex)
        r("UI command", "ui_command" in s)

    # 6. get_training_history
    print("[6/12] get_training_history")
    async with websockets.connect(f"{BASE}/t-hist", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Show my training history"}))
        a, s, t = await collect(ws, timeout=12)
        r("Audio reply", a > 0)

    # 7. record_training_set
    print("[7/12] record_training_set")
    async with websockets.connect(f"{BASE}/t-rec", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Record bench press set 1, 8 reps, 100kg, RPE 8"}))
        a, s, t = await collect(ws, timeout=15)
        r("History synced", "user:training_history" in s)

    # 8. update_user_preferences
    print("[8/12] update_user_preferences")
    async with websockets.connect(f"{BASE}/t-pref", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Switch to gentle personality mode"}))
        a, s, t = await collect(ws, timeout=15)
        r("Prefs synced", "user:preferences" in s)

    # 9. send_ui_command
    print("[9/12] send_ui_command")
    async with websockets.connect(f"{BASE}/t-ui", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Switch to dashboard mode"}))
        a, s, t = await collect(ws, timeout=12)
        r("UI command", "ui_command" in s)

    # 10. trigger_safety_alert
    print("[10/12] trigger_safety_alert")
    async with websockets.connect(f"{BASE}/t-safe", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Trigger safety alert for barbell stall"}))
        a, s, t = await collect(ws, timeout=12)
        ui = s.get("ui_command", {})
        r("Safety alert", "ui_command" in s, str(ui.get("command", "")))

    # 11. cancel_safety_alert
    print("[11/12] cancel_safety_alert")
    async with websockets.connect(f"{BASE}/t-cancel", open_timeout=20) as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "text", "text": "Cancel the safety alert"}))
        a, s, t = await collect(ws, timeout=12)
        ui = s.get("ui_command", {})
        r("Cancel alert", "ui_command" in s, str(ui.get("command", "")))

    # 12. Firestore Persistence
    print("[12/12] Firestore Persistence")
    await asyncio.sleep(3)
    token = subprocess.check_output([
        "C:/Users/Leo23/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd",
        "auth", "print-access-token", "--project", "muscleclaw",
    ]).decode().strip()
    url = "https://firestore.googleapis.com/v1/projects/muscleclaw/databases/(default)/documents"
    h = {"Authorization": f"Bearer {token}"}
    resp = requests.get(f"{url}/apps/muscleclaw/users/t-bp/meta/user_state", headers=h)
    r("Firestore persisted", resp.status_code == 200)

    print()
    print("=" * 50)
    print(f"RESULTS: {P} PASS / {F} FAIL / {P+F} TOTAL")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())

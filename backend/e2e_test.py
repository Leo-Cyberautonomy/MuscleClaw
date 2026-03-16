"""MuscleClaw E2E Test Suite — tests WebSocket + Live API + Tool calls."""

import asyncio
import json
import sys

import websockets

BASE = "wss://muscleclaw-1058434722594.us-central1.run.app/ws"
PASS_COUNT = 0
FAIL_COUNT = 0


def result(name: str, ok: bool, detail: str = ""):
    global PASS_COUNT, FAIL_COUNT
    if ok:
        PASS_COUNT += 1
    else:
        FAIL_COUNT += 1
    mark = "PASS" if ok else "FAIL"
    suffix = f" — {detail}" if detail else ""
    print(f"  [{mark}] {name}{suffix}")


async def collect(ws, timeout=15, max_msgs=20):
    audio, transcripts, ui_cmds, errors = 0, [], [], []
    try:
        for _ in range(max_msgs):
            msg = await asyncio.wait_for(ws.recv(), timeout=timeout)
            if isinstance(msg, bytes):
                audio += 1
            else:
                d = json.loads(msg)
                t = d.get("type", "")
                txt = d.get("text", "")
                if t == "transcript":
                    transcripts.append(txt[:80])
                elif t == "ui_command":
                    ui_cmds.append(d)
                if any(w in txt for w in ["错误", "1007", "1008", "不可用"]):
                    errors.append(txt[:60])
    except asyncio.TimeoutError:
        pass
    return audio, transcripts, ui_cmds, errors


async def main():
    print("=== MuscleClaw E2E Test Suite ===\n")

    # --- Test 1: WebSocket connect ---
    print("[1/8] WebSocket 连接")
    try:
        async with websockets.connect(f"{BASE}/e2e-1", open_timeout=30) as ws:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
            result("连接 + session_id", msg.get("type") == "connected", msg.get("session_id", "")[:8])
    except Exception as e:
        result("连接", False, str(e)[:60])

    await asyncio.sleep(2)

    # --- Test 2: Text → Audio ---
    print("[2/8] 纯文本 → 音频回复")
    try:
        async with websockets.connect(f"{BASE}/e2e-2", open_timeout=30) as ws:
            await ws.recv()  # connected
            await ws.send(json.dumps({"type": "text", "text": "你好，你是谁？"}))
            a, t, u, e = await collect(ws)
            result("音频回复", a > 0, f"{a} chunks")
            result("无错误", len(e) == 0, "; ".join(e) if e else "")
    except Exception as ex:
        result("文本对话", False, str(ex)[:60])

    await asyncio.sleep(2)

    # --- Test 3: Audio stream + text ---
    print("[3/8] 音频流 + 文本")
    try:
        async with websockets.connect(f"{BASE}/e2e-3", open_timeout=30) as ws:
            await ws.recv()
            # Send audio_config first (like browser does)
            await ws.send(json.dumps({"type": "audio_config", "sample_rate": 16000}))
            # Send silence PCM
            silence = bytes(4096)
            for _ in range(5):
                await ws.send(silence)
                await asyncio.sleep(0.1)
            await ws.send(json.dumps({"type": "text", "text": "你好"}))
            for _ in range(5):
                await ws.send(silence)
                await asyncio.sleep(0.1)
            a, t, u, e = await collect(ws)
            result("音频+文本正常", a > 0 and len(e) == 0, f"audio={a} errors={len(e)}")
    except Exception as ex:
        result("音频流", False, str(ex)[:60])

    await asyncio.sleep(2)

    # --- Test 4: generate_training_plan ---
    print("[4/8] generate_training_plan")
    try:
        async with websockets.connect(f"{BASE}/e2e-4", open_timeout=30) as ws:
            await ws.recv()
            await ws.send(json.dumps({
                "type": "text",
                "text": "帮我制定胸部训练计划，请调用generate_training_plan工具，target_parts设为chest",
            }))
            # Tool calls take longer: model thinks → calls tool → gets result → speaks
            a, t, u, e = await collect(ws, timeout=30, max_msgs=50)
            has_plan = any(c.get("command") == "show_training_plan" for c in u)
            result("音频回复", a > 0, str(a))
            result("UI: show_training_plan", has_plan, f"ui_cmds={len(u)} details={[c.get('command') for c in u]}")
            result("无错误", len(e) == 0, "; ".join(e) if e else "")
    except Exception as ex:
        result("训练计划", False, str(ex)[:60])

    await asyncio.sleep(2)

    # --- Test 5: get_body_profile ---
    print("[5/8] get_body_profile")
    try:
        async with websockets.connect(f"{BASE}/e2e-5", open_timeout=30) as ws:
            await ws.recv()
            await ws.send(json.dumps({"type": "text", "text": "查看我的身体档案"}))
            a, t, u, e = await collect(ws, timeout=30, max_msgs=40)
            result("音频回复", a > 0, str(a))
            result("无错误", len(e) == 0, "; ".join(e) if e else "")
    except Exception as ex:
        result("身体档案", False, str(ex)[:60])

    await asyncio.sleep(5)

    # --- Test 6: record_training_set ---
    print("[6/8] record_training_set")
    try:
        async with websockets.connect(f"{BASE}/e2e-6", open_timeout=30) as ws:
            await ws.recv()
            await ws.send(json.dumps({
                "type": "text",
                "text": "记录一组训练：卧推第1组，8次100公斤RPE8，请调用record_training_set",
            }))
            a, t, u, e = await collect(ws, timeout=30, max_msgs=40)
            result("音频回复", a > 0, str(a))
            result("无错误", len(e) == 0, "; ".join(e) if e else "")
    except Exception as ex:
        result("记录训练", False, str(ex)[:60])

    await asyncio.sleep(2)

    # --- Test 7: update_user_preferences ---
    print("[7/8] update_user_preferences")
    try:
        async with websockets.connect(f"{BASE}/e2e-7", open_timeout=30) as ws:
            await ws.recv()
            await ws.send(json.dumps({
                "type": "text",
                "text": "把性格模式改成trash_talk，调用update_user_preferences",
            }))
            a, t, u, e = await collect(ws, timeout=30, max_msgs=40)
            result("音频回复", a > 0, str(a))
            result("无错误", len(e) == 0, "; ".join(e) if e else "")
    except Exception as ex:
        result("更新偏好", False, str(ex)[:60])

    await asyncio.sleep(2)

    # --- Test 8: Connection stability ---
    print("[8/8] 连接稳定性 (3x)")
    try:
        for i in range(3):
            async with websockets.connect(f"{BASE}/e2e-stab-{i}", open_timeout=30) as ws:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
                if msg.get("type") != "connected":
                    result("连续连接", False, f"attempt {i}")
                    break
            await asyncio.sleep(1)  # avoid rate limit
        else:
            result("3次连续连接", True)
    except Exception as ex:
        result("稳定性", False, str(ex)[:60])

    # Summary
    print(f"\n=== {PASS_COUNT} PASS / {FAIL_COUNT} FAIL / {PASS_COUNT + FAIL_COUNT} TOTAL ===")
    return FAIL_COUNT


if __name__ == "__main__":
    fails = asyncio.run(main())
    sys.exit(1 if fails > 0 else 0)

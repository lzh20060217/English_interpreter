"""
WebSocket endpoint for real-time audio streaming.
Protocol:
  Client → Server:
    - Binary: raw PCM s16le audio (16 kHz, mono)
    - Text (JSON control):
        {"type":"config", "source_language":"zh", "target_language":"en"}
        {"type":"pause"} / {"type":"resume"} / {"type":"stop"}
        {"type":"text_input", "text":"..."}  ← browser-side ASR text
  Server → Client (text JSON):
    {"type":"status", "state":"..."}
    {"type":"vad", "speaking":true|false}
    {"type":"transcript", "text":"...", "is_final":false|true}
    {"type":"result", "transcript":"...", "translation":"...", "paraphrase":"...", "notes":"..."}
    {"type":"error", "message":"..."}
"""

import asyncio
import json
import logging
import time

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.asr_service import AudioBuffer, is_available, transcribe
from app.services.llm_service import process as llm_process, is_available as llm_available

logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000
TRANSCRIBE_INTERVAL_SEC = 1.8
SILENCE_TIMEOUT_MS = 900


@router.websocket("/audio-stream")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected (text+audio mode)")

    source_language = "zh"
    target_language = "zh"
    paused = False
    asr_enabled = is_available()
    llm_enabled = llm_available()

    audio_buffer = AudioBuffer(sample_rate=SAMPLE_RATE, silence_timeout_ms=SILENCE_TIMEOUT_MS)

    tasks = []

    async def recv_loop():
        """Receive audio chunks, text inputs, and control messages."""
        nonlocal source_language, target_language, paused

        try:
            while True:
                msg = await websocket.receive()

                if msg.get("type") == "websocket.disconnect":
                    break

                # --- Binary: audio data ---
                if msg.get("type") == "websocket.receive" and "bytes" in msg:
                    if paused:
                        continue
                    raw = msg["bytes"]
                    try:
                        s16 = np.frombuffer(raw, dtype=np.int16)
                        f32 = s16.astype(np.float32) / 32768.0
                        audio_buffer.add_chunk(f32)
                    except Exception as e:
                        logger.warning("Audio decode error: %s", e)

                # --- Text: control & text_input ---
                elif msg.get("type") == "websocket.receive" and "text" in msg:
                    try:
                        data = json.loads(msg["text"])
                        cmd = data.get("type", "")

                        if cmd == "config":
                            source_language = data.get("source_language", source_language)
                            target_language = data.get("target_language", target_language)
                            audio_buffer.reset()
                            logger.info("Config: %s → %s", source_language, target_language)

                        elif cmd == "pause":
                            paused = True
                            await websocket.send_text(
                                json.dumps({"type": "status", "state": "paused"})
                            )

                        elif cmd == "resume":
                            paused = False
                            await websocket.send_text(
                                json.dumps({"type": "status", "state": "recording"})
                            )

                        # --- Browser-side ASR text input ---
                        elif cmd == "text_input":
                            if paused:
                                continue
                            text = data.get("text", "").strip()
                            if text:
                                logger.info("Text input: %s", text[:80])
                                # Echo as transcript
                                await websocket.send_text(json.dumps({
                                    "type": "transcript",
                                    "text": text,
                                    "is_final": True,
                                }))
                                # Run LLM pipeline
                                loop = asyncio.get_running_loop()
                                result = await loop.run_in_executor(
                                    None, llm_process, text,
                                    source_language, target_language,
                                )
                                await websocket.send_text(json.dumps({
                                    "type": "result",
                                    "transcript": text,
                                    "translation": result.translation,
                                    "paraphrase": result.paraphrase,
                                    "notes": result.notes,
                                }))

                    except json.JSONDecodeError:
                        pass

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected (recv)")
        except Exception as e:
            logger.warning("recv_loop error: %s", e)

    async def process_loop():
        """Poll audio buffer for ASR on raw audio chunks."""
        nonlocal paused

        try:
            last_partial_time = 0.0
            last_speech_state = False

            while True:
                await asyncio.sleep(0.2)

                if paused:
                    continue

                now = time.time()
                is_speaking = audio_buffer.is_speaking()

                # Send VAD state changes
                if is_speaking != last_speech_state:
                    await websocket.send_text(
                        json.dumps({"type": "vad", "speaking": is_speaking})
                    )
                    last_speech_state = is_speaking

                if not asr_enabled:
                    # No ASR model — this is fine, client uses browser ASR
                    await asyncio.sleep(5)
                    continue

                # --- Completed utterance ---
                utterance_audio = audio_buffer.pop_utterance_audio()
                if utterance_audio is not None and len(utterance_audio) > SAMPLE_RATE * 0.3:
                    try:
                        text = transcribe(utterance_audio, language=source_language)
                        if text:
                            await websocket.send_text(json.dumps({
                                "type": "transcript",
                                "text": text,
                                "is_final": True,
                            }))
                            loop = asyncio.get_running_loop()
                            result = await loop.run_in_executor(
                                None, llm_process, text,
                                source_language, target_language,
                            )
                            await websocket.send_text(json.dumps({
                                "type": "result",
                                "transcript": text,
                                "translation": result.translation,
                                "paraphrase": result.paraphrase,
                                "notes": result.notes,
                            }))
                    except Exception as e:
                        logger.error("ASR/LLM error: %s", e)
                    last_partial_time = now

                # --- Partial transcripts during speech ---
                elif is_speaking and (now - last_partial_time) > TRANSCRIBE_INTERVAL_SEC:
                    partial_audios = audio_buffer.pop_complete_utterances()
                    for pa in partial_audios:
                        if len(pa) > SAMPLE_RATE * 0.3:
                            try:
                                text = transcribe(pa, language=source_language)
                                if text:
                                    await websocket.send_text(json.dumps({
                                        "type": "transcript",
                                        "text": text,
                                        "is_final": False,
                                    }))
                            except Exception as e:
                                logger.error("Partial ASR error: %s", e)
                    last_partial_time = now

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("process_loop error: %s", e)

    # Send initial status
    await websocket.send_text(json.dumps({
        "type": "status",
        "state": "recording",
        "asr_enabled": asr_enabled,
        "llm_enabled": llm_enabled,
    }))

    tasks = [asyncio.create_task(recv_loop()), asyncio.create_task(process_loop())]

    try:
        await asyncio.gather(*tasks)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        for t in tasks:
            t.cancel()
        logger.info("WebSocket session cleaned up")

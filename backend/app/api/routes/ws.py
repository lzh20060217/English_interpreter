"""
WebSocket endpoint for real-time audio streaming.
Protocol:
  Client → Server:
    - Binary: raw PCM s16le audio (16 kHz, mono, 100ms chunks)
    - Text (JSON control): {"type":"config", "source_language":"zh", "target_language":"en"}
                           {"type":"pause"}
                           {"type":"resume"}
  Server → Client (text JSON):
    {"type":"status", "state":"..."}
    {"type":"vad", "speaking":true}
    {"type":"transcript", "text":"...", "is_final":false}
    {"type":"transcript", "text":"...", "is_final":true}
    {"type":"result", "transcript":"...", "translation":"...", "paraphrase":"...", "notes":"..."}
    {"type":"error", "message":"..."}
"""

import asyncio
import json
import logging
import struct
import time

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.asr_service import AudioBuffer, is_available, transcribe
from app.services.llm_service import process as llm_process

logger = logging.getLogger(__name__)

router = APIRouter()

SAMPLE_RATE = 16000
CHUNK_INTERVAL_SEC = 0.1  # 100ms
TRANSCRIBE_INTERVAL_SEC = 1.8  # run ASR on partial audio every 1.8s during speech
SILENCE_TIMEOUT_MS = 900  # ms of silence to consider utterance complete
MAX_BUFFER_SEC = 10  # max audio buffer in seconds


@router.websocket("/audio-stream")
async def audio_stream(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")

    # --- session state ---
    source_language = "zh"
    target_language = "zh"
    paused = False
    audio_buffer = AudioBuffer(sample_rate=SAMPLE_RATE, silence_timeout_ms=SILENCE_TIMEOUT_MS)

    # asyncio tasks
    tasks = []

    async def recv_loop():
        """Receive audio chunks & control messages."""
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
                    # Convert s16le bytes → float32 numpy
                    try:
                        s16 = np.frombuffer(raw, dtype=np.int16)
                        f32 = s16.astype(np.float32) / 32768.0
                        audio_buffer.add_chunk(f32)
                    except Exception as e:
                        logger.warning("Audio decode error: %s", e)

                # --- Text: control messages ---
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
                    except json.JSONDecodeError:
                        pass
        except WebSocketDisconnect:
            logger.info("WebSocket disconnected (recv)")
        except Exception as e:
            logger.warning("recv_loop error: %s", e)

    async def process_loop():
        """
        Poll the audio buffer periodically.
        - Every ~1.8s during speech: run ASR on partial audio → send interim transcript
        - When utterance ends: run ASR + LLM → send full result
        """
        nonlocal paused
        try:
            last_partial_time = 0.0
            last_speech_state = False

            while True:
                await asyncio.sleep(0.2)  # poll every 200ms

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

                if not is_available():
                    # ASR model not loaded — send a hint once
                    await websocket.send_text(
                        json.dumps({
                            "type": "error",
                            "message": "ASR 模型未加载，请安装 funasr",
                        })
                    )
                    await asyncio.sleep(5)
                    continue

                # --- Check for completed utterances ---
                utterance_audio = audio_buffer.pop_utterance_audio()
                if utterance_audio is not None and len(utterance_audio) > SAMPLE_RATE * 0.3:
                    # Run ASR on this complete utterance
                    try:
                        text = transcribe(utterance_audio, language=source_language)
                        if text:
                            # Send final transcript
                            await websocket.send_text(
                                json.dumps({"type": "transcript", "text": text, "is_final": True})
                            )
                            # Run LLM pipeline in a thread to avoid blocking
                            loop = asyncio.get_running_loop()
                            result = await loop.run_in_executor(
                                None,
                                llm_process,
                                text,
                                source_language,
                                target_language,
                            )
                            await websocket.send_text(
                                json.dumps({
                                    "type": "result",
                                    "transcript": text,
                                    "translation": result.translation,
                                    "paraphrase": result.paraphrase,
                                    "notes": result.notes,
                                })
                            )
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
                                    await websocket.send_text(
                                        json.dumps({
                                            "type": "transcript",
                                            "text": text,
                                            "is_final": False,
                                        })
                                    )
                            except Exception as e:
                                logger.error("Partial ASR error: %s", e)
                    last_partial_time = now

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("process_loop error: %s", e)

    # Run both loops concurrently
    tasks = [
        asyncio.create_task(recv_loop()),
        asyncio.create_task(process_loop()),
    ]

    try:
        await websocket.send_text(
            json.dumps({"type": "status", "state": "recording"})
        )
        await asyncio.gather(*tasks)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        for t in tasks:
            t.cancel()
        logger.info("WebSocket session cleaned up")

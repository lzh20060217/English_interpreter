"""
Real-time ASR service using funasr + SenseVoiceSmall.
Auto-falls back to a keyboard-input simulation mode if the model isn't installed.
"""

import json
import logging
import struct
import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ---------------------------------------------------------------------------
# Model state (lazy-loaded once; retry each time if not yet available)
# ---------------------------------------------------------------------------
_model = None
_vad_model = None
_model_lock = Lock()
_available = False
_tried_load = False


def _load_models():
    global _model, _vad_model, _available, _tried_load
    if _tried_load:
        return
    _tried_load = True
    try:
        from funasr import AutoModel

        _model = AutoModel(
            model="iic/SenseVoiceSmall",
            disable_update=True,
            device="cpu",
            log_message=False,
        )
        logger.info("✓ SenseVoiceSmall model loaded")
        try:
            _vad_model = AutoModel(
                model="iic/speech_fsmn_vad_zh-cn_16k-common-pytorch",
                disable_update=True,
                log_message=False,
            )
            logger.info("✓ FSMN-VAD model loaded")
        except Exception as e:
            logger.warning("VAD model not loaded (non-critical): %s", e)
        _available = True
    except ImportError:
        logger.warning(
            "funasr not installed — ASR unavailable. "
            "Install with: pip install funasr"
        )
    except Exception as e:
        logger.error("Failed to load ASR model: %s", e)


def is_available() -> bool:
    """Check whether the ASR engine is ready."""
    with _model_lock:
        if not _tried_load:
            _load_models()
        return _available


def transcribe(audio: np.ndarray, language: str = "auto") -> str:
    """
    Run ASR on a float32 numpy array (16 kHz mono).
    Returns the recognised text string.
    """
    global _model
    with _model_lock:
        if not is_available():
            return ""
        try:
            result = _model.generate(input=audio, language=language)
            text = result[0].get("text", "").strip()
            # SenseVoice often prepends tags like <|zh|><|NEUTRAL|>
            import re
            text = re.sub(r"<\|[^|]+\|>", "", text).strip()
            return text
        except Exception as e:
            logger.error("ASR inference error: %s", e)
            return ""


# ---------------------------------------------------------------------------
# WebRTC-based Voice Activity Detection (lightweight, no model required)
# ---------------------------------------------------------------------------
_vad = None


def _ensure_vad():
    global _vad
    if _vad is None:
        try:
            import webrtcvad

            _vad = webrtcvad.Vad(2)  # aggressiveness 0-3
        except ImportError:
            _vad = False  # mark as unavailable
    return _vad if _vad is not False else None


def _frame_generator(audio_bytes: bytes, sample_rate: int, frame_ms: int = 30):
    """Yield 30ms frames from raw PCM s16le audio."""
    n = int(sample_rate * frame_ms / 1000) * 2  # 2 bytes per sample (s16le)
    offset = 0
    while offset + n <= len(audio_bytes):
        yield audio_bytes[offset : offset + n]
        offset += n


def vad_speech_segments(
    audio_bytes: bytes, sample_rate: int = 16000, frame_ms: int = 30
) -> list[tuple[int, int]]:
    """
    Return list of (start_byte, end_byte) indices of speech-containing regions.
    Simple energy-based fallback when webrtcvad is not installed.
    """
    vad = _ensure_vad()
    if vad:
        frames = list(_frame_generator(audio_bytes, sample_rate, frame_ms))
        speech_frames = [i for i, f in enumerate(frames) if vad.is_speech(f, sample_rate)]
        if not speech_frames:
            return []
        # Merge consecutive speech frames into segments
        segments = []
        start = speech_frames[0]
        prev = speech_frames[0]
        for i in speech_frames[1:]:
            if i > prev + 3:  # gap > 3 frames = separate utterance
                n_bytes = (prev + 1) * frame_ms * sample_rate // 1000 * 2
                segments.append((start * frame_ms * sample_rate // 1000 * 2, n_bytes))
                start = i
            prev = i
        n_bytes = (prev + 1) * frame_ms * sample_rate // 1000 * 2
        segments.append((start * frame_ms * sample_rate // 1000 * 2, n_bytes))
        return segments
    else:
        # Fallback: simple energy-based VAD
        arr = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        frame_len = int(sample_rate * frame_ms / 1000)
        energy_threshold = 0.015
        min_speech_frames = 3
        speech_regions = []
        i = 0
        while i < len(arr):
            frame = arr[i : i + frame_len]
            energy = np.sqrt(np.mean(frame**2)) if len(frame) > 0 else 0
            if energy > energy_threshold:
                start = i
                end = i + len(frame)
                # Extend while energy stays above threshold
                i += frame_len
                while i < len(arr):
                    frame = arr[i : i + frame_len]
                    energy = np.sqrt(np.mean(frame**2)) if len(frame) > 0 else 0
                    if energy > energy_threshold:
                        end = i + len(frame)
                        i += frame_len
                    else:
                        break
                # Require minimum speech duration
                if end - start > frame_len * min_speech_frames:
                    speech_regions.append(
                        (start * 2, end * 2)
                    )  # convert to bytes (s16le)
            i += frame_len
        return speech_regions


# ---------------------------------------------------------------------------
# Real-time audio buffer with VAD-driven utterance detection
# ---------------------------------------------------------------------------
@dataclass
class UtteranceResult:
    """Result emitted when a complete utterance is detected."""

    text: str
    audio_duration_ms: float
    start_time: float


class AudioBuffer:
    """
    Accumulates float32 audio chunks and detects utterance boundaries using VAD.

    Usage:
        buf = AudioBuffer()
        buf.add_chunk(chunk)           # add float32 audio
        # poll periodically:
        for utt in buf.pop_complete_utterances():
            print(utt.text)
        partial = buf.get_partial()     # currently-speaking text
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        silence_timeout_ms: int = 900,
    ):
        self.sample_rate = sample_rate
        self.silence_timeout_ms = silence_timeout_ms

        # Raw PCM s16le buffer (for VAD)
        self._pcm_buf = bytearray()
        # Float32 buffer (for ASR)
        self._float_buf: list[np.ndarray] = []

        self._last_voice_time = 0.0
        self._speaking = False
        self._utterance_float: list[np.ndarray] = []
        self._completed: list[UtteranceResult] = []

    def add_chunk(self, audio_f32: np.ndarray):
        """Add a float32 audio chunk [-1, 1]."""
        self._float_buf.append(audio_f32)

        # Convert to s16le for VAD
        s16 = (audio_f32 * 32767).astype(np.int16)
        self._pcm_buf.extend(s16.tobytes())

        # Simple energy check on this chunk
        energy = np.sqrt(np.mean(audio_f32**2))
        now = time.time()

        if energy > 0.012:
            self._last_voice_time = now
            if not self._speaking:
                self._speaking = True
                self._utterance_float = []

            # Only store the most recent ~8 seconds to limit memory
            max_utterance_samples = self.sample_rate * 8
            self._utterance_float.append(audio_f32)
            total = sum(len(a) for a in self._utterance_float)
            while total > max_utterance_samples and self._utterance_float:
                removed = self._utterance_float.pop(0)
                total -= len(removed)
        elif self._speaking and (now - self._last_voice_time) > self.silence_timeout_ms / 1000:
            # Speech just ended
            self._speaking = False
            if self._utterance_float:
                utterance = np.concatenate(self._utterance_float)
                duration = len(utterance) / self.sample_rate * 1000
                self._completed.append(
                    UtteranceResult(
                        text="",
                        audio_duration_ms=duration,
                        start_time=now - (now - self._last_voice_time),
                    )
                )
                self._utterance_float = []

    def is_speaking(self) -> bool:
        return self._speaking

    def pop_complete_utterances(self) -> list[np.ndarray]:
        """Return and clear completed utterance audio arrays."""
        audios = []
        self._completed.clear()

        if not self._utterance_float and not self._speaking:
            return []

        # Return recent ~2s as partial
        partial_samples = int(self.sample_rate * 2.5)
        all_audio = np.concatenate(self._float_buf)
        if len(all_audio) > partial_samples:
            chunk = all_audio[-partial_samples:]
        else:
            chunk = all_audio
        return [chunk] if len(chunk) > self.sample_rate * 0.3 else []

    def pop_utterance_audio(self) -> Optional[np.ndarray]:
        """Pop the most recently completed utterance audio."""
        if not self._completed:
            return None
        self._completed.clear()
        # Return the float buffer content
        if not self._utterance_float:
            return None
        result = np.concatenate(self._utterance_float)
        self._utterance_float = []
        return result if len(result) > self.sample_rate * 0.3 else None

    def reset(self):
        """Clear all buffers."""
        self._pcm_buf.clear()
        self._float_buf.clear()
        self._utterance_float.clear()
        self._completed.clear()
        self._speaking = False
        self._last_voice_time = 0.0

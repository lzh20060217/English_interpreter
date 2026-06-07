from fastapi import APIRouter

from app.core.config import get_settings
from app.services.asr_service import is_available as asr_available
from app.services.llm_service import is_available as llm_available

router = APIRouter()


@router.get("/config")
async def get_runtime_config() -> dict[str, object]:
    settings = get_settings()
    return {
        "sourceLanguages": ["auto", "zh", "en", "ja"],
        "targetLanguages": ["zh", "en", "ja", "ko"],
        "defaultSourceLanguage": settings.default_source_language,
        "defaultTargetLanguage": settings.default_target_language,
        "features": {
            "streamingStt": asr_available(),
            "realTimeTranslation": llm_available(),
            "noteExtraction": llm_available(),
            "browserAsrFallback": True,
        },
        "audio": {
            "sampleRate": settings.audio_sample_rate,
            "chunkMs": settings.websocket_chunk_ms,
        },
    }

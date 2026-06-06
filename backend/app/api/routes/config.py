from fastapi import APIRouter

from app.core.config import get_settings

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
            "streamingStt": False,
            "realTimeTranslation": False,
            "noteExtraction": False,
        },
    }

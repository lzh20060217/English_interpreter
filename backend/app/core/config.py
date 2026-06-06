from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI 智能同传助手 API"
    api_prefix: str = "/api"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:3000"]

    # --- LLM (DeepSeek / OpenAI-compatible) ---
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"

    # --- Legacy keys ---
    openai_api_key: str = ""
    deepgram_api_key: str = ""

    default_source_language: str = "auto"
    default_target_language: str = "zh"

    # --- Audio ---
    audio_sample_rate: int = 16000
    websocket_chunk_ms: int = 100

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

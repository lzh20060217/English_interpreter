from typing import Literal

from pydantic import BaseModel, Field


class SessionStartRequest(BaseModel):
    source_language: str = "auto"
    target_language: str = "en"


class SessionResponse(BaseModel):
    session_id: str
    source_language: str
    target_language: str
    status: Literal["idle", "listening", "paused", "stopped"] = "idle"


class SessionStopResponse(BaseModel):
    session_id: str
    status: Literal["stopped"] = "stopped"
    message: str = Field(default="Session stopped")

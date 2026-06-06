from uuid import uuid4

from fastapi import APIRouter

from app.models.session import (
    SessionResponse,
    SessionStartRequest,
    SessionStopResponse,
)

router = APIRouter()


@router.post("/start", response_model=SessionResponse)
async def start_session(payload: SessionStartRequest) -> SessionResponse:
    return SessionResponse(
        session_id=str(uuid4()),
        source_language=payload.source_language,
        target_language=payload.target_language,
        status="idle",
    )


@router.post("/{session_id}/stop", response_model=SessionStopResponse)
async def stop_session(session_id: str) -> SessionStopResponse:
    return SessionStopResponse(session_id=session_id)

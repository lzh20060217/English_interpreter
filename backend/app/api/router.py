from fastapi import APIRouter

from app.api.routes.config import router as config_router
from app.api.routes.health import router as health_router
from app.api.routes.session import router as session_router
from app.api.routes.ws import router as ws_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(config_router, tags=["config"])
api_router.include_router(session_router, prefix="/session", tags=["session"])
api_router.include_router(ws_router, tags=["websocket"])

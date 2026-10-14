"""Liveness, readiness, and agent status."""
import logging
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.agents.registry import agents_status
from app.core.config import Settings, get_settings
from app.database.client import database_probe

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health/live")
def health_live(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Process liveness only — no database/storage network I/O.

    Used by local ``npm run dev`` readiness waits so a slow remote probe cannot
    block starting the frontend after uvicorn is already up.
    """
    return {
        "status": "ok",
        "service": settings.app_name,
        "live": True,
    }


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """App health with bounded dependency probes (never hangs indefinitely)."""
    status = agents_status(settings)
    # Concurrent probes + 5s timeout (was 3s sequential)
    probe = database_probe(settings, timeout_seconds=5.0)
    probe_status = probe.get("status") or "unreachable"
    overall = "ok" if probe_status == "reachable" else "degraded"
    return {
        "status": overall,
        "service": settings.app_name,
        "database_engine": "supabase",
        "storage_engine": probe.get("storage_engine")
        or ("supabase_storage" if settings.supabase_storage_configured else "unconfigured"),
        "database_configured": settings.database_configured,
        "storage_configured": settings.storage_configured,
        "supabase_url": settings.resolved_supabase_url or None,
        "nvidia_configured": settings.nvidia_configured,
        "groq_configured": settings.groq_configured,
        "agent_count": status["agent_count"],
        "agents_ready": status["ready_count"],
        "llm_agents_configured": status["llm_configured_agent_count"],
        "database_status": probe["database_status"],
        "storage_status": probe["storage_status"],
        "probe_status": probe_status,
        "database_error": probe.get("database_error"),
        "storage_error": probe.get("storage_error"),
    }


@router.get("/health/ready", response_model=None)
def health_ready(settings: Settings = Depends(get_settings)) -> dict[str, Any] | JSONResponse:
    """Readiness probe that fails closed when required dependencies are degraded."""
    payload = health(settings)
    if payload.get("status") != "ok":
        return JSONResponse(status_code=503, content=payload)
    return payload


@router.get("/agents/status")
def agent_status(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Public agent inventory + configuration readiness (no secrets)."""
    return agents_status(settings)


@router.get("/health/database")
def health_database(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Deep dependency probe with bounded timeouts (ops / diagnostics)."""
    return database_probe(settings, timeout_seconds=5.0)


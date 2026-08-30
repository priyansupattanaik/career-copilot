import logging
import sys
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.router import router
from app.core.config import get_settings
from app.core.errors import ApiError, api_error_handler, unexpected_error_handler
from app.features.ats.routes import router as ats_scoring_router

settings = get_settings()
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"
logger = logging.getLogger("career_copilot.api")


def configure_request_logging() -> None:
    """Keep request logs visible after uvicorn replaces the root logging config."""
    logger.setLevel(logging.INFO)
    logger.propagate = True
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, stream=sys.stdout, force=False)


configure_request_logging()


def _is_health_path(path: str) -> bool:
    normalized = path.rstrip("/")
    return normalized.endswith("/health") or normalized.endswith("/health/live")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    configure_request_logging()
    yield


app = FastAPI(
    title="Career Copilot API",
    version="1.0.0",
    docs_url="/docs" if settings.app_env != "production" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(Exception, unexpected_error_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    started = time.perf_counter()
    response = None
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
    finally:
        status = response.status_code if response is not None else "error"
        duration_ms = (time.perf_counter() - started) * 1000
        path = request.url.path
        query = request.url.query
        message = "api_request request_id=%s method=%s path=%s status=%s duration_ms=%.1f"
        args = (request_id, request.method, path, status, duration_ms)
        if isinstance(status, int) and status >= 500:
            logger.error(message, *args)
        elif isinstance(status, int) and status >= 400:
            logger.warning(message, *args)
        else:
            logger.info(message, *args)
        if not _is_health_path(path):
            display_path = f"{path}?{query}" if query else path
            print(
                f"[api] {request.method} {display_path} {status} {duration_ms:.0f}ms id={request_id[:8]}",
                flush=True,
            )


app.include_router(router, prefix=settings.api_v1_prefix)
app.include_router(ats_scoring_router, prefix=settings.api_v1_prefix)

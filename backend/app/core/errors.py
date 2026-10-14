import logging
from dataclasses import dataclass
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

logger = logging.getLogger("career_copilot.api")


@dataclass
class ApiError(Exception):
    status_code: int
    code: str
    message: str
    details: Any = None

    def __str__(self) -> str:
        return self.message


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "request_id": request_id,
            },
            "detail": exc.message,
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    code = (
        "not_found"
        if exc.status_code == 404
        else "unauthorized"
        if exc.status_code == 401
        else "forbidden"
        if exc.status_code == 403
        else "request_failed"
    )
    message = str(exc.detail) if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": None,
                "request_id": request_id,
            },
            "detail": exc.detail,
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Invalid request payload.",
                "details": exc.errors(),
                "request_id": request_id,
            },
            "detail": exc.errors(),
        },
    )


async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.exception(
        "unhandled_error request_id=%s method=%s path=%s type=%s",
        request_id,
        request.method,
        request.url.path,
        type(exc).__name__,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
                "details": None,
                "request_id": request_id,
            },
            "detail": "An unexpected error occurred.",
        },
    )

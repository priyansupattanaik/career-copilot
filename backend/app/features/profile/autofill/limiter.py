from __future__ import annotations

import threading
import time
from collections import defaultdict

from app.core.errors import ApiError

_user_timestamps: dict[str, list[float]] = defaultdict(list)
_lock = threading.Lock()


def check_and_record_user_rate_limit(user_id: str, max_per_hour: int) -> None:
    """In-process per-user rate limiter with rolling 1-hour window.

    Raises ApiError(429, 'RATE_LIMITED', ...) if limit is exceeded.
    """
    now = time.monotonic()
    window = 3600.0  # 1 hour

    with _lock:
        timestamps = _user_timestamps[str(user_id)]
        # Filter out timestamps older than 1 hour
        valid = [ts for ts in timestamps if now - ts < window]
        if len(valid) >= max_per_hour:
            raise ApiError(
                429,
                "RATE_LIMITED",
                "You've reached the hourly limit for autofill. Try again later.",
            )
        valid.append(now)
        _user_timestamps[str(user_id)] = valid


def reset_user_rate_limit_for_tests() -> None:
    """Helper to reset timestamps between tests."""
    with _lock:
        _user_timestamps.clear()

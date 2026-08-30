from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.features.interview.transcribe import groq_stt_configured, transcribe_audio


def _settings(**overrides):
    base = {
        "groq_configured": True,
        "groq_api_key": "gsk-test",
        "groq_base_url": "https://api.groq.com/openai/v1",
        "groq_timeout_seconds": 15.0,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_groq_stt_configured_requires_groq():
    assert groq_stt_configured(_settings(groq_configured=False)) is False
    assert groq_stt_configured(_settings()) is True


def test_transcribe_rejects_empty_audio():
    with pytest.raises(ValueError, match="empty"):
        transcribe_audio(_settings(), b"")


def test_transcribe_requires_configuration():
    with pytest.raises(RuntimeError, match="not configured"):
        transcribe_audio(_settings(groq_configured=False), b"x" * 64)


def test_transcribe_returns_verbatim_text():
    response = MagicMock()
    response.status_code = 200
    response.json.return_value = {"text": "Um I fixed the bug because uh it was urgent."}

    client = MagicMock()
    client.post.return_value = response
    client.__enter__.return_value = client
    client.__exit__.return_value = False

    with patch("app.features.interview.transcribe.httpx.Client", return_value=client):
        text = transcribe_audio(_settings(), b"x" * 64, filename="answer.webm", content_type="audio/webm")

    assert "Um" in text
    assert "uh" in text
    posted = client.post.call_args
    assert posted.args[0].endswith("/audio/transcriptions")
    assert "um, uh" in posted.kwargs["data"]["prompt"].lower()

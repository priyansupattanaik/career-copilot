"""Interviewer TTS helpers — no live network in unit tests."""

from types import SimpleNamespace

import pytest

from app.features.interview import tts as tts_mod
from app.features.interview.tts import (
    MAX_TTS_CHARS,
    ORPHEUS_MAX_CHARS,
    _split_for_orpheus,
    concat_wav,
    groq_tts_configured,
    interviewer_tts_configured,
    nvidia_tts_configured,
    preferred_tts_provider,
    synthesize_speech,
)


def _settings(**overrides):
    base = {
        "groq_api_key": "",
        "groq_base_url": "https://api.groq.com/openai/v1",
        "groq_timeout_seconds": 45.0,
        "groq_tts_model": "canopylabs/orpheus-v1-english",
        "groq_tts_voice": "austin",
        "nvidia_api_key": "",
        "nvidia_tts_url": "https://example.invalid/v1/audio/synthesize",
        "nvidia_tts_voice": "Magpie-Multilingual.EN-US.Jason.Calm",
        "nvidia_tts_language": "en-US",
        "nvidia_timeout_seconds": 20.0,
        "fish_audio_api_key": "",
        "fish_audio_base_url": "https://api.fish.audio",
        "fish_audio_model": "s2.1-pro-free",
        "fish_audio_reference_id": "",
        "fish_audio_timeout_seconds": 45.0,
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_configured_flags_require_keys():
    empty = _settings()
    assert groq_tts_configured(empty) is False
    assert nvidia_tts_configured(empty) is False
    assert interviewer_tts_configured(empty) is False
    assert preferred_tts_provider(empty) is None

    groq = _settings(groq_api_key="gsk-test")
    assert groq_tts_configured(groq) is True
    assert preferred_tts_provider(groq) == "groq_orpheus"

    nvidia = _settings(nvidia_api_key="nvapi-test")
    assert nvidia_tts_configured(nvidia) is True
    assert preferred_tts_provider(nvidia) == "nvidia_magpie"
    assert interviewer_tts_configured(nvidia) is True


def test_synthesize_rejects_empty_text():
    with pytest.raises(ValueError, match="required"):
        synthesize_speech(_settings(groq_api_key="gsk"), "   ")


def test_synthesize_requires_configuration():
    with pytest.raises(RuntimeError, match="not configured"):
        synthesize_speech(_settings(), "Hello interviewer.")


def test_max_tts_chars_is_bounded():
    assert MAX_TTS_CHARS >= 200
    assert MAX_TTS_CHARS <= 2000
    assert ORPHEUS_MAX_CHARS <= 200


def test_split_for_orpheus_keeps_short_lines():
    assert _split_for_orpheus("Tell me about a time you led a project.") == [
        "Tell me about a time you led a project.",
    ]


def test_split_for_orpheus_breaks_long_questions():
    text = (
        "Walk me through a production incident you owned from the first alert to the postmortem. "
        "What was the first signal, who did you pull in, what did you change in the system, "
        "and how did you confirm it recovered for users without creating a new failure?"
    )
    parts = _split_for_orpheus(text)
    assert len(parts) >= 2
    assert all(len(part) <= ORPHEUS_MAX_CHARS for part in parts)
    assert " ".join(parts) == text


def _minimal_wav(pcm: bytes) -> bytes:
    import struct

    fmt = b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, 16000, 32000, 2, 16)
    data = b"data" + struct.pack("<I", len(pcm)) + pcm
    riff_size = 4 + len(fmt) + len(data)
    return b"RIFF" + struct.pack("<I", riff_size) + b"WAVE" + fmt + data


def test_concat_wav_joins_pcm():
    first = _minimal_wav(b"\x00\x01" * 8)
    second = _minimal_wav(b"\x02\x03" * 4)
    joined = concat_wav([first, second])
    assert joined.startswith(b"RIFF")
    assert b"\x00\x01" in joined
    assert b"\x02\x03" in joined
    assert len(joined) > len(first)


def test_falls_through_groq_to_nvidia(monkeypatch):
    wav = _minimal_wav(b"\x01\x02" * 16)

    def fail_groq(_settings, _text):
        raise RuntimeError("Groq Orpheus terms are not accepted")

    def ok_nvidia(_settings, _text):
        return wav, "audio/wav"

    monkeypatch.setattr(tts_mod, "_synthesize_groq", fail_groq)
    monkeypatch.setattr(tts_mod, "_synthesize_nvidia", ok_nvidia)
    audio, media, provider = synthesize_speech(
        _settings(groq_api_key="gsk-test", nvidia_api_key="nvapi-test"),
        "Tell me about a time you led a project.",
    )
    assert provider == "nvidia_magpie"
    assert media == "audio/wav"
    assert audio == wav


def test_falls_through_to_fish_when_others_fail(monkeypatch):
    mp3 = b"\xff\xfb" + b"\x00" * 40

    def fail(_settings, _text):
        raise RuntimeError("blocked")

    def ok_fish(_settings, _text):
        return mp3, "audio/mpeg"

    monkeypatch.setattr(tts_mod, "_synthesize_groq", fail)
    monkeypatch.setattr(tts_mod, "_synthesize_nvidia", fail)
    monkeypatch.setattr(tts_mod, "_synthesize_fish", ok_fish)
    audio, media, provider = synthesize_speech(
        _settings(groq_api_key="gsk", nvidia_api_key="nv", fish_audio_api_key="sk-fish"),
        "What changed after you shipped it?",
    )
    assert provider == "fish_audio"
    assert media == "audio/mpeg"
    assert audio == mp3

"""
Mock-interview interviewer TTS with a no-gap fallback chain.

Order:
  1. Groq Orpheus (natural conversational voice)
  2. NVIDIA Magpie (hosted NIM, uses NVIDIA_API_KEY)
  3. Fish Audio (legacy, if still keyed)
The browser speechSynthesis fallback lives on the client.

No provider invents interview content. This module only reads the supplied
text aloud.
"""

from __future__ import annotations

import logging
import struct
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

MAX_TTS_CHARS = 1_200
ORPHEUS_MAX_CHARS = 180
DEFAULT_TTS_MODEL = "canopylabs/orpheus-v1-english"
DEFAULT_TTS_VOICE = "austin"
DEFAULT_NVIDIA_TTS_URL = (
    "https://877104f7-e885-42b9-8de8-f6e4c6303969.invocation.api.nvcf.nvidia.com"
    "/v1/audio/synthesize"
)
DEFAULT_NVIDIA_TTS_VOICE = "Magpie-Multilingual.EN-US.Jason.Calm"
DEFAULT_NVIDIA_TTS_LANGUAGE = "en-US"
GROQ_TTS_ATTEMPT_SECONDS = 6.0


def groq_tts_configured(settings: Settings) -> bool:
    return bool((settings.groq_api_key or "").strip() and (settings.groq_base_url or "").strip())


def nvidia_tts_configured(settings: Settings) -> bool:
    return bool((getattr(settings, "nvidia_api_key", "") or "").strip())


def fish_audio_configured(settings: Settings) -> bool:
    return bool((getattr(settings, "fish_audio_api_key", "") or "").strip())


def interviewer_tts_configured(settings: Settings) -> bool:
    return groq_tts_configured(settings) or nvidia_tts_configured(settings) or fish_audio_configured(settings)


def preferred_tts_provider(settings: Settings) -> str | None:
    if groq_tts_configured(settings):
        return "groq_orpheus"
    if nvidia_tts_configured(settings):
        return "nvidia_magpie"
    if fish_audio_configured(settings):
        return "fish_audio"
    return None


def _split_for_orpheus(text: str) -> list[str]:
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        return []
    if len(cleaned) <= ORPHEUS_MAX_CHARS:
        return [cleaned]
    parts = []
    rest = cleaned
    while rest:
        if len(rest) <= ORPHEUS_MAX_CHARS:
            parts.append(rest)
            break
        window = rest[:ORPHEUS_MAX_CHARS]
        cut = max(window.rfind(". "), window.rfind("? "), window.rfind("! "), window.rfind("; "))
        if cut < 40:
            cut = window.rfind(", ")
        if cut < 40:
            cut = window.rfind(" ")
        if cut < 20:
            cut = ORPHEUS_MAX_CHARS
        else:
            cut += 1
        chunk = rest[:cut].strip()
        if chunk:
            parts.append(chunk)
        rest = rest[cut:].strip()
    return parts


def _wav_fmt_and_pcm(blob: bytes) -> tuple[bytes, bytes]:
    if len(blob) < 44 or blob[:4] != b"RIFF" or blob[8:12] != b"WAVE":
        raise RuntimeError("TTS did not return WAV audio")
    pos = 12
    fmt = b""
    pcm = b""
    while pos + 8 <= len(blob):
        cid = blob[pos : pos + 4]
        size = struct.unpack_from("<I", blob, pos + 4)[0]
        start = pos + 8
        end = start + size
        if end > len(blob):
            raise RuntimeError("WAV chunk is truncated")
        if cid == b"fmt ":
            fmt = blob[pos:end]
        elif cid == b"data":
            pcm = blob[start:end]
        pos = end + (size % 2)
    if not fmt or not pcm:
        raise RuntimeError("WAV missing fmt or data")
    return fmt, pcm


def concat_wav(blobs: list[bytes]) -> bytes:
    if not blobs:
        raise RuntimeError("No audio to concatenate")
    if len(blobs) == 1:
        return blobs[0]
    fmt0, pieces = b"", []
    for blob in blobs:
        fmt, pcm = _wav_fmt_and_pcm(blob)
        if not fmt0:
            fmt0 = fmt
        elif fmt != fmt0:
            raise RuntimeError("WAV format mismatch across TTS chunks")
        pieces.append(pcm)
    pcm = b"".join(pieces)
    riff_size = 4 + len(fmt0) + 8 + len(pcm)
    return b"RIFF" + struct.pack("<I", riff_size) + b"WAVE" + fmt0 + b"data" + struct.pack("<I", len(pcm)) + pcm


def _pcm_to_wav(pcm: bytes, sample_rate: int = 22050) -> bytes:
    fmt = b"fmt " + struct.pack("<IHHIIHH", 16, 1, 1, sample_rate, sample_rate * 2, 2, 16)
    data = b"data" + struct.pack("<I", len(pcm)) + pcm
    riff_size = 4 + len(fmt) + len(data)
    return b"RIFF" + struct.pack("<I", riff_size) + b"WAVE" + fmt + data


def _as_wav(audio: bytes, sample_rate: int = 22050) -> bytes:
    if audio[:4] == b"RIFF":
        return audio
    return _pcm_to_wav(audio, sample_rate)


def _synthesize_groq_chunk(
    settings: Settings,
    text: str,
    *,
    model: str,
    voice: str,
    timeout: float,
) -> bytes:
    base = (settings.groq_base_url or "").rstrip("/")
    url = f"{base}/audio/speech"
    body: dict[str, Any] = {
        "model": model,
        "voice": voice,
        "input": text,
        "response_format": "wav",
    }
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key.strip()}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        logger.warning("Groq Orpheus TTS timeout after %ss", timeout)
        raise RuntimeError("Groq Orpheus timed out") from exc
    except httpx.HTTPError as exc:
        logger.warning("Groq Orpheus TTS network error: %s", exc)
        raise RuntimeError("Groq Orpheus network error") from exc

    if response.status_code in {401, 403}:
        raise RuntimeError("Groq Orpheus authentication failed")
    if response.status_code == 429:
        raise RuntimeError("Groq Orpheus is rate limited")
    if response.status_code >= 400:
        detail = (response.text or "")[:360]
        logger.warning("Groq Orpheus TTS failed status=%s body=%s", response.status_code, detail)
        if "terms acceptance" in detail.lower() or "model_terms_required" in detail.lower():
            raise RuntimeError("Groq Orpheus terms are not accepted")
        raise RuntimeError(f"Groq Orpheus failed ({response.status_code})")

    audio = response.content or b""
    if len(audio) < 44:
        raise RuntimeError("Groq Orpheus returned empty audio")
    return audio


def _synthesize_groq(settings: Settings, text: str) -> tuple[bytes, str]:
    model = (getattr(settings, "groq_tts_model", None) or "").strip() or DEFAULT_TTS_MODEL
    voice = (getattr(settings, "groq_tts_voice", None) or "").strip() or DEFAULT_TTS_VOICE
    timeout = min(float(getattr(settings, "groq_timeout_seconds", 45) or 45), GROQ_TTS_ATTEMPT_SECONDS)
    chunks = _split_for_orpheus(text)
    if not chunks:
        raise ValueError("TTS text is required")
    audio_parts = [
        _synthesize_groq_chunk(settings, chunk, model=model, voice=voice, timeout=timeout)
        for chunk in chunks
    ]
    audio = concat_wav(audio_parts) if len(audio_parts) > 1 else audio_parts[0]
    return audio, "audio/wav"


def _synthesize_nvidia(settings: Settings, text: str) -> tuple[bytes, str]:
    url = (getattr(settings, "nvidia_tts_url", None) or "").strip() or DEFAULT_NVIDIA_TTS_URL
    voice = (getattr(settings, "nvidia_tts_voice", None) or "").strip() or DEFAULT_NVIDIA_TTS_VOICE
    language = (getattr(settings, "nvidia_tts_language", None) or "").strip() or DEFAULT_NVIDIA_TTS_LANGUAGE
    timeout = min(float(getattr(settings, "nvidia_timeout_seconds", 90) or 90), 20.0)
    sample_rate = 22050
    headers = {"Authorization": f"Bearer {settings.nvidia_api_key.strip()}"}
    form = {
        "text": text,
        "language": language,
        "voice": voice,
        "encoding": "LINEAR_PCM",
        "sample_rate_hz": str(sample_rate),
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, headers=headers, data=form)
    except httpx.TimeoutException as exc:
        logger.warning("NVIDIA Magpie TTS timeout after %ss", timeout)
        raise RuntimeError("NVIDIA Magpie timed out") from exc
    except httpx.HTTPError as exc:
        logger.warning("NVIDIA Magpie TTS network error: %s", exc)
        raise RuntimeError("NVIDIA Magpie network error") from exc

    if response.status_code in {401, 403}:
        raise RuntimeError("NVIDIA Magpie authentication failed")
    if response.status_code == 429:
        raise RuntimeError("NVIDIA Magpie is rate limited")
    if response.status_code >= 400:
        detail = (response.text or "")[:240]
        logger.warning("NVIDIA Magpie TTS failed status=%s body=%s", response.status_code, detail)
        raise RuntimeError(f"NVIDIA Magpie failed ({response.status_code})")

    audio = response.content or b""
    if len(audio) < 32:
        raise RuntimeError("NVIDIA Magpie returned empty audio")
    return _as_wav(audio, sample_rate), "audio/wav"


def _synthesize_fish(settings: Settings, text: str) -> tuple[bytes, str]:
    base = (settings.fish_audio_base_url or "https://api.fish.audio").rstrip("/")
    url = f"{base}/v1/tts"
    model = (settings.fish_audio_model or "").strip() or "s2.1-pro-free"
    reference_id = (settings.fish_audio_reference_id or "").strip() or None
    timeout = float(settings.fish_audio_timeout_seconds or 45.0)
    body: dict[str, Any] = {
        "text": text,
        "format": "mp3",
        "mp3_bitrate": 128,
        "normalize": True,
        "latency": "balanced",
        "temperature": 0.55,
        "top_p": 0.7,
        "prosody": {"speed": 0.98, "volume": 0, "normalize_loudness": True},
        "condition_on_previous_chunks": True,
    }
    if reference_id:
        body["reference_id"] = reference_id
    headers = {
        "Authorization": f"Bearer {settings.fish_audio_api_key.strip()}",
        "Content-Type": "application/json",
        "model": model,
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise RuntimeError("Fish Audio TTS timed out") from exc
    except httpx.HTTPError as exc:
        raise RuntimeError("Fish Audio TTS network error") from exc
    if response.status_code >= 400:
        raise RuntimeError(f"Fish Audio TTS failed ({response.status_code})")
    audio = response.content or b""
    if len(audio) < 32:
        raise RuntimeError("Fish Audio returned empty audio")
    return audio, "audio/mpeg"


def synthesize_speech(
    settings: Settings,
    text: str,
    *,
    format: str = "wav",
) -> tuple[bytes, str, str]:
    """
    Read the supplied interviewer text aloud.

    Returns (audio_bytes, media_type, provider_id).
    Raises ValueError for empty input; RuntimeError if every provider fails.
    """
    del format
    cleaned = " ".join(str(text or "").split()).strip()
    if not cleaned:
        raise ValueError("TTS text is required")
    if len(cleaned) > MAX_TTS_CHARS:
        cleaned = cleaned[:MAX_TTS_CHARS].rstrip() + "…"

    if not interviewer_tts_configured(settings):
        raise RuntimeError("Interviewer voice is not configured")

    attempts: list[tuple[str, Any]] = []
    if groq_tts_configured(settings):
        attempts.append(("groq_orpheus", _synthesize_groq))
    if nvidia_tts_configured(settings):
        attempts.append(("nvidia_magpie", _synthesize_nvidia))
    if fish_audio_configured(settings):
        attempts.append(("fish_audio", _synthesize_fish))

    errors: list[str] = []
    for provider, fn in attempts:
        try:
            audio, media_type = fn(settings, cleaned)
            if provider != attempts[0][0]:
                logger.warning("Interviewer TTS using %s after earlier provider failed", provider)
            return audio, media_type, provider
        except ValueError:
            raise
        except Exception as exc:
            message = str(exc) or type(exc).__name__
            logger.warning("Interviewer TTS provider %s failed: %s", provider, message)
            errors.append(f"{provider}: {message}")

    raise RuntimeError("All interviewer voices failed. " + "; ".join(errors))

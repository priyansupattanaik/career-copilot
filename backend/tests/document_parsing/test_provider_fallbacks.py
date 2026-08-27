import asyncio
import time
from types import SimpleNamespace

import pytest

from app.core.errors import ApiError
from app.features.document_parsing import pipeline as document_pipeline
from app.features.document_parsing.parsing import llm_sections
from app.features.profile.agent import pipeline as profile_pipeline


def test_section_extraction_falls_back_when_nvidia_is_unavailable(monkeypatch):
    async def unavailable(*_args, **_kwargs):
        raise ApiError(503, "nvidia_unavailable", "provider unavailable")

    monkeypatch.setattr(llm_sections, "_llm_segregate", unavailable)
    settings = SimpleNamespace(
        nvidia_configured=True,
        groq_configured=False,
        groq_resume_parser_configured=False,
    )

    result = asyncio.run(
        llm_sections.extract_sections_enriched(
            "SUMMARY\nBackend engineer\nSKILLS\nPython, FastAPI",
            settings,
        )
    )

    assert result["sections"]
    assert result["extraction_method"] == "structural_layout_v1"
    assert any("structural layout" in warning.lower() for warning in result["warnings"])


def test_profile_draft_fails_without_an_llm_answer(monkeypatch):
    async def unavailable(*_args, **_kwargs):
        raise ApiError(503, "nvidia_unavailable", "provider unavailable")

    monkeypatch.setattr("app.agents.providers.reliable.NvidiaClient.generate_structured", unavailable)
    settings = SimpleNamespace(
        llm_provider="nvidia",
        nvidia_configured=True,
        nvidia_model="test-model",
        groq_configured=False,
    )

    with pytest.raises(ApiError) as caught:
        asyncio.run(
            profile_pipeline.build_profile_draft_enriched(
                "Priyansu Pattanaik\nBackend Engineer\nPython, FastAPI",
                {"sections": {"summary": ["Backend Engineer"], "skills": ["Python, FastAPI"]}},
                settings,
            )
        )
    assert caught.value.code == "llm_generation_failed"

def test_saved_document_parsing_never_waits_for_a_remote_provider(monkeypatch):
    calls = []

    def extract_text(_content, _mime_type):
        return "SUMMARY\nBackend engineer\nSKILLS\nPython, FastAPI"

    async def extract_sections(text, _settings, *, schema_version, prefer_llm):
        calls.append({"text": text, "prefer_llm": prefer_llm})
        return {
            "schema_version": schema_version,
            "sections": {"summary": ["Backend engineer"], "skills": ["Python, FastAPI"]},
            "warnings": [],
            "extraction_method": "structural_layout_v1",
        }

    monkeypatch.setattr(document_pipeline, "extract_text", extract_text)
    monkeypatch.setattr(document_pipeline, "extract_sections_enriched", extract_sections)

    plain_text, structured = asyncio.run(
        document_pipeline.parse_document_bytes(
            b"pdf bytes",
            mime_type="application/pdf",
            settings=SimpleNamespace(nvidia_configured=True),
        )
    )

    assert plain_text.startswith("SUMMARY")
    assert structured["sections"]["skills"] == ["Python, FastAPI"]
    assert calls == [{"text": plain_text, "prefer_llm": False}]


def test_profile_ai_timeout_fails_without_static_content(monkeypatch):
    async def slow_provider(*_args, **_kwargs):
        await asyncio.sleep(1)

    monkeypatch.setattr("app.agents.providers.reliable.NvidiaClient.generate_structured", slow_provider)
    settings = SimpleNamespace(
        llm_provider="nvidia",
        nvidia_configured=True,
        nvidia_model="test-model",
        groq_configured=False,
    )

    started = time.perf_counter()
    with pytest.raises(ApiError) as caught:
        asyncio.run(
            profile_pipeline.build_profile_draft_enriched(
                "Priyansu Pattanaik\nBackend Engineer\nPython, FastAPI",
                {"sections": {"summary": ["Backend Engineer"], "skills": ["Python, FastAPI"]}},
                settings,
            )
        )

    assert time.perf_counter() - started < 3.0
    assert caught.value.code == "llm_generation_failed"

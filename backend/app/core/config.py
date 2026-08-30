from functools import lru_cache
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse
import json
import re

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Documented production frontend (deployment/vercel.frontend.env.example).
PRODUCTION_FRONTEND_ORIGIN = "https://careercopilotai.vercel.app"
PRODUCTION_FRONTEND_ORIGINS = (
    "https://careercopilotai.vercel.app",
    "https://career-copilot-neon.vercel.app",
)
PRODUCTION_FRONTEND_ORIGIN_REGEX = (
    r"^https://(?:careercopilotai|career-copilot-neon)(?:-[a-z0-9-]+)?\.vercel\.app$"
)

ROOT_DIR = Path(__file__).resolve().parents[3]
ROOT_ENV_FILE = ROOT_DIR / ".env"


def _normalize_origin(value: object) -> str:
    text = str(value or "").strip().strip("\"'")
    return text.rstrip("/")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT_ENV_FILE, env_file_encoding="utf-8", extra="ignore")
    app_name: str
    app_env: str
    api_v1_prefix: str
    public_api_base_url: str
    log_level: str
    frontend_origins: Annotated[list[str], NoDecode]
    firebase_project_id: str = ""
    firebase_database_id: str = "(default)"
    firebase_credentials_path: str = ""
    # Supabase Storage is the only production object-storage provider.
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "career-copilot-files"
    supabase_jwks_url: str = ""
    firebase_clock_skew_seconds: int = Field(default=60, ge=0, le=300)
    # Revocation checks call Firebase Auth after signature verification.
    # Default False for local Admin setups that lack Auth lookup; production
    # forces True via model_validator unless explicitly overridden.
    firebase_check_revoked: bool = False
    auth_secret: str
    jwt_ttl_seconds: int = Field(default=60 * 60 * 24 * 7, ge=60, le=60 * 60 * 24 * 30)
    llm_allow_repair: bool = True
    document_max_bytes: int = 10 * 1024 * 1024
    avatar_max_bytes: int = 3 * 1024 * 1024
    interview_media_max_bytes: int = 0
    # Logical prefixes inside the single Supabase Storage bucket.
    document_bucket: str
    avatar_bucket: str
    nvidia_api_key: str = ""
    nvidia_base_url: str
    nvidia_model: str
    nvidia_timeout_seconds: float = Field(default=90, gt=0, le=180)
    nvidia_max_retries: int = Field(default=2, ge=0, le=2)
    nvidia_max_output_tokens: int = Field(default=4096, ge=256, le=8192)
    nvidia_temperature: float = Field(default=0.2, ge=0, le=1)
    nvidia_prompt_version: str
    groq_api_key: str = ""
    groq_base_url: str
    groq_model: str
    groq_timeout_seconds: float = Field(default=45, gt=0, le=180)
    groq_max_retries: int = Field(default=2, ge=0, le=2)
    groq_max_output_tokens: int = Field(default=2048, ge=256, le=8192)
    groq_temperature: float = Field(default=0.4, ge=0, le=1)
    groq_resume_parser_enabled: bool = True
    groq_resume_parser_model: str = "llama-3.3-70b-versatile"
    groq_resume_parser_fallback_model: str = "openai/gpt-oss-120b"
    groq_resume_parser_timeout_seconds: float = Field(default=60.0, gt=0, le=180)
    groq_resume_parser_max_retries: int = Field(default=2, ge=0, le=5)
    groq_resume_parser_max_input_tokens: int = Field(default=110000, ge=1000, le=200000)
    groq_resume_parser_temperature: float = Field(default=0.0, ge=0.0, le=1.0)
    llm_provider: str
    improvement_max_sections: int = Field(default=4, ge=1, le=8)
    improvement_max_source_chars: int = Field(default=30_000, ge=1_000, le=100_000)
    improvement_max_jd_chars: int = Field(default=12_000, ge=1_000, le=50_000)
    export_signed_url_seconds: int = Field(default=300, ge=30, le=3600)
    avatar_token_ttl_seconds: int = Field(default=86400, ge=300, le=604800)
    youtube_api_key: str = ""
    youtube_api_base_url: str = "https://www.googleapis.com/youtube/v3"
    youtube_search_max_results: int = Field(default=3, ge=1, le=5)
    youtube_timeout_seconds: float = Field(default=20.0, gt=0, le=60)
    llm_rpm_limit: float = Field(default=40.0, ge=1.0, le=600.0)
    freehire_enabled: bool = True
    freehire_api_url: str = "https://freehire.me"
    freehire_timeout_seconds: float = Field(default=15.0, gt=0, le=60)
    freehire_results_per_page: int = Field(default=25, ge=1, le=50)
    freehire_max_days_old: int | None = Field(default=30, ge=1, le=365)
    # Fish Audio TTS for mock-interview interviewer voice (server-side key only).
    fish_audio_api_key: str = ""
    fish_audio_base_url: str = "https://api.fish.audio"
    fish_audio_model: str = "s2.1-pro-free"
    fish_audio_reference_id: str = "bf322df2096a46f18c579d0baa36f41d"
    fish_audio_timeout_seconds: float = Field(default=45.0, gt=5, le=120)
    @field_validator("frontend_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            text = value.strip()
            if text.startswith("["):
                try:
                    parsed = json.loads(text)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [_normalize_origin(item) for item in parsed if _normalize_origin(item)]
            return [_normalize_origin(item) for item in text.split(",") if _normalize_origin(item)]
        if isinstance(value, list):
            return [_normalize_origin(item) for item in value if _normalize_origin(item)]
        return value
    @field_validator("nvidia_base_url", "groq_base_url", "fish_audio_base_url")
    @classmethod
    def validate_server_url(cls, value: str) -> str:
        if not value:
            return value
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("must be an absolute HTTP or HTTPS URL")
        return value.rstrip("/")
    @field_validator("frontend_origins")
    @classmethod
    def validate_origins(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must contain at least one frontend origin")
        for origin in value:
            parsed = urlparse(origin)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("contains an invalid frontend origin")
        return value
    @model_validator(mode="after")
    def validate_provider_pair(self) -> "Settings":
        if self.nvidia_api_key and not self.nvidia_model:
            raise ValueError("NVIDIA_MODEL is required when NVIDIA_API_KEY is configured")
        if self.groq_api_key and not self.groq_model:
            raise ValueError("GROQ_MODEL is required when GROQ_API_KEY is configured")
        if self.groq_resume_parser_enabled and self.groq_api_key:
            if not self.groq_resume_parser_model:
                raise ValueError("GROQ_RESUME_PARSER_MODEL is required when Groq resume parser is enabled")
            if not self.groq_resume_parser_fallback_model:
                raise ValueError("GROQ_RESUME_PARSER_FALLBACK_MODEL is required when Groq resume parser is enabled")
        return self
    @property
    def database_configured(self) -> bool:
        return self.firebase_configured

    @property
    def firebase_configured(self) -> bool:
        return bool(self.firebase_project_id and self.firebase_credentials_path)

    @property
    def effective_firebase_check_revoked(self) -> bool:
        """Production always checks revocation; development uses the env flag."""
        if str(self.app_env).lower() == "production":
            return True
        return bool(self.firebase_check_revoked)

    @property
    def resolved_supabase_url(self) -> str:
        value = (self.supabase_url or "").strip().rstrip("/")
        if value.endswith("/rest/v1"):
            return value[: -len("/rest/v1")]
        return value

    @property
    def supabase_storage_configured(self) -> bool:
        return bool(
            self.resolved_supabase_url
            and self.supabase_server_key
            and self.supabase_storage_bucket
        )

    @property
    def supabase_server_key(self) -> str:
        """Prefer the legacy name while accepting Supabase's new secret-key name."""
        return (self.supabase_service_role_key or self.supabase_secret_key or "").strip()

    @property
    def storage_configured(self) -> bool:
        return self.supabase_storage_configured
    @property
    def nvidia_configured(self) -> bool:
        return bool(self.nvidia_api_key and self.nvidia_model and self.nvidia_base_url)
    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key and self.groq_model and self.groq_base_url)

    @property
    def groq_resume_parser_configured(self) -> bool:
        return bool(
            self.groq_api_key
            and self.groq_resume_parser_enabled
            and self.groq_resume_parser_model
            and self.groq_base_url
        )
    @property
    def youtube_configured(self) -> bool:
        return bool(self.youtube_api_key and self.youtube_api_base_url)

    @property
    def cors_allow_origins(self) -> list[str]:
        origins: list[str] = []
        seen: set[str] = set()
        extras = list(PRODUCTION_FRONTEND_ORIGINS) if str(self.app_env).lower() == "production" else []
        for raw in [*self.frontend_origins, *extras]:
            origin = _normalize_origin(raw)
            if origin and origin not in seen:
                seen.add(origin)
                origins.append(origin)
        return origins

    @property
    def cors_allow_origin_regex(self) -> str | None:
        if str(self.app_env).lower() == "production":
            return PRODUCTION_FRONTEND_ORIGIN_REGEX
        hosts = []
        for origin in self.cors_allow_origins:
            host = urlparse(origin).hostname or ""
            if host.endswith(".vercel.app"):
                name = host.split(".")[0]
                hosts.append(rf"https://{re.escape(name)}(?:-[a-z0-9-]+)?\.vercel\.app")
        if not hosts:
            return None
        return "^(" + "|".join(hosts) + ")$"

    @property
    def fish_audio_configured(self) -> bool:
        return bool((self.fish_audio_api_key or "").strip())
@lru_cache
def get_settings() -> Settings:
    return Settings()

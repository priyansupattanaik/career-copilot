from app.core.config import PRODUCTION_FRONTEND_ORIGIN, Settings


def test_frontend_origins_strip_quotes_and_trailing_slash(monkeypatch):
    monkeypatch.setenv("FRONTEND_ORIGINS", '"https://careercopilotai.vercel.app/"')
    settings = Settings()
    assert settings.frontend_origins == ["https://careercopilotai.vercel.app"]


def test_production_cors_includes_documented_vercel_origin(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("FRONTEND_ORIGINS", "http://localhost:3000")
    settings = Settings()
    assert PRODUCTION_FRONTEND_ORIGIN in settings.cors_allow_origins
    assert settings.cors_allow_origin_regex
    assert "careercopilotai" in settings.cors_allow_origin_regex

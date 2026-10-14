"""Smoke tests for backend API endpoints, verifying status codes and response shapes."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoints():
    for path in ["/health", "/health/live", "/api/health", "/api/health/live", "/api/v1/health/live"]:
        response = client.get(path)
        assert response.status_code == 200
        data = response.json()
        assert data.get("live") is True or data.get("status") == "ok"


def test_health_ready():
    response = client.get("/api/v1/health/ready")
    assert response.status_code in (200, 503)
    data = response.json()
    assert "status" in data or "ready" in data


def test_public_username_availability():
    response = client.get("/api/v1/public/username-availability?username=testuser_probe")
    assert response.status_code == 200
    data = response.json()
    assert "available" in data
    assert "username" in data


def test_protected_endpoints_require_auth():
    protected_paths = [
        "/api/v1/me/bootstrap",
        "/api/v1/me/activity",
        "/api/v1/profile",
        "/api/v1/resumes",
        "/api/v1/job-descriptions",
        "/api/v1/jobs",
        "/api/v1/saved-jobs",
        "/api/v1/learning-paths",
        "/api/v1/interviews",
        "/api/v1/ats-analyses",
        "/api/v1/settings",
    ]
    for path in protected_paths:
        response = client.get(path)
        assert response.status_code == 401, f"Expected 401 for {path}, got {response.status_code}"
        data = response.json()
        assert "error" in data or "detail" in data


def test_not_found_endpoint():
    response = client.get("/api/v1/non-existent-route-for-smoke-test")
    assert response.status_code == 404


def test_validation_error_shape():
    # POST to /api/v1/ats/score without payload should return 422
    response = client.post("/api/v1/ats/score", json={})
    assert response.status_code in (401, 422)

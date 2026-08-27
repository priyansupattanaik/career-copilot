import logging

from fastapi.testclient import TestClient

from app.main import app


def test_api_requests_emit_terminal_observability_logs(caplog):
    caplog.set_level(logging.INFO, logger="career_copilot.api")

    with TestClient(app) as client:
        response = client.get("/api/v1/health/live", headers={"X-Request-ID": "logging-test"})
        missing = client.get("/api/v1/route-that-does-not-exist")

    assert response.status_code == 200
    assert missing.status_code == 404
    messages = [record.getMessage() for record in caplog.records if record.name == "career_copilot.api"]
    assert any("api_request request_id=logging-test method=GET path=/api/v1/health/live status=200" in message for message in messages)
    assert any("api_request" in message and "path=/api/v1/route-that-does-not-exist status=404" in message for message in messages)

"""End-to-end smoke test suite verifying all routes, CRUD, and agent status."""
from uuid import UUID
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.features.auth.service import CurrentUser, get_current_user, get_current_user_optional


@pytest.fixture(autouse=True)
def override_auth():
    priyansu_id = UUID("e075fa64-240b-4db7-9bee-41e809909f7a")
    mock_user = CurrentUser(
        id=priyansu_id,
        email="priyansu@example.com",
        access_token="test-token",
        full_name="Priyansu Pattanaik",
        auth_provider="supabase",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_current_user_optional] = lambda: mock_user
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_user_optional, None)


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoints(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"

    r = client.get("/api/v1/health/ready")
    assert r.status_code == 200

    r = client.get("/api/v1/health/database")
    assert r.status_code == 200


def test_agents_status(client):
    r = client.get("/api/v1/agents/status")
    assert r.status_code == 200
    data = r.json()
    assert "agents" in data
    assert len(data["agents"]) > 0


def test_public_profile(client):
    r = client.get("/api/v1/public/profiles/priyansu")
    assert r.status_code == 200
    profile = r.json().get("profile", {})
    assert profile.get("username") == "priyansu"
    assert "full_name" in profile


def test_bootstrap_scopes(client):
    r_full = client.get("/api/v1/me/bootstrap?scope=full")
    assert r_full.status_code == 200

    r_shell = client.get("/api/v1/me/bootstrap?scope=shell")
    assert r_shell.status_code == 200


def test_profile_and_resumes(client):
    r_prof = client.get("/api/v1/profile")
    assert r_prof.status_code == 200

    r_res = client.get("/api/v1/resumes")
    assert r_res.status_code == 200
    assert isinstance(r_res.json(), list)


def test_jobs_and_saved_jobs(client):
    r_jobs = client.get("/api/v1/jobs")
    assert r_jobs.status_code == 200
    assert isinstance(r_jobs.json(), list)

    r_saved = client.get("/api/v1/saved-jobs")
    assert r_saved.status_code == 200
    assert isinstance(r_saved.json(), list)

    r_recs = client.get("/api/v1/job-recommendations")
    assert r_recs.status_code == 200


def test_interviews_and_tts(client):
    r_int = client.get("/api/v1/interviews")
    assert r_int.status_code == 200

    r_tts = client.get("/api/v1/interviews/tts/status")
    assert r_tts.status_code == 200


def test_ats_and_learning(client):
    r_ats = client.get("/api/v1/ats-analyses")
    assert r_ats.status_code == 200

    r_learn = client.get("/api/v1/learning-paths")
    assert r_learn.status_code == 200


def test_interview_session_crud(client):
    create_r = client.post("/api/v1/interviews", json={
        "mode": "technical",
        "target_role": "Senior Software Engineer",
        "target_company": "Acme Corp",
        "job_description_text": "Python, FastAPI, Supabase",
    })
    assert create_r.status_code == 201
    sid = create_r.json()["id"]

    get_r = client.get(f"/api/v1/interviews/{sid}")
    assert get_r.status_code == 200

    del_r = client.delete(f"/api/v1/interviews/{sid}")
    assert del_r.status_code == 204


def test_candidate_links_crud(client):
    create_r = client.post("/api/v1/profile/links", json={
        "link_type": "github",
        "url": "https://github.com/priyansupattanaik",
    })
    assert create_r.status_code == 201
    lid = create_r.json()["id"]

    del_r = client.delete(f"/api/v1/profile/links/{lid}")
    assert del_r.status_code == 204

from unittest.mock import MagicMock, patch

from app.features.freehire_api import FreehireClient


def test_freehire_client_maps_public_results_and_html_description():
    response = MagicMock(status_code=200)
    response.json.return_value = {
        "data": [{
            "public_slug": "backend-acme-123",
            "title": "Backend Engineer",
            "company": "Acme",
            "location": "Remote",
            "url": "https://freehire.me/jobs/backend-acme-123",
            "description": "<p>Build APIs</p><ul><li>Python</li></ul>",
            "skills": ["Python", "FastAPI"],
            "posted_at": "2026-08-28T00:00:00Z",
            "work_mode": "remote",
            "enrichment": {"salary_min": 100000, "salary_max": 120000},
        }]
    }
    with patch("app.features.freehire_api.httpx.get", return_value=response) as get:
        jobs = FreehireClient().search_jobs(["Backend Engineer"], ["Remote"])

    assert jobs[0]["source"] == "freehire"
    assert jobs[0]["external_id"] == "backend-acme-123"
    assert jobs[0]["requirements"] == ["Python", "FastAPI"]
    assert "Build APIs" in jobs[0]["description"]
    assert "<p>" not in jobs[0]["description"]
    get.assert_called_once()
    assert get.call_args.kwargs["params"]["q"] == "Backend Engineer OR Remote"

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def test_sync_external_jobs_persists_new_and_updates(monkeypatch):
    from app.api import router as api_router

    settings = SimpleNamespace(
        freehire_enabled=True,
        freehire_api_url="https://freehire.me",
        freehire_timeout_seconds=5.0,
        freehire_results_per_page=20,
        freehire_max_days_old=14,
    )
    user = SimpleNamespace(id="user-1")

    jobs_table = MagicMock()
    prefs_table = MagicMock()
    client = MagicMock()

    def table(name: str):
        if name == "candidate_preferences":
            return prefs_table
        if name == "jobs":
            return jobs_table
        return MagicMock()

    client.table.side_effect = table

    prefs_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
        data=[{"target_roles": ["Engineer"], "preferred_locations": ["Remote"]}]
    )

    jobs_table.select.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "job-existing", "external_id": "a2"}]
    )
    jobs_table.insert.return_value.execute.return_value = SimpleNamespace(data=[{"id": "new"}])
    jobs_table.update.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "job-existing"}]
    )

    fetched = [
        {
            "source": "freehire",
            "external_id": "a1",
            "title": "Role A",
            "company": "Co A",
            "location": "Remote",
            "description": "desc",
            "application_url": "https://example.com/a",
            "salary_min": 1,
            "salary_max": 2,
            "published_at": "2026-01-01T00:00:00Z",
            "latitude": 1.0,
            "longitude": 2.0,
            "requirements": [],
            "work_mode": "remote",
        },
        {
            "source": "freehire",
            "external_id": "a2",
            "title": "Role B",
            "company": "Co B",
            "location": "NYC",
            "description": "desc",
            "application_url": None,
            "salary_min": None,
            "salary_max": None,
            "published_at": None,
            "latitude": None,
            "longitude": None,
            "requirements": [],
            "work_mode": "hybrid",
        },
    ]

    with (
        patch.object(api_router, "client_for", return_value=client),
        patch.object(api_router, "write_activity"),
        patch("app.features.freehire_api.FreehireClient.search_jobs", return_value=fetched),
    ):
        result = api_router.sync_external_jobs(user=user, settings=settings)

    assert result["fetched"] == 2
    assert result["created"] == 1
    assert result["updated"] == 1
    assert jobs_table.insert.called
    assert jobs_table.update.called
    # work_mode must be written so generate filters and UI stay synced with the provider.
    insert_payload = jobs_table.insert.call_args[0][0]
    assert insert_payload.get("work_mode") == "remote"
    update_payload = jobs_table.update.call_args[0][0]
    assert update_payload.get("work_mode") == "hybrid"


def test_sync_external_jobs_can_use_freehire_without_provider_credentials():
    from app.api import router as api_router

    settings = SimpleNamespace(
        freehire_enabled=True,
        freehire_api_url="https://freehire.me",
        freehire_timeout_seconds=5.0,
        freehire_results_per_page=20,
        freehire_max_days_old=14,
    )
    user = SimpleNamespace(id="user-freehire")
    client = MagicMock()
    prefs_table = MagicMock()
    jobs_table = MagicMock()
    client.table.side_effect = lambda name: {
        "candidate_preferences": prefs_table,
        "jobs": jobs_table,
    }.get(name, MagicMock())
    prefs_table.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
        data=[{"target_roles": ["Data Engineer"], "preferred_locations": ["Remote"]}]
    )
    jobs_table.select.return_value.execute.return_value = SimpleNamespace(data=[])
    jobs_table.insert.return_value.execute.return_value = SimpleNamespace(data=[{"id": "new-freehire"}])

    fetched = [{
        "external_id": "freehire-role-1", "title": "Data Engineer", "company": "Acme",
        "location": "Remote", "description": "Python", "application_url": "https://freehire.me/jobs/freehire-role-1",
        "salary_min": None, "salary_max": None, "published_at": None, "latitude": None, "longitude": None,
        "requirements": ["Python"], "work_mode": "remote",
    }]
    with (
        patch.object(api_router, "client_for", return_value=client),
        patch.object(api_router, "write_activity"),
        patch("app.features.freehire_api.FreehireClient.search_jobs", return_value=fetched),
    ):
        result = api_router.sync_external_jobs(user=user, settings=settings)

    assert result["providers"] == ["freehire"]
    assert result["created"] == 1
    assert jobs_table.insert.call_args.args[0]["source"] == "freehire"

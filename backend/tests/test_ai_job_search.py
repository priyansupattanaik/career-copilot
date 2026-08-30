from unittest.mock import patch

from app.features.ai_job_search import AiJobSearchClient


def test_native_ai_job_search_uses_the_upstream_freehire_contract_without_bun():
    fetched = [{"source": "freehire", "external_id": "role-1", "title": "Engineer"}]
    with patch("app.features.freehire_api.FreehireClient.search_jobs", return_value=fetched) as search:
        result = AiJobSearchClient("https://freehire.me", timeout_seconds=5).search_jobs(
            ["Engineer"], ["Remote"], results_per_page=10, max_days_old=14
        )

    assert result == fetched
    search.assert_called_once_with(
        target_roles=["Engineer"],
        locations=["Remote"],
        results_per_page=10,
        max_days_old=14,
    )
    assert AiJobSearchClient.workflow == "ai-job-search-native-python"

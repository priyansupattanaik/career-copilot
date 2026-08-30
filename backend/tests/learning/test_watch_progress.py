from app.features.learning.watch_progress import (
    apply_watch_patch,
    item_percent,
    merge_watch_ranges,
    path_rollup,
    percent_from_seconds,
    resource_percent,
    unique_watched_seconds,
)


def test_merge_watch_ranges_joins_overlaps_and_ignores_inverted():
    merged = merge_watch_ranges([[10, 20], [18, 30], [40, 45], [50, 40], "bad"])
    assert merged == [[10, 30], [40, 45]]


def test_unique_seconds_do_not_count_skipped_gaps():
    assert unique_watched_seconds([[0, 10], [20, 30]]) == 20
    assert percent_from_seconds(20, 100) == 20


def test_skipping_to_the_end_does_not_complete_a_video():
    resource = apply_watch_patch(
        {},
        {
            "position_seconds": 980,
            "duration_seconds": 1000,
            "watched_ranges": [[975, 985]],
        },
        now="2026-01-01T00:00:00Z",
    )
    assert resource["watch_status"] == "in_progress"
    assert resource["watch_percent"] < 90
    assert resource_percent(resource) == resource["watch_percent"]


def test_watching_most_of_a_video_marks_complete():
    resource = apply_watch_patch(
        {},
        {
            "position_seconds": 910,
            "duration_seconds": 1000,
            "watched_ranges": [[0, 920]],
        },
        now="2026-01-01T00:00:00Z",
    )
    assert resource["watch_status"] == "completed"
    assert resource["watch_percent"] == 100


def test_article_open_is_half_until_marked_complete():
    opened = apply_watch_patch(
        {"resource_type": "article_search", "url": "https://www.google.com/search?q=docker"},
        {"opened": True},
        now="2026-01-01T00:00:00Z",
    )
    assert opened["watch_status"] == "in_progress"
    assert resource_percent(opened) == 50
    done = apply_watch_patch(opened, {"status": "completed"}, now="2026-01-01T00:01:00Z")
    assert resource_percent(done) == 100


def test_path_rollup_averages_resource_watch():
    items = [
        {
            "id": "i1",
            "status": "pending",
            "learning_resources": [
                {"id": "r1", "watch_status": "completed", "watch_percent": 100},
                {"id": "r2", "watch_status": "in_progress", "watch_percent": 40},
            ],
        },
        {
            "id": "i2",
            "status": "pending",
            "learning_resources": [
                {"id": "r3", "watch_status": "not_started", "watch_percent": 0},
            ],
        },
    ]
    assert item_percent(items[0]) == 70
    rollup = path_rollup(items)
    assert rollup["progress_percentage"] == 35
    assert rollup["watch_summary"]["resource_count"] == 3
    assert rollup["watch_summary"]["completed_resources"] == 1

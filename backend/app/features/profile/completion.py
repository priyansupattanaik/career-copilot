
from __future__ import annotations

from typing import Any


def _present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set)):
        return any(_present(item) for item in value)
    if isinstance(value, dict):
        return any(_present(item) for item in value.values())
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return True
    return bool(value)
def _has_nonempty_list(value: Any) -> bool:
    if not isinstance(value, (list, tuple)):
        return False
    return any(_present(item) for item in value)
CHECKLIST: list[dict[str, Any]] = [
    {
        "key": "full_name",
        "label": "Full name",
        "points": 1,
        "group": "about",
        "href": "/settings/profile#about",
    },
    {
        "key": "location",
        "label": "Location",
        "points": 1,
        "group": "about",
        "href": "/settings/profile#about",
    },
    {
        "key": "current_role",
        "label": "Current role",
        "points": 1,
        "group": "about",
        "href": "/settings/profile#about",
    },
    {
        "key": "years_experience",
        "label": "Years of experience",
        "points": 1,
        "group": "about",
        "href": "/settings/profile#about",
    },
    {
        "key": "skills",
        "label": "At least 1 skill",
        "points": 1,
        "group": "skills",
        "href": "/settings/profile#skills",
    },
    {
        "key": "experience",
        "label": "At least 1 experience (or 0 years for fresher)",
        "points": 1,
        "group": "background",
        "href": "/settings/profile#background",
    },
    {
        "key": "education",
        "label": "At least 1 education",
        "points": 1,
        "group": "background",
        "href": "/settings/profile#background",
    },
    {
        "key": "links",
        "label": "At least 1 link",
        "points": 1,
        "group": "about",
        "href": "/settings/profile#about",
    },
]
CHECKLIST_KEYS = frozenset(str(item["key"]) for item in CHECKLIST)


def _item_complete(key: str, context: dict[str, Any]) -> bool:
    profile = context.get("profile") if isinstance(context.get("profile"), dict) else {}
    if key == "full_name":
        return _present(profile.get("full_name"))
    if key == "location":
        return _present(profile.get("location"))
    if key == "current_role":
        return _present(profile.get("current_role"))
    if key == "years_experience":
        val = profile.get("years_experience")
        return val is not None and str(val).strip() != ""
    if key == "experience":
        return bool(context.get("has_experience") or context.get("no_experience_declared"))
    if key == "skills":
        try:
            return int(context.get("skill_count") or 0) > 0
        except (TypeError, ValueError):
            return False
    if key == "education":
        try:
            return int(context.get("education_count") or 0) > 0
        except (TypeError, ValueError):
            return False
    if key == "links":
        try:
            return int(context.get("link_count") or 0) > 0
        except (TypeError, ValueError):
            return False
    return False


def calculate_profile_completion(context: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    if not isinstance(context, dict):
        context = {}
    checklist: dict[str, bool] = {}
    missing: list[dict[str, Any]] = []
    completed: list[dict[str, Any]] = []

    total_items = len(CHECKLIST)  # 8
    done = 0

    for item in CHECKLIST:
        key = str(item["key"])
        is_done = _item_complete(key, context)
        checklist[key] = is_done
        entry = {
            "key": key,
            "label": str(item["label"]),
            "points": 1,
            "group": str(item.get("group") or "about"),
            "href": str(item.get("href") or "/settings/profile"),
        }
        if is_done:
            done += 1
            completed.append(entry)
        else:
            missing.append(entry)

    percentage = round((done / total_items) * 100) if total_items > 0 else 0
    percentage = max(0, min(100, int(percentage)))

    details: dict[str, Any] = {
        "total": percentage,
        "max": 100,
        "done": done,
        "total_items": total_items,
        "checklist": checklist,
        "missing": missing,
        "completed": completed,
        "missing_count": len(missing),
        "completed_count": len(completed),
        "label": "Profile complete" if done == total_items else f"{done} of {total_items} done",
    }
    return percentage, details


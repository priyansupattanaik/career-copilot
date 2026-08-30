from app.api.router import public_profile_directory_cards, public_profile_search_needle

ROWS = [
    {"username": "ada-lovelace", "full_name": "Ada Lovelace", "current_role": "AI engineer", "resume_text": "SECRET"},
    {"username": "", "full_name": "Hidden"},
    {"username": "grace-hopper", "full_name": "Grace Hopper", "current_role": "Compiler engineer"},
]


def test_empty_query_returns_no_profiles():
    assert public_profile_directory_cards(ROWS, "", 20) == []


def test_short_query_returns_no_profiles():
    assert public_profile_directory_cards(ROWS, "a", 20) == []


def test_query_filters_identity_fields_without_inventing_rows():
    cards = public_profile_directory_cards(ROWS, "AI engineer", 20)
    assert [card["username"] for card in cards] == ["ada-lovelace"]


def test_search_cards_never_copy_resume_fields():
    cards = public_profile_directory_cards(ROWS, "Ada", 20)
    assert cards[0]["username"] == "ada-lovelace"
    assert "resume_text" not in cards[0]


def test_at_username_query_matches_stored_handle():
    assert public_profile_search_needle("@ada-lovelace") == "ada-lovelace"
    cards = public_profile_directory_cards(ROWS, "@ada-lovelace", 20)
    assert [card["username"] for card in cards] == ["ada-lovelace"]

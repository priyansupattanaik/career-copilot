from app.features.interview.follow_up import (
    decide_interviewer_turn,
    is_follow_up_question,
    max_question_budget,
    merge_interviewer_turn,
)


def test_short_answer_gets_a_follow_up():
    turn = decide_interviewer_turn(
        answer="I fixed it.",
        question="Tell me about a challenging bug.",
        question_type="behavioural",
    )
    assert turn["should_follow_up"] is True
    assert turn["follow_up_question"]
    assert "score" not in turn["spoken_reply"].lower()


def test_complete_star_answer_does_not_follow_up():
    turn = decide_interviewer_turn(
        answer=(
            "Recently I owned a checkout latency issue. The situation was p95 over two seconds. "
            "I profiled the API, reduced N+1 queries, and shipped a cache layer. "
            "The result was p95 under 400ms and fewer timeouts."
        ),
        question="Tell me about a challenging bug you fixed.",
        question_type="behavioural",
    )
    assert turn["should_follow_up"] is False
    assert turn["follow_up_question"] is None


def test_does_not_chain_follow_ups():
    turn = decide_interviewer_turn(
        answer="I fixed it.",
        question="What specifically did you do?",
        question_type="follow_up",
        already_followed_up=True,
    )
    assert turn["should_follow_up"] is False
    assert turn["follow_up_question"] is None


def test_merge_prefers_llm_probe_when_valid():
    heuristic = decide_interviewer_turn(answer="Short.", question="Tell me about a time you led.")
    merged = merge_interviewer_turn(
        {
            "spoken_reply": "Stay with that example — what broke first?",
            "should_follow_up": True,
            "follow_up_question": "What broke first when you rolled it out?",
        },
        heuristic,
        already_followed_up=False,
    )
    assert merged["should_follow_up"] is True
    assert "broke first" in merged["follow_up_question"]
    assert "Stay with that example" in merged["spoken_reply"]


def test_merge_blocks_follow_up_on_follow_up_parent():
    heuristic = decide_interviewer_turn(
        answer="I owned the migration.",
        question="What specifically did you do?",
        already_followed_up=True,
    )
    merged = merge_interviewer_turn(
        {
            "spoken_reply": "Got it.",
            "should_follow_up": True,
            "follow_up_question": "And then what?",
        },
        heuristic,
        already_followed_up=True,
    )
    assert merged["should_follow_up"] is False
    assert merged["follow_up_question"] is None


def test_is_follow_up_question_reads_source_context():
    assert is_follow_up_question({"kind": "follow_up"}) is True
    assert is_follow_up_question({"kind": "seed"}) is False
    assert is_follow_up_question(None) is False


def test_question_budget_caps_at_twice_planned():
    assert max_question_budget({"question_count": 5}) == 10
    assert max_question_budget({"question_count": 20}) == 20
    assert max_question_budget({}) == 10

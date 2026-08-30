import { describe, expect, it } from "vitest";
import { decideInterviewerTurn, followUpBudget, maxLiveQuestionBudget } from "../live-turn";
import { buildLiveQuestions, spokenQuestionLine } from "../live-bank";

describe("decideInterviewerTurn", () => {
  it("asks a follow-up on a short answer", () => {
    const turn = decideInterviewerTurn({
      answer: "I fixed it.",
      question: "Tell me about a challenging bug.",
      questionType: "behavioural",
    });
    expect(turn.should_follow_up).toBe(true);
    expect(turn.follow_up_question).toBeTruthy();
  });

  it("does not chain follow-ups", () => {
    const turn = decideInterviewerTurn({
      answer: "I fixed it.",
      question: "What specifically did you do?",
      alreadyFollowedUp: true,
    });
    expect(turn.should_follow_up).toBe(false);
    expect(turn.follow_up_question).toBeNull();
  });

  it("moves on from a complete-enough answer even without STAR keywords", () => {
    const turn = decideInterviewerTurn({
      answer:
        "I owned the checkout delay last quarter. I profiled the API, cut N+1 queries, and shipped a cache layer so p95 dropped under 400 milliseconds.",
      question: "Tell me about a challenging bug.",
      questionType: "behavioural",
    });
    expect(turn.should_follow_up).toBe(false);
    expect(turn.follow_up_question).toBeNull();
  });

  it("does not follow up when the session budget is already used", () => {
    const turn = decideInterviewerTurn({
      answer: "I fixed it.",
      question: "Tell me about a challenging bug.",
      questionType: "behavioural",
      followUpsUsed: 2,
      seedCount: 5,
    });
    expect(turn.should_follow_up).toBe(false);
  });
});

describe("buildLiveQuestions", () => {
  it("returns the requested count instantly with a role filled in", () => {
    const questions = buildLiveQuestions({ mode: "technical", count: 5, targetRole: "Backend engineer" });
    expect(questions).toHaveLength(5);
    expect(questions[0].question).toMatch(/Backend engineer/i);
    expect(questions.every((item) => item.id && item.question.length >= 8)).toBe(true);
  });

  it("speaks like a person, not a form", () => {
    const questions = buildLiveQuestions({ mode: "mixed", count: 3, targetRole: "Backend engineer" });
    expect(questions[0].question.toLowerCase()).not.toContain("how you would contribute as a");
    expect(spokenQuestionLine({ question: questions[0].question, isFirst: true, isFollowUp: false, role: "Backend engineer" })).toMatch(
      /thanks for sitting down/i,
    );
    expect(spokenQuestionLine({ question: questions[1].question, isFirst: false, isFollowUp: false })).toMatch(/^Alright\./);
  });
});

describe("maxLiveQuestionBudget", () => {
  it("allows a small number of follow-ups, not one per question", () => {
    expect(followUpBudget(5)).toBe(2);
    expect(maxLiveQuestionBudget(5)).toBe(7);
    expect(maxLiveQuestionBudget(3)).toBe(4);
  });
});

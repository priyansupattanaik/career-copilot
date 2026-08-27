import { describe, expect, it } from "vitest";
import { decideInterviewerTurn, maxLiveQuestionBudget } from "../live-turn";
import { buildLiveQuestions } from "../live-bank";

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
});

describe("buildLiveQuestions", () => {
  it("returns the requested count instantly with a role filled in", () => {
    const questions = buildLiveQuestions({ mode: "technical", count: 5, targetRole: "Backend engineer" });
    expect(questions).toHaveLength(5);
    expect(questions[0].question).toMatch(/Backend engineer/i);
    expect(questions.every((item) => item.id && item.question.length >= 8)).toBe(true);
  });
});

describe("maxLiveQuestionBudget", () => {
  it("allows one follow-up per seed question", () => {
    expect(maxLiveQuestionBudget(5)).toBe(10);
  });
});

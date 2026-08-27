const STAR_MARKERS = [
  "situation",
  "task",
  "action",
  "result",
  "because",
  "i led",
  "i owned",
  "we shipped",
  "impact",
  "outcome",
  "measured",
];

const EXAMPLE_MARKERS = [
  "for example",
  "for instance",
  "when i",
  "one time",
  "recently",
  "last year",
  "on a project",
  "at my last",
];

const RESULT_MARKERS = [
  "result",
  "outcome",
  "impact",
  "shipped",
  "reduced",
  "increased",
  "improved",
  "saved",
  "grew",
  "%",
  "percent",
];

export type LiveTurn = {
  should_follow_up: boolean;
  follow_up_question: string | null;
  spoken_reply: string;
};

function countWords(text: string): number {
  return (text.toLowerCase().match(/[a-z']+/g) || []).length;
}

export function decideInterviewerTurn(options: {
  answer: string;
  question: string;
  questionType?: string | null;
  alreadyFollowedUp?: boolean;
}): LiveTurn {
  const text = (options.answer || "").trim();
  const wordCount = countWords(text);
  const lower = text.toLowerCase();
  const q = (options.question || "").trim().toLowerCase();
  const kind = (options.questionType || "").trim().toLowerCase();
  const starHits = STAR_MARKERS.reduce((sum, marker) => sum + (lower.includes(marker) ? 1 : 0), 0);
  const hasExample = EXAMPLE_MARKERS.some((token) => lower.includes(token));
  const hasResult = RESULT_MARKERS.some((token) => lower.includes(token));
  const behavioural =
    ["behavioural", "behavioral", "hr", "situational"].includes(kind) ||
    ["tell me about", "a time", "example", "conflict", "challenge"].some((token) => q.includes(token));

  if (options.alreadyFollowedUp) {
    return {
      should_follow_up: false,
      follow_up_question: null,
      spoken_reply: "Thanks, that helps. Let's keep going.",
    };
  }
  if (!text) {
    return {
      should_follow_up: true,
      follow_up_question:
        "Take that again with a bit more room — what happened, what did you do, and how did it turn out?",
      spoken_reply: "I didn't catch a full answer there. Let's stay on this one.",
    };
  }
  const completeEnough = wordCount >= 28 && (hasExample || starHits >= 2) && (hasResult || starHits >= 2);
  if (completeEnough) {
    return {
      should_follow_up: false,
      follow_up_question: null,
      spoken_reply: "Thanks, that was clear. Let's move on.",
    };
  }
  if (wordCount < 18) {
    return {
      should_follow_up: true,
      follow_up_question: "Expand on that — what was the situation, what did you personally do, and what changed?",
      spoken_reply: "That's a start, but I need more of the story.",
    };
  }
  if (behavioural && !hasExample) {
    return {
      should_follow_up: true,
      follow_up_question: "What specifically did you do, and what changed because of it?",
      spoken_reply: "I'm with you on the setup. Stay with that example for a second.",
    };
  }
  if (!hasExample) {
    return {
      should_follow_up: true,
      follow_up_question: "Can you walk me through one concrete example of that in practice?",
      spoken_reply: "Got it. I want to hear how that looked in a real situation.",
    };
  }
  if (behavioural && !hasResult) {
    return {
      should_follow_up: true,
      follow_up_question: "What was the result of that work — for you, the team, or the product?",
      spoken_reply: "Useful context. Let's land the outcome.",
    };
  }
  return {
    should_follow_up: false,
    follow_up_question: null,
    spoken_reply: "Thanks, that was clear. Let's move on.",
  };
}

export function maxLiveQuestionBudget(planned: number): number {
  const count = Math.max(1, Math.min(planned || 5, 20));
  return Math.min(20, count * 2);
}

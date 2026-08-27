import type { Question } from "@/features/interview/types";

const ROLE = "{role}";

const BANK: Record<string, Array<{ question: string; question_type: string }>> = {
  mixed: [
    { question: `Tell me about yourself and how you would contribute as a ${ROLE}.`, question_type: "hr" },
    { question: `Walk me through a challenging problem you solved that would matter in a ${ROLE} role.`, question_type: "behavioural" },
    { question: `How do you decide what to build first when the requirements are unclear?`, question_type: "technical" },
    { question: `Describe a time you disagreed with a teammate. What did you do, and what changed?`, question_type: "behavioural" },
    { question: `How would you debug a production issue that started after a recent release?`, question_type: "technical" },
    { question: `What does good ownership look like for you in a ${ROLE} seat?`, question_type: "hr" },
    { question: `Tell me about a project you would do differently now, and why.`, question_type: "behavioural" },
    { question: `How do you test that a change is safe before it ships?`, question_type: "technical" },
  ],
  behavioural: [
    { question: `Tell me about a time your plan changed and how you adapted.`, question_type: "behavioural" },
    { question: `Describe a conflict on a team. What did you do, and what was the result?`, question_type: "behavioural" },
    { question: `Give an example of when you had to influence people without authority.`, question_type: "behavioural" },
    { question: `Tell me about a failure. What did you own, and what did you change afterward?`, question_type: "behavioural" },
    { question: `When did you have to deliver under a tight deadline? How did you choose tradeoffs?`, question_type: "behavioural" },
    { question: `Describe a time you received hard feedback. What did you do next?`, question_type: "behavioural" },
    { question: `Tell me about a time you improved a process, not just a one-off task.`, question_type: "behavioural" },
    { question: `Give an example of mentoring or helping someone else succeed.`, question_type: "behavioural" },
  ],
  technical: [
    { question: `Walk me through how you would approach a technical problem in a ${ROLE} domain.`, question_type: "technical" },
    { question: `How would you design a simple, reliable API for one core workflow?`, question_type: "system_design" },
    { question: `A feature is slow in production. How do you find the cause?`, question_type: "technical" },
    { question: `How do you think about testing, edge cases, and failure modes?`, question_type: "technical" },
    { question: `What would you monitor after shipping a risky change?`, question_type: "technical" },
    { question: `How do you keep a codebase easy to change six months later?`, question_type: "technical" },
    { question: `Describe a technical decision you made and the tradeoff you accepted.`, question_type: "technical" },
    { question: `How would you explain a complex system to a non-engineer stakeholder?`, question_type: "technical" },
  ],
  hr: [
    { question: `Tell me about yourself, focused on work that would matter for a ${ROLE} role.`, question_type: "hr" },
    { question: `Why this kind of role, and why now?`, question_type: "hr" },
    { question: `How do you prefer to work with a manager and a team?`, question_type: "hr" },
    { question: `What are you looking for in your next role?`, question_type: "hr" },
    { question: `Tell me about a time you had to learn something quickly.`, question_type: "hr" },
    { question: `How do you handle stress or competing priorities?`, question_type: "hr" },
    { question: `What is a strength you would bring on day one?`, question_type: "hr" },
    { question: `What is something you are still working to improve?`, question_type: "hr" },
  ],
  role: [
    { question: `What does a strong ${ROLE} actually do in the first 90 days?`, question_type: "role" },
    { question: `Walk me through a piece of work that shows you can do this ${ROLE} job.`, question_type: "behavioural" },
    { question: `Which parts of a ${ROLE} role are you strongest in, and which are you still building?`, question_type: "hr" },
    { question: `How would you measure success in this ${ROLE} seat after six months?`, question_type: "role" },
    { question: `Describe a stakeholder you had to keep aligned while delivering.`, question_type: "behavioural" },
    { question: `What is the hardest part of this ${ROLE} work, in your experience?`, question_type: "role" },
  ],
};

function interpolate(template: string, role: string): string {
  const label = role.trim() || "this role";
  return template.replaceAll(ROLE, label);
}

export function buildLiveQuestions(options: {
  mode: string;
  count: number;
  targetRole?: string | null;
}): Question[] {
  const mode = (options.mode || "mixed").trim().toLowerCase();
  const bank = BANK[mode] || BANK.mixed;
  const count = Math.max(1, Math.min(Number(options.count) || 5, 8));
  const role = options.targetRole || "";
  return bank.slice(0, count).map((item, index) => ({
    id: `live-q-${index + 1}`,
    position: index + 1,
    question: interpolate(item.question, role),
    question_type: item.question_type,
    source_context: { provider: "live_bank", kind: "seed" },
  }));
}

export function liveFollowUpQuestion(id: string, position: number, question: string): Question {
  return {
    id,
    position,
    question,
    question_type: "follow_up",
    source_context: { provider: "live_turn", kind: "follow_up" },
  };
}

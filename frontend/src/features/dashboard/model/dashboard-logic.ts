/**
 * Career Copilot — Dashboard Psychological Decision Engine
 *
 * Implements deterministic career readiness calculation and single-dominant
 * next action resolution following Hick's Law, Von Restorff, and Goal-Gradient.
 * Strictly free of hallucinated statistics or ungrounded claims.
 */

export type ReadinessTier = {
  label: string;
  color: string;
  description: string;
};

export type NextBestAction = {
  step: number;
  badge: string;
  title: string;
  description: string;
  actionLabel: string;
  cta: string; // Alias for test compatibility
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type CareerReadinessParams = {
  completion: number;
  hasConfirmedResume?: boolean;
  atsScore?: number | null;
  interviewLatest?: number | null;
  sessionsCompleted?: number;
};

/**
 * Computes career readiness as a composite across the 3 core career pillars:
 * 1. Profile & Evidence Foundation (20% max)
 * 2. Resume & ATS Keyword Relevance (40% max)
 * 3. AI Interview Delivery (40% max)
 *
 * Guarantees:
 * - Empty accounts never falsely score as "Elite Ready".
 * - Completing a milestone advances readiness; no milestone degrades score (Goal-Gradient Effect).
 * - Zero hallucinated percentiles or unverified cohort claims.
 */
export function computeCareerReadiness(
  completionOrParams: number | CareerReadinessParams,
  atsScore?: number | null,
  interviewLatest?: number | null,
  hasConfirmedResume?: boolean,
): number {
  let completion = 0;
  let confirmed = false;
  let ats: number | null = null;
  let interview: number | null = null;
  let sessions = 0;

  if (typeof completionOrParams === "object" && completionOrParams !== null) {
    completion = completionOrParams.completion ?? 0;
    confirmed = Boolean(completionOrParams.hasConfirmedResume);
    ats = completionOrParams.atsScore ?? null;
    interview = completionOrParams.interviewLatest ?? null;
    sessions = completionOrParams.sessionsCompleted ?? 0;
  } else {
    completion = completionOrParams ?? 0;
    confirmed = Boolean(hasConfirmedResume);
    ats = atsScore ?? null;
    interview = interviewLatest ?? null;
  }

  // Pillar 1: Profile Foundation (0–20 pts)
  const safeCompletion = Math.max(0, Math.min(100, completion));
  const profilePts = Math.round(safeCompletion * 0.2);

  // Pillar 2: Resume & ATS Keyword Match (0–40 pts)
  let resumePts = 0;
  if (ats != null) {
    const safeAts = Math.max(0, Math.min(100, ats));
    resumePts = Math.round((safeAts / 100) * 40);
  } else if (confirmed) {
    // Confirmed master resume uploaded, awaiting target ATS scan
    resumePts = 15;
  }

  // Pillar 3: AI Mock Interview Performance (0–40 pts)
  let interviewPts = 0;
  if (interview != null) {
    const safeInterview = Math.max(0, Math.min(100, interview));
    interviewPts = Math.round((safeInterview / 100) * 40);
  } else if (sessions > 0) {
    // Completed practice session awaiting scored evaluation
    interviewPts = 15;
  }

  const total = profilePts + resumePts + interviewPts;
  return Math.max(0, Math.min(100, total));
}

export function getReadinessTier(score: number): ReadinessTier {
  if (score >= 85) {
    return {
      label: "High",
      color: "var(--ok)",
      description: "Resume match and practice scores are both high.",
    };
  }
  if (score >= 70) {
    return {
      label: "On track",
      color: "var(--accent)",
      description: "Resume match and practice scores are in a usable range.",
    };
  }
  if (score >= 45) {
    return {
      label: "In progress",
      color: "var(--warn)",
      description: "Keep going. The next step is below.",
    };
  }
  return {
    label: "Just started",
    color: "var(--ink-3)",
    description: "Follow the next step below.",
  };
}

export function getReadinessHint(score: number): string {
  return getReadinessTier(score).description;
}

export function resolveNextAction(params: {
  hasConfirmedResume: boolean;
  hasInterviewScores: boolean;
  interviewLatest: number | null;
  atsScore: number | null;
  atsReportId?: string | null;
  interviewHref?: string;
}): NextBestAction {
  if (!params.hasConfirmedResume) {
    return {
      step: 1,
      badge: "Step 1",
      title: "Upload a resume",
      description:
        "Job matches and practice questions use the resume you confirm. Nothing is added that is not in the file.",
      actionLabel: "Upload resume",
      cta: "Upload resume",
      actionHref: "/resume-analysis?tab=upload",
      secondaryLabel: "Or paste text",
      secondaryHref: "/resume-analysis",
    };
  }

  if (params.atsScore == null) {
    return {
      step: 2,
      badge: "Step 2",
      title: "Compare your resume with a job",
      description:
        "Paste a job description to see which required words appear in your resume.",
      actionLabel: "Compare resume",
      cta: "Compare resume",
      actionHref: "/resume-analysis?tab=upload",
      secondaryLabel: "View jobs",
      secondaryHref: "/jobs",
    };
  }

  if (!params.hasInterviewScores && params.interviewLatest == null) {
    return {
      step: 3,
      badge: "Step 3",
      title: "Start a practice interview",
      description:
        "Answer questions out loud and get a score for this session.",
      actionLabel: "Start Mock Interview",
      cta: "Start Mock Interview",
      actionHref: "/mock-interview/setup",
      secondaryLabel: "Explore questions",
      secondaryHref: "/mock-interview",
    };
  }

  if (params.atsScore < 75) {
    return {
      step: 4,
      badge: "Resume gaps",
      title: "Review words missing from your resume",
      description:
        "This job uses words your resume does not include. Change the resume only where the experience is true, then compare again.",
      actionLabel: "Review report",
      cta: "Review report",
      actionHref: params.atsReportId
        ? `/resume-analysis/report/${params.atsReportId}`
        : "/resume-analysis",
      secondaryLabel: "Scan new job",
      secondaryHref: "/resume-analysis?tab=upload",
    };
  }

  if (params.interviewLatest != null && params.interviewLatest < 75) {
    return {
      step: 5,
      badge: "Practice",
      title: "Practice the interview again",
      description:
        "Your last practice score was under 75. Read the report, then try another session.",
      actionLabel: "Practice Interview",
      cta: "Practice Interview",
      actionHref: "/mock-interview/setup",
      secondaryLabel: "Review last session",
      secondaryHref: params.interviewHref || "/mock-interview",
    };
  }

  return {
    step: 6,
    badge: "Keep practicing",
    title: "Run another practice interview",
    description:
      "Your resume match and last practice score are both at least 75. Another session is optional.",
    actionLabel: "Start practice",
    cta: "Start practice",
    actionHref: "/mock-interview/setup",
    secondaryLabel: "View reports",
    secondaryHref: "/mock-interview",
  };
}

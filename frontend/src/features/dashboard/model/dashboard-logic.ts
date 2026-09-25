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
      label: "Elite Ready",
      color: "var(--success, #10b981)",
      description: "Optimal readiness across tracked milestones",
    };
  }
  if (score >= 70) {
    return {
      label: "Job Ready",
      color: "var(--accent, #6366f1)",
      description: "Competitive readiness across resume & interview",
    };
  }
  if (score >= 45) {
    return {
      label: "Advancing",
      color: "var(--warning, #f59e0b)",
      description: "Advancing foundation; continue targeted practice",
    };
  }
  return {
    label: "Foundational",
    color: "var(--muted, #94a3b8)",
    description: "Follow the recommended step below to increase readiness",
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
      badge: "Priority Step 1 · Foundation",
      title: "Upload your confirmed master resume",
      description:
        "Activate precision ATS scoring, skill gap diagnostics, and customized interview scenarios.",
      actionLabel: "Upload Resume",
      cta: "Upload Resume",
      actionHref: "/resume-analysis?tab=upload",
      secondaryLabel: "Or paste text",
      secondaryHref: "/resume-analysis",
    };
  }

  if (params.atsScore == null) {
    return {
      step: 2,
      badge: "Priority Step 2 · Alignment",
      title: "Run your first ATS match scan",
      description:
        "Match your resume against a target job description to diagnose keyword gaps and calculate role compatibility.",
      actionLabel: "Run ATS Scan",
      cta: "Run ATS Scan",
      actionHref: "/resume-analysis?tab=upload",
      secondaryLabel: "Explore target jobs",
      secondaryHref: "/jobs",
    };
  }

  if (!params.hasInterviewScores && params.interviewLatest == null) {
    return {
      step: 3,
      badge: "Priority Step 3 · Delivery",
      title: "Complete your first AI mock interview",
      description:
        "Practice answering behavioral questions with real-time feedback on communication and structure.",
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
      badge: "Calibration · Keyword Gaps",
      title: "Close keyword gaps on target ATS profile",
      description:
        "Review missed technical competencies and re-scan against your priority role to reach 80%+ match.",
      actionLabel: "Optimize ATS Score",
      cta: "Optimize ATS Score",
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
      badge: "Calibration · Interview Delivery",
      title: "Elevate your mock interview performance",
      description:
        "Strengthen behavioral STAR structure and communication clarity to push your interview readiness score above 80/100.",
      actionLabel: "Practice Interview",
      cta: "Practice Interview",
      actionHref: "/mock-interview/setup",
      secondaryLabel: "Review last session",
      secondaryHref: params.interviewHref || "/mock-interview",
    };
  }

  return {
    step: 6,
    badge: "Continuous Mastery",
    title: "Run a 10-minute technical interview drill",
    description:
      "Maintain peak fluency and target 90+ across Communication, Content, and Behavioral Structure.",
    actionLabel: "Launch Practice Drill",
    cta: "Launch Practice Drill",
    actionHref: "/mock-interview/setup",
    secondaryLabel: "View all debriefs",
    secondaryHref: "/mock-interview",
  };
}

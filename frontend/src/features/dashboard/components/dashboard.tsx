import { Link } from "@/shared/ui/router-link";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "motion/react";
import "@/features/dashboard/dashboard.css";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "@/components/ui/motion-system";
import {
  extractMissing,
  resolveCompletion,
} from "@/features/profile/model/profile-completion";
import { isDemoSession } from "@/features/auth/demo-session";
import { Card } from "@/shared/ui/primitives";
import {
  AnimatedNumber,
  DimensionBars,
  type InterviewProgress,
} from "@/features/dashboard/components/interview-progress-charts";
import { useWorkspaceBootstrap } from "@/features/workspace/bootstrap-context";
import {
  computeCareerReadiness,
  getReadinessTier,
  getReadinessHint,
  resolveNextAction,
} from "@/features/dashboard/model/dashboard-logic";

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readDemoMode() {
  return isDemoSession();
}

function subscribeDemoMode() {
  return () => undefined;
}

/** High-contrast skeleton loading state with polite screen-reader accessibility */
function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton" aria-busy="true" aria-live="polite">
      <span className="dashboard-visually-hidden">Loading your career workspace snapshot</span>
      <div className="dashboard-skel-card dashboard-skel-hero" />
      <div className="dashboard-skel-grid">
        <div className="dashboard-skel-card dashboard-skel-pillar" />
        <div className="dashboard-skel-card dashboard-skel-pillar" />
        <div className="dashboard-skel-card dashboard-skel-pillar" />
      </div>
      <div className="dashboard-skel-card dashboard-skel-stream" />
    </div>
  );
}

/** Glowing Circular Arc Gauge for Career Readiness with collision-safe IDs and padded viewBox */
function CircularReadinessGauge({
  score,
  size = 136,
  stroke = 10,
}: {
  score: number;
  size?: number;
  stroke?: number;
}) {
  const rawId = useId();
  const safeId = rawId.replace(/:/g, "");
  const gradientId = `readiness-grad-${safeId}`;
  const filterId = `readiness-glow-${safeId}`;
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const padding = 8;
  const viewBoxSize = size + padding * 2;
  const center = viewBoxSize / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeScore = Math.max(0, Math.min(100, score));
  const targetOffset = circumference - (safeScore / 100) * circumference;
  const currentOffset = mounted || reduceMotion ? targetOffset : circumference;

  return (
    <div
      className="dashboard-readiness-gauge"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Career readiness score: ${safeScore} percent`}
    >
      <svg
        className="dashboard-gauge-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Track */}
        <circle
          className="dashboard-gauge-track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
        />
        {/* Progress Arc */}
        <circle
          className="dashboard-gauge-fill"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={currentOffset}
          strokeLinecap="round"
          filter={`url(#${filterId})`}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="dashboard-gauge-content" aria-hidden="true">
        <span className="dashboard-gauge-value">
          <AnimatedNumber value={safeScore} />
          <small className="dashboard-gauge-pct">%</small>
        </span>
        <span className="dashboard-gauge-sub">Readiness</span>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, error, loading, refresh } = useWorkspaceBootstrap();
  const demoMode = useSyncExternalStore(subscribeDemoMode, readDemoMode, () => false);
  const reduceMotion = useReducedMotion();
  const [activityExpanded, setActivityExpanded] = useState(false);

  const first = data?.profile?.full_name?.split(" ")[0] || "there";
  const details =
    data?.workspace?.profile_completion_details || data?.profile?.profile_completion_details || null;
  const missing = extractMissing(details, data?.workspace?.profile_missing);
  const completion = resolveCompletion(
    data?.workspace?.profile_completion ?? data?.profile?.profile_completion,
    details,
    missing,
  );

  const actions = data?.latest_actions;
  const lastResume = actions?.last_resume_upload;
  const hasConfirmedResume = Boolean(
    data?.workspace?.has_confirmed_resume ||
    data?.active_resume?.id ||
    lastResume?.resume_id,
  );
  const lastInterview = actions?.last_interview;
  const lastJob = actions?.last_job_applied;

  const atsScore =
    data?.latest_ats_analysis?.overall_score == null
      ? null
      : Math.round(Number(data.latest_ats_analysis.overall_score));

  const interviewProgress = data?.interview_progress as InterviewProgress | null | undefined;
  const interviewLatest = interviewProgress?.latest_overall ?? null;
  const interviewDelta = interviewProgress?.delta ?? null;
  const history = interviewProgress?.history || [];
  const hasInterviewScores = history.some((h) => h.overall_score != null);

  // Compute Career Readiness Score & honest motivational tier
  const careerReadinessScore = computeCareerReadiness({
    completion,
    hasConfirmedResume,
    atsScore,
    interviewLatest,
    sessionsCompleted: interviewProgress?.sessions_completed,
  });
  const readinessTier = getReadinessTier(careerReadinessScore);
  const readinessHint = getReadinessHint(careerReadinessScore);

  const interviewHref = lastInterview?.id
    ? interviewLatest != null
      ? `/mock-interview/report/${lastInterview.id}`
      : `/mock-interview/session/${lastInterview.id}`
    : "/mock-interview";

  const atsHref = data?.latest_ats_analysis?.id
    ? `/resume-analysis/report/${data.latest_ats_analysis.id}`
    : "/resume-analysis?tab=upload";

  // Contextual Next Best Action computation (Psychological Flow: Exactly 1 dominant goal)
  const nextAction = resolveNextAction({
    hasConfirmedResume,
    hasInterviewScores,
    interviewLatest,
    atsScore,
    atsReportId: data?.latest_ats_analysis?.id,
    interviewHref,
  });

  // Pipeline Status Counters
  const counts = data?.counts || {};
  const savedJobsCount = counts.saved_jobs ?? (lastJob ? 1 : 0);
  const appliedJobsCount = counts.applied_jobs ?? (lastJob?.is_application ? 1 : 0);
  const interviewingCount = counts.interviewing_jobs ?? (lastInterview ? 1 : 0);
  const offerCount = counts.offers_count ?? 0;

  // Real ATS Matched & Missing Skills from analysis (limited to top 3 to prevent cognitive clutter)
  const breakdown = data?.latest_ats_analysis?.score_breakdown;
  const analysisSummary = data?.latest_ats_analysis?.summary;
  const realMatchedSkills: string[] =
    breakdown?.matched_terms?.length
      ? breakdown.matched_terms.slice(0, 3)
      : [];
  const realMissingSkills: string[] =
    breakdown?.missing_terms?.length
      ? breakdown.missing_terms.slice(0, 3)
      : analysisSummary?.missing_terms?.length
      ? analysisSummary.missing_terms.slice(0, 3)
      : [];
  const hasAtsKeywords = realMatchedSkills.length > 0 || realMissingSkills.length > 0;

  // Active Job Radar Preview - Authentic user-tracked job
  const activeJob = data?.active_job_description;
  const hasActiveJob = Boolean(
    activeJob?.title ||
    activeJob?.role_title ||
    lastJob?.title ||
    lastJob?.label
  );
  const activeJobTitle =
    activeJob?.role_title ||
    activeJob?.title ||
    lastJob?.title ||
    lastJob?.label ||
    "";
  const activeJobCompany =
    activeJob?.company ||
    lastJob?.company ||
    "Target Organization";
  const activeJobLocation = activeJob?.location || "Remote / Hybrid";
  const targetJobHref = activeJob?.id
    ? `/jobs/${activeJob.id}`
    : lastJob?.job_id
    ? `/jobs/${lastJob.job_id}`
    : "/jobs";

  const emptyStreamCta = !hasConfirmedResume
    ? { label: "Upload resume to start tracking", href: "/resume-analysis?tab=upload" }
    : atsScore == null
    ? { label: "Run your first ATS match scan", href: "/resume-analysis?tab=upload" }
    : { label: "Practice a mock interview session", href: "/mock-interview/setup" };

  // Dimension Bars preview subset
  const dimensionSubset = interviewProgress?.dimensions
    ? {
        communication: interviewProgress.dimensions.communication,
        structure: interviewProgress.dimensions.structure,
        content: interviewProgress.dimensions.content,
      }
    : undefined;

  const containerVariants = reduceMotion
    ? { hidden: {}, visible: {} }
    : staggerContainerVariants;
  const itemVariants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : staggerItemVariants;

  if (loading && !data && !error) {
    return (
      <div className="feature-page dashboard-page">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      className="feature-page dashboard-page"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* 1. Focused Page Header: Warm Welcome + Calm Status (No competing primary CTA) */}
      <motion.header variants={itemVariants} className="dashboard-top-header">
        <div className="dashboard-header-text">
          <div className="dashboard-welcome-row">
            <h1 className="dashboard-title">Welcome back, {first}</h1>
            <span
              className="dashboard-header-tier-pill"
              style={{ borderColor: readinessTier.color, color: readinessTier.color }}
            >
              <CopilotIcon name="check" size={12} />
              <span>{readinessTier.label}</span>
            </span>
            {completion < 100 && (
              <Link
                className="dashboard-header-profile-link"
                href="/settings/profile"
                aria-label={`Profile ${completion}% complete. Click to add missing profile details`}
              >
                <span>Profile {completion}%</span>
                <CopilotIcon name="go" size={10} />
              </Link>
            )}
          </div>
          <p className="dashboard-subtitle">
            Your career command center. Focus on the single action that moves you closest to an offer.
          </p>
        </div>
      </motion.header>

      {/* Demo Notice Alert */}
      {demoMode && (
        <motion.div variants={itemVariants} className="feature-alert" data-tone="info" role="status">
          <p className="eyebrow" style={{ margin: 0 }}>
            Demo Mode Active
          </p>
          <p>
            You are exploring live mock analytics. Sign in with Google or email to sync real resumes,
            live ATS scoring, and interview transcripts.
          </p>
        </motion.div>
      )}

      {/* Error Alert with Principle-Backed Formula: What + Why + Fix */}
      {error && (
        <motion.div variants={itemVariants} className="feature-alert" role="alert">
          <p className="eyebrow" style={{ margin: 0 }}>Sync Notice</p>
          <p className="field-error">
            Could not refresh your career snapshot ({error}). Check your internet connection and retry.
          </p>
          <button type="button" className="button button-secondary" onClick={() => refresh()}>
            Retry Sync
          </button>
        </motion.div>
      )}

      {/* 2. Hero Command Center: Single Dominant Next Best Action (Von Restorff + Hick's Law) */}
      <motion.section variants={itemVariants} aria-label="Career Readiness & Priority Goal">
        <div className="dashboard-hero-card">
          <div className="dashboard-hero-glow" aria-hidden="true" />

          {/* Left: Overall Readiness Radial Gauge */}
          <div className="dashboard-hero-gauge-col">
            <CircularReadinessGauge score={careerReadinessScore} />
            <div className="dashboard-hero-gauge-meta">
              <span className="dashboard-hero-gauge-title">Career Readiness</span>
              <span className="dashboard-hero-gauge-hint">{readinessHint}</span>
            </div>
          </div>

          {/* Right: The ONE Dominant Next Best Action */}
          <div className="dashboard-hero-action-col">
            <div className="dashboard-action-badge-row">
              <span className="dashboard-action-pill">{nextAction.badge}</span>
              <span className="dashboard-action-status-dot">
                <CopilotIcon name="assist" size={13} />
                Priority Milestone
              </span>
            </div>

            <h2 className="dashboard-hero-action-title">{nextAction.title}</h2>
            <p className="dashboard-hero-action-desc">{nextAction.description}</p>

            <div className="dashboard-hero-action-buttons">
              <Link className="button button-primary dashboard-hero-primary-btn" href={nextAction.actionHref}>
                <span>{nextAction.actionLabel}</span>
                <CopilotIcon name="go" size={16} />
              </Link>
              {nextAction.secondaryHref && (
                <Link className="dashboard-hero-secondary-link" href={nextAction.secondaryHref}>
                  <span>{nextAction.secondaryLabel}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* 3. The 3 Core Pillars (Gestalt Proximity & Cognitive Chunking: Interview, Resume, Pipeline) */}
      <motion.section
        variants={itemVariants}
        className="dashboard-pillars-grid"
        aria-label="Core Career Pillars"
      >
        {/* Pillar 1: Interview Readiness */}
        <article className="dashboard-pillar-card pillar-interview">
          <div className="dashboard-pillar-head">
            <div className="dashboard-pillar-head-title">
              <div className="dashboard-pillar-icon-box icon-purple">
                <CopilotIcon name="interview" size={18} />
              </div>
              <div>
                <span className="dashboard-pillar-eyebrow">Practice</span>
                <h3 className="dashboard-pillar-name">AI Mock Interview</h3>
              </div>
            </div>
            {interviewDelta != null && (
              <span
                className="dashboard-delta-chip"
                data-tone={interviewDelta > 0 ? "up" : interviewDelta < 0 ? "down" : "flat"}
              >
                {interviewDelta > 0 ? `+${interviewDelta}` : interviewDelta} pts
              </span>
            )}
          </div>

          <div className="dashboard-pillar-body">
            <div className="dashboard-pillar-metric-block">
              <div className="dashboard-pillar-large-score">
                {interviewLatest != null ? <AnimatedNumber value={interviewLatest} /> : "—"}
                {interviewLatest != null && <span className="dashboard-pillar-score-unit">/100</span>}
              </div>
              <p className="dashboard-pillar-metric-desc">
                {interviewLatest != null
                  ? `${interviewProgress?.sessions_completed || 1} scored sessions completed`
                  : "No interview sessions completed yet"}
              </p>
            </div>

            {/* Dimension Breakdown or Clean Explainer */}
            <div className="dashboard-pillar-details">
              {dimensionSubset && interviewLatest != null ? (
                <DimensionBars dimensions={dimensionSubset} />
              ) : (
                <div className="dashboard-pillar-empty-callout">
                  <p>Practice behavioral & role-specific questions with immediate AI grading.</p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-pillar-foot">
            <Link className="button button-secondary pillar-action-btn" href="/mock-interview/setup">
              <CopilotIcon name="play" size={14} />
              <span>{interviewLatest != null ? "Practice Again" : "Start Interview"}</span>
            </Link>
            <Link className="dashboard-pillar-link" href={interviewHref}>
              <span>{interviewLatest != null ? "View Debrief" : "Session History"}</span>
              <CopilotIcon name="go" size={12} />
            </Link>
          </div>
        </article>

        {/* Pillar 2: Resume & ATS Keyword Alignment */}
        <article className="dashboard-pillar-card pillar-ats">
          <div className="dashboard-pillar-head">
            <div className="dashboard-pillar-head-title">
              <div className="dashboard-pillar-icon-box icon-blue">
                <CopilotIcon name="scan" size={18} />
              </div>
              <div>
                <span className="dashboard-pillar-eyebrow">Relevance</span>
                <h3 className="dashboard-pillar-name">ATS Resume Match</h3>
              </div>
            </div>
            <span
              className="dashboard-stat-badge"
              data-status={hasConfirmedResume ? "verified" : "empty"}
            >
              {hasConfirmedResume ? <CopilotIcon name="check" size={12} /> : null}
              {hasConfirmedResume ? "Master Active" : "No Resume"}
            </span>
          </div>

          <div className="dashboard-pillar-body">
            <div className="dashboard-pillar-metric-block">
              <div className="dashboard-pillar-large-score">
                {atsScore != null ? <AnimatedNumber value={atsScore} /> : "—"}
                {atsScore != null && <span className="dashboard-pillar-score-unit">% match</span>}
              </div>
              <p className="dashboard-pillar-metric-desc">
                {atsScore != null
                  ? `Target role match · ${lastResume?.title || lastResume?.filename || "Active Resume"}`
                  : hasConfirmedResume
                  ? `Active: ${lastResume?.title || lastResume?.filename || "Master Resume"} · Ready to scan`
                  : "Upload resume to calculate match"}
              </p>
            </div>

            {/* Keyword tags or helpful prompt */}
            <div className="dashboard-pillar-details">
              {hasAtsKeywords ? (
                <div className="dashboard-keyword-summary">
                  {realMatchedSkills.length > 0 && (
                    <div className="dashboard-compact-chips">
                      <span className="dashboard-chip-label">Strengths:</span>
                      <div className="dashboard-chips-row">
                        {realMatchedSkills.map((s) => (
                          <span key={s} className="dashboard-tag-chip tag-matched">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {realMissingSkills.length > 0 && (
                    <div className="dashboard-compact-chips">
                      <span className="dashboard-chip-label">Key Gaps:</span>
                      <div className="dashboard-chips-row">
                        {realMissingSkills.map((g) => (
                          <span key={g} className="dashboard-tag-chip tag-gap">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="dashboard-pillar-empty-callout">
                  <p>
                    {hasConfirmedResume
                      ? "Run a scan against your target role to identify matched competencies."
                      : "Upload your resume to calculate keyword alignment and discover gaps."}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-pillar-foot">
            <Link className="button button-secondary pillar-action-btn" href="/resume-analysis?tab=upload">
              <CopilotIcon name="scan" size={14} />
              <span>{hasConfirmedResume ? "Run ATS Scan" : "Upload Resume"}</span>
            </Link>
            <Link className="dashboard-pillar-link" href={atsHref}>
              <span>{data?.latest_ats_analysis?.id ? "Full Report" : "All Resumes"}</span>
              <CopilotIcon name="go" size={12} />
            </Link>
          </div>
        </article>

        {/* Pillar 3: Application Pipeline & Target Job */}
        <article className="dashboard-pillar-card pillar-pipeline">
          <div className="dashboard-pillar-head">
            <div className="dashboard-pillar-head-title">
              <div className="dashboard-pillar-icon-box icon-amber">
                <CopilotIcon name="work" size={18} />
              </div>
              <div>
                <span className="dashboard-pillar-eyebrow">Momentum</span>
                <h3 className="dashboard-pillar-name">Application Pipeline</h3>
              </div>
            </div>
            <Link className="dashboard-pillar-link" href="/jobs">
              <span>Job Board</span>
              <CopilotIcon name="go" size={12} />
            </Link>
          </div>

          <div className="dashboard-pillar-body">
            {/* Visual 4-Step Pipeline Flow */}
            <div className="dashboard-pipeline-strip">
              <div className="dashboard-pipeline-step">
                <span className="dashboard-step-count"><AnimatedNumber value={savedJobsCount} /></span>
                <span className="dashboard-step-name">Saved</span>
              </div>
              <div className="dashboard-pipeline-connector" aria-hidden="true" />
              <div className="dashboard-pipeline-step">
                <span className="dashboard-step-count"><AnimatedNumber value={appliedJobsCount} /></span>
                <span className="dashboard-step-name">Applied</span>
              </div>
              <div className="dashboard-pipeline-connector" aria-hidden="true" />
              <div className="dashboard-pipeline-step">
                <span className="dashboard-step-count"><AnimatedNumber value={interviewingCount} /></span>
                <span className="dashboard-step-name">Interviewing</span>
              </div>
              <div className="dashboard-pipeline-connector" aria-hidden="true" />
              <div className="dashboard-pipeline-step step-offers">
                <span className="dashboard-step-count"><AnimatedNumber value={offerCount} /></span>
                <span className="dashboard-step-name">Offers</span>
              </div>
            </div>

            {/* Target Job Card or Empty Action */}
            <div className="dashboard-pillar-details">
              {hasActiveJob ? (
                <Link className="dashboard-tracked-job-card" href={targetJobHref}>
                  <div className="dashboard-tracked-job-main">
                    <h4 className="dashboard-tracked-job-title">{activeJobTitle}</h4>
                    <p className="dashboard-tracked-job-company">
                      {activeJobCompany} · {activeJobLocation}
                    </p>
                  </div>
                  {atsScore != null && (
                    <div className="dashboard-tracked-job-badge">
                      <span>{atsScore}%</span>
                      <small>Match</small>
                    </div>
                  )}
                </Link>
              ) : (
                <div className="dashboard-pillar-empty-callout">
                  <p>Pin target job listings from the Job Radar to track match scoring in real time.</p>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-pillar-foot">
            <Link className="button button-secondary pillar-action-btn" href="/jobs">
              <CopilotIcon name="search" size={14} />
              <span>Explore Roles</span>
            </Link>
            <Link className="dashboard-pillar-link" href="/jobs">
              <span>Manage Board</span>
              <CopilotIcon name="go" size={12} />
            </Link>
          </div>
        </article>
      </motion.section>

      {/* 4. Velocity Stream: Collapsible Audit Log (Progressive Disclosure - Tesler's Law) */}
      <motion.section variants={itemVariants} className="dashboard-stream-section" aria-label="Recent Activity Stream">
        <Card className="dashboard-velocity-card">
          <div className="dashboard-velocity-header">
            <div className="dashboard-velocity-left">
              <div className="dashboard-velocity-pulse" aria-hidden="true" />
              <div>
                <h3 className="dashboard-velocity-title">Recent Activity</h3>
                <p className="dashboard-velocity-desc">
                  Live audit stream of your uploads, interviews, ATS runs, and applications.
                </p>
              </div>
            </div>
            {data?.recent_activity && data.recent_activity.length > 3 && (
              <button
                type="button"
                className="dashboard-stream-toggle-btn"
                onClick={() => setActivityExpanded((prev) => !prev)}
                aria-expanded={activityExpanded}
                aria-label={activityExpanded ? "Collapse activity timeline" : "Show all activity"}
              >
                <span>{activityExpanded ? "Show Less" : `View All (${data.recent_activity.length})`}</span>
                <CopilotIcon
                  name={activityExpanded ? "collapse" : "expand"}
                  size={14}
                  className="dashboard-stream-arrow"
                />
              </button>
            )}
          </div>

          <div className="dashboard-velocity-timeline">
            {data?.recent_activity && data.recent_activity.length > 0 ? (
              (activityExpanded ? data.recent_activity : data.recent_activity.slice(0, 3)).map((item) => (
                <div key={item.id} className="dashboard-velocity-item">
                  <div className="dashboard-velocity-dot" aria-hidden="true" />
                  <div className="dashboard-velocity-content">
                    <p className="dashboard-velocity-summary">{item.summary}</p>
                    <span className="dashboard-velocity-time">{formatWhen(item.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="dashboard-velocity-empty">
                <CopilotIcon name="history" size={20} className="dashboard-velocity-empty-icon" />
                <div className="dashboard-velocity-empty-content">
                  <p>No recent activity recorded yet. Scored interviews and resume evaluations will log here.</p>
                  <Link className="dashboard-velocity-empty-cta" href={emptyStreamCta.href}>
                    <span>{emptyStreamCta.label}</span>
                    <CopilotIcon name="go" size={11} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Card>
      </motion.section>
    </motion.div>
  );
}

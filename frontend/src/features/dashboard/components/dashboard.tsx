import { Link } from "@/shared/ui/router-link";
import { useWorkspaceBootstrap } from "@/features/workspace/bootstrap-context";
import {
  computeCareerReadiness,
  getReadinessTier,
  resolveNextAction,
} from "@/features/dashboard/model/dashboard-logic";
import {
  extractMissing,
  resolveCompletion,
} from "@/features/profile/model/profile-completion";
import type { InterviewProgress } from "@/features/dashboard/components/interview-progress-charts";
import {
  Button,
  InlineNotice,
  ScoreRing,
  Skeleton,
  Surface,
} from "@/shared/ui/workbench";
import { CopilotIcon } from "@/components/ui/copilot-icons";

function getTimeGreeting(firstName: string) {
  const hour = new Date().getHours();
  const time =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return `${time}, *${firstName}*.`;
}

function renderEmphasizedTitle(raw: string) {
  if (!raw.includes("*")) {
    return raw;
  }
  const parts = raw.split(/(\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} aria-busy="true">
      <div>
        <Skeleton width="36%" height={36} style={{ marginBottom: 12 }} />
        <Skeleton width="24%" height={20} />
      </div>
      <div className="wb-dashboard-grid">
        <Surface style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton width="20%" height={14} />
          <Skeleton width="70%" height={32} />
          <Skeleton width="90%" height={20} />
          <Skeleton width="30%" height={40} style={{ marginTop: 16 }} />
        </Surface>
        <Surface style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Skeleton width={128} height={128} style={{ borderRadius: 9999, marginBottom: 24 }} />
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton height={24} />
            <Skeleton height={24} />
            <Skeleton height={24} />
          </div>
        </Surface>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data, error, loading, refresh } = useWorkspaceBootstrap();

  const fullName = data?.profile?.full_name || "";
  const firstName = fullName.split(" ")[0] || "there";

  const details =
    data?.workspace?.profile_completion_details ||
    data?.profile?.profile_completion_details ||
    null;
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

  const interviewProgress = data?.interview_progress as
    | InterviewProgress
    | null
    | undefined;
  const interviewLatest = interviewProgress?.latest_overall ?? null;
  const history = interviewProgress?.history || [];
  const hasInterviewScores = history.some((h) => h.overall_score != null);

  const careerReadinessScore = computeCareerReadiness({
    completion,
    hasConfirmedResume,
    atsScore,
    interviewLatest,
    sessionsCompleted: interviewProgress?.sessions_completed,
  });
  const readinessTier = getReadinessTier(careerReadinessScore);

  const interviewHref = lastInterview?.id
    ? interviewLatest != null
      ? `/mock-interview/report/${lastInterview.id}`
      : `/mock-interview/session/${lastInterview.id}`
    : "/mock-interview";

  const nextAction = resolveNextAction({
    hasConfirmedResume,
    hasInterviewScores,
    interviewLatest,
    atsScore,
    atsReportId: data?.latest_ats_analysis?.id,
    interviewHref,
  });

  const counts = data?.counts || {};
  const savedJobsCount = counts.saved_jobs ?? (lastJob ? 1 : 0);

  if (loading && !data && !error) {
    return <DashboardSkeleton />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 1. Page Header: Serif greeting, time-aware salutation, small text beside title (icon + label) */}
      <header className="wb-page-header" style={{ marginBottom: 0 }}>
        <div className="wb-page-header-main">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <h1 className="wb-page-title" style={{ margin: 0 }}>
              {renderEmphasizedTitle(getTimeGreeting(firstName))}
            </h1>
            {/* Small text beside the title: icon + label, not a boxed badge */}
            <span
              style={{
                fontSize: 13,
                color: "var(--ink-2)",
                fontWeight: 500,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <CopilotIcon name="evidence" size={14} />
              <span>{readinessTier.label}</span>
            </span>
            {completion < 100 ? (
              <Link
                href="/settings/profile"
                style={{
                  fontSize: 13,
                  color: "var(--ink-2)",
                  textDecoration: "none",
                }}
              >
                Profile {completion}% →
              </Link>
            ) : null}
          </div>
          <p className="wb-page-description">
            Resume, practice interviews, and saved jobs.
          </p>
        </div>
      </header>

      {/* Slim InlineNotice error if dashboard failed to load */}
      {error ? (
        <InlineNotice
          tone="error"
          message="We couldn't load your dashboard. Check your connection and try again."
          action={
            <Button variant="secondary" onClick={() => refresh()}>
              Try again
            </Button>
          }
          details={error}
        />
      ) : null}

      {/* Desktop 60/40 Split / Mobile Stacked Grid */}
      <div className="wb-dashboard-grid">
        {/* Left Surface (Hero - 60%): Overline, serif title, copy, primary button, view jobs link */}
        <Surface style={{ padding: 24, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <p className="wb-stat-overline" style={{ marginBottom: 8 }}>
              {nextAction.badge} · Next step
            </p>
            <h2
              className="wb-hero-statement"
              style={{
                margin: "0 0 12px 0",
              }}
            >
              {nextAction.title}
            </h2>
            <p
              style={{
                fontSize: 14,
                lineHeight: "22px",
                color: "var(--ink-2)",
                margin: "0 0 24px 0",
                maxWidth: "52ch",
              }}
            >
              {nextAction.description}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: "auto" }}>
            <Link href={nextAction.actionHref} className="wb-button wb-button-primary">
              {nextAction.actionLabel}
            </Link>
            <Link
              href="/jobs"
              className="wb-button wb-button-ghost"
              style={{ fontSize: 14 }}
            >
              View jobs
            </Link>
          </div>
        </Surface>

        {/* Right Surface (Progress - 40%): ScoreRing 128px + Hairline + 3 Rows with values and arrow links */}
        <Surface style={{ padding: 24, display: "flex", flexDirection: "column" }}>
          {/* Top: ScoreRing 128px */}
          <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px 0" }}>
            <ScoreRing
              score={careerReadinessScore}
              size={128}
              strokeWidth={6}
              label="Readiness"
            />
          </div>

          {/* Hairline divider */}
          <div
            style={{
              height: 1,
              backgroundColor: "var(--hairline)",
              margin: "12px 0 16px 0",
              width: "100%",
            }}
          />

          {/* Three progress rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Row 1: Practice interview */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                  Practice interview
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    color: "var(--ink-2)",
                    marginTop: 2,
                  }}
                >
                  {interviewLatest != null ? `${interviewLatest}/100` : "—"}
                </div>
              </div>
              <Link
                href={interviewHref}
                style={{
                  fontSize: 13,
                  color: "var(--ink-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
                aria-label="View practice interviews"
              >
                <span>→</span>
              </Link>
            </div>

            {/* Row 2: Resume match */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                  Resume match
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    color: "var(--ink-2)",
                    marginTop: 2,
                  }}
                >
                  {atsScore != null
                    ? `${atsScore}%`
                    : hasConfirmedResume
                      ? "Saved"
                      : "—"}
                </div>
              </div>
              <Link
                href="/resume-analysis"
                style={{
                  fontSize: 13,
                  color: "var(--ink-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
                aria-label="View resume analysis"
              >
                <span>→</span>
              </Link>
            </div>

            {/* Row 3: Saved jobs */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                  Saved jobs
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 12,
                    color: "var(--ink-2)",
                    marginTop: 2,
                  }}
                >
                  {savedJobsCount > 0 ? `${savedJobsCount}` : "—"}
                </div>
              </div>
              <Link
                href="/jobs/saved"
                style={{
                  fontSize: 13,
                  color: "var(--ink-2)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  textDecoration: "none",
                }}
                aria-label="View saved jobs"
              >
                <span>→</span>
              </Link>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

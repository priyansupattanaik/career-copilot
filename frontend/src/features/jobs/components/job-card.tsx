import type { Job, Recommendation, SavedJobStatus } from "../model/job-types";
import { statusLabel } from "../model/job-types";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/ui/workbench";

function salaryLabel(job: Job): string | null {
  if (job.salary_min != null && job.salary_max != null) {
    return `$${Number(job.salary_min).toLocaleString()} – $${Number(job.salary_max).toLocaleString()}`;
  }
  if (job.salary_min != null) return `From $${Number(job.salary_min).toLocaleString()}`;
  if (job.salary_max != null) return `Up to $${Number(job.salary_max).toLocaleString()}`;
  return null;
}

export function JobCard({
  job,
  recommendation,
  status,
  busy = false,
  onOpen,
  onToggleSave,
  onMarkApplied,
  onMarkRejected,
}: {
  job: Job;
  recommendation?: Recommendation;
  status?: SavedJobStatus | string | null;
  busy?: boolean;
  onOpen: () => void;
  onToggleSave: (e?: React.MouseEvent) => void;
  onMarkApplied: (e?: React.MouseEvent) => void;
  onMarkRejected: (e?: React.MouseEvent) => void;
}) {
  const score = recommendation != null ? Math.round(Number(recommendation.match_score) || 0) : null;
  const salary = salaryLabel(job);
  const matched = (recommendation?.match_breakdown?.matched_requirements || []).slice(0, 4);
  const missing = (recommendation?.match_breakdown?.missing_requirements || []).slice(0, 2);
  const normalized = (status || "").toLowerCase();
  const isSaved = normalized === "saved";
  const isApplied = normalized === "applied" || normalized === "interviewing" || normalized === "offer";
  const isRejected = normalized === "rejected" || normalized === "withdrawn";

  const companyInitial = (job.company || "C").trim().slice(0, 1).toUpperCase();
  const metaLine = [job.location, job.work_mode, salary].filter(Boolean).join(" · ");

  function onKeyActivate(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  }

  // Thin score ring calculation
  const ringSize = 36;
  const stroke = 3;
  const radius = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = score != null ? circ - (score / 100) * circ : circ;

  return (
    <article
      onClick={onOpen}
      onKeyDown={onKeyActivate}
      role="button"
      tabIndex={0}
      aria-label={`${job.title} at ${job.company || "Company"}${score != null ? `, ${score}% match` : ""}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 20px",
        borderRadius: "var(--radius-control)",
        border: "1px solid var(--hairline)",
        background: "transparent",
        cursor: "pointer",
        transition: "background-color 120ms ease, border-color 120ms ease",
        flexWrap: "wrap",
      }}
      className="job-row-workbench"
    >
      {/* Left: Monogram tile + title + meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 260 }}>
        {/* Monogram tile from company initial */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius-control)",
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-sans)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--ink)",
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {companyInitial}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              {job.title}
            </h3>
            <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 400 }}>
              {job.company}
            </span>
            {status ? (
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 9999,
                  border: "1px solid var(--hairline)",
                  color: isApplied ? "var(--ok)" : isRejected ? "var(--danger)" : "var(--ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {statusLabel(status)}
              </span>
            ) : null}
          </div>
          {metaLine ? (
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
              {metaLine}
            </span>
          ) : null}
        </div>
      </div>

      {/* Middle: Matched / missing keyword chips ONLY if the data exists */}
      {(matched.length > 0 || missing.length > 0) ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {matched.map((item) => (
            <span
              key={`m-${item}`}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 9999,
                background: "var(--surface-2)",
                color: "var(--ok)",
                border: "1px solid var(--hairline)",
              }}
            >
              ✓ {item}
            </span>
          ))}
          {missing.map((item) => (
            <span
              key={`x-${item}`}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 9999,
                background: "transparent",
                color: "var(--ink-3)",
                border: "1px solid var(--hairline)",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {/* Right: Match score ring & actions */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {score != null ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            title={`${score}% match score`}
          >
            <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="var(--hairline)"
                strokeWidth={stroke}
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                stroke="var(--accent)"
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--ink)",
              }}
            >
              {score}%
            </span>
          </div>
        ) : null}

        {/* Action buttons: Save, Applied, Reject as ghost buttons with tooltips */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wb-button wb-button-ghost"
                disabled={busy}
                onClick={(e) => onToggleSave(e)}
                aria-label={isSaved ? "Unsave job" : "Save job"}
                style={{
                  height: 36,
                  padding: "0 10px",
                  color: isSaved ? "var(--accent)" : "var(--ink-2)",
                }}
              >
                <CopilotIcon name="save" size={16} />
                <span style={{ fontSize: 13 }}>{isSaved ? "Saved" : "Save"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isSaved ? "Remove from saved" : "Bookmark for later"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wb-button wb-button-ghost"
                disabled={busy || isApplied}
                onClick={(e) => onMarkApplied(e)}
                aria-label="Mark as applied"
                style={{
                  height: 36,
                  padding: "0 10px",
                  color: isApplied ? "var(--ok)" : "var(--ink-2)",
                }}
              >
                <CopilotIcon name="apply" size={16} />
                <span style={{ fontSize: 13 }}>{isApplied ? "Applied" : "Apply"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isApplied ? "Tracked as applied" : "Mark as applied"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wb-button wb-button-ghost"
                disabled={busy || isRejected}
                onClick={(e) => onMarkRejected(e)}
                aria-label="Mark as rejected"
                style={{
                  height: 36,
                  padding: "0 10px",
                  color: isRejected ? "var(--danger)" : "var(--ink-2)",
                }}
              >
                <CopilotIcon name="reject" size={16} />
                <span style={{ fontSize: 13 }}>{isRejected ? "Rejected" : "Pass"}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isRejected ? "Marked as passed" : "Pass on this role"}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}

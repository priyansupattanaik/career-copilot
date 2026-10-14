import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Link } from "@/shared/ui/router-link";
import { isDemoSession } from "@/features/auth/demo-session";
import {
  generateJobRecommendations,
  getJob,
  listResumeRows,
  listSavedJobs,
  saveJob,
  syncExternalJobs as requestExternalJobSync,
  unsaveJob,
  updateSavedJobStatus,
  type JobAgentStatus,
} from "../api";
import { JobCard } from "./job-card";
import { JobCardSkeleton } from "./job-card-skeleton";
import { JobModal } from "./job-modal";
import type { Job, Recommendation, SavedJobRow, SavedJobStatus } from "../model/job-types";
import { isPipelineStatus } from "../model/job-types";
import { jobRecsCacheKey, readJobRecsCache, writeJobRecsCache } from "../job-recs-cache";
import {
  PageHeader,
  EmptyState,
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Sheet,
  SheetContent,
  SheetClose,
  useToast,
} from "@/shared/ui/workbench";
import { Badge, Card } from "@/shared/ui/primitives";

import { AnimatePresence } from "motion/react";

export type { Job, Recommendation } from "../model/job-types";

type PipelineFilter = "all" | "saved" | "applied" | "rejected";

function normalizeStatus(status: string | undefined | null): SavedJobStatus {
  const value = (status || "saved").toLowerCase() as SavedJobStatus;
  return value;
}

export function JobsHome({ savedOnly = false }: { savedOnly?: boolean }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  /** job_id → tracking status for pipeline (saved / applied / rejected / …) */
  const [statusByJobId, setStatusByJobId] = useState<Record<string, SavedJobStatus>>({});
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterLocation, setFilterLocation] = useState("");
  const [filterWorkMode, setFilterWorkMode] = useState("");
  const [filterSalaryMin, setFilterSalaryMin] = useState<number | "">("");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<JobAgentStatus>({ mode: "evidence", provider: null });
  const limit = 20;
  const requestSequence = useRef(0);
  const hydratedCacheKey = useRef<string | null>(null);
  const lastAutoLoadKey = useRef<string | null>(null);
  const hasJobsRef = useRef(false);

  const cacheKey = useMemo(
    () =>
      jobRecsCacheKey({
        demo: isDemoSession(),
        location: filterLocation,
        workMode: filterWorkMode,
        salaryMin: filterSalaryMin,
      }),
    [filterLocation, filterWorkMode, filterSalaryMin],
  );

  const activeFilterCount = useMemo(
    () =>
      [
        Boolean(filterLocation),
        Boolean(filterWorkMode),
        Boolean(filterSalaryMin !== "" && filterSalaryMin != null),
      ].filter(Boolean).length,
    [filterLocation, filterWorkMode, filterSalaryMin],
  );

  useEffect(() => {
    hasJobsRef.current = jobs.length > 0;
  }, [jobs.length]);

  const counts = useMemo(() => {
    const values = Object.values(statusByJobId);
    return {
      saved: values.filter((s) => s === "saved").length,
      applied: values.filter((s) => s === "applied" || s === "interviewing" || s === "offer").length,
      rejected: values.filter((s) => s === "rejected" || s === "withdrawn").length,
      total: values.filter((s) => isPipelineStatus(s)).length,
    };
  }, [statusByJobId]);

  const applySavedRows = useCallback((rows: SavedJobRow[]) => {
    const pipeline = rows.filter((row) => isPipelineStatus(row.status));
    const next: Record<string, SavedJobStatus> = {};
    for (const row of pipeline) {
      const jobId = String(row.jobs?.id || row.job_id || "");
      if (!jobId) continue;
      next[jobId] = normalizeStatus(row.status);
    }
    setStatusByJobId(next);
    return pipeline;
  }, []);

  // Instant paint from session cache (stale-while-revalidate) for recommendation feed.
  useEffect(() => {
    if (savedOnly) return;
    if (hydratedCacheKey.current === cacheKey) return;
    const cached = readJobRecsCache(cacheKey);
    if (cached && cached.jobs.length > 0) {
      hydratedCacheKey.current = cacheKey;
      setRecommendations(cached.recommendations);
      setJobs(cached.jobs);
      setStatusByJobId(cached.statusByJobId || {});
      setIsLoading(false);
      setIsRefreshing(true);
      setHasMore(cached.jobs.length >= limit);
      return;
    }
    // Different filters without cache: drop previous filter's rows so UI does not lie — producer fix.
    setRecommendations([]);
    setJobs([]);
    setOffset(0);
    setHasMore(true);
    setIsLoading(true);
    setIsRefreshing(false);
  }, [cacheKey, savedOnly]);

  const fetchJobs = useCallback(
    async (currentOffset: number, append: boolean = false) => {
      const sequence = ++requestSequence.current;
      setError("");
      if (!append) {
        if (hasJobsRef.current) setIsRefreshing(true);
        else setIsLoading(true);
      } else setIsLoadingMore(true);
      try {
        if (savedOnly) {
          const rows = await listSavedJobs();
          if (sequence !== requestSequence.current) return;
          const pipeline = applySavedRows(Array.isArray(rows) ? rows : []);
          setJobs(pipeline.map((row) => row.jobs).filter((job): job is Job => Boolean(job)));
          setRecommendations([]);
          setHasMore(false);
        } else {
          const body: Record<string, string | number> = { limit, offset: currentOffset };
          if (filterLocation) body.location = filterLocation;
          if (filterWorkMode) body.work_mode = filterWorkMode;
          if (filterSalaryMin !== "" && filterSalaryMin != null && Number(filterSalaryMin) >= 0) {
            body.salary_min = Number(filterSalaryMin);
          }

          // Resolve the current active resume before generating. The previous
          // flow relied on the backend to discover this state, which produced
          // a confusing 409 when the user had just confirmed a resume in the
          // Resume Analysis page and this page still held stale state.
          const [resumes, savedRows] = await Promise.all([
            listResumeRows(),
            listSavedJobs(),
          ]);
          const activeResume = (Array.isArray(resumes) ? resumes : []).find((row) => row.is_active);
          const confirmedVersion = activeResume?.latest_version;
          if (!confirmedVersion?.id || confirmedVersion.extraction_status !== "confirmed") {
            throw new Error("Confirm your active resume in Resume Analysis before generating recommendations.");
          }
          body.resume_version_id = confirmedVersion.id;

          const result = await generateJobRecommendations(body);
          const newRecs = result.recommendations || [];
          setAgentStatus(result.agent || { mode: "evidence", provider: null });
          const newJobs = newRecs.map((row) => row.job);
          if (sequence !== requestSequence.current) return;
          const pipeline = applySavedRows(Array.isArray(savedRows) ? savedRows : []);
          const nextStatus: Record<string, SavedJobStatus> = {};
          for (const row of pipeline) {
            const jobId = String(row.jobs?.id || row.job_id || "");
            if (!jobId) continue;
            nextStatus[jobId] = normalizeStatus(row.status);
          }
          if (append) {
            setRecommendations((prev) => [...prev, ...newRecs]);
            setJobs((prev) => [...prev, ...newJobs]);
          } else {
            setRecommendations(newRecs);
            setJobs(newJobs);
            writeJobRecsCache(cacheKey, {
              recommendations: newRecs,
              jobs: newJobs,
              statusByJobId: nextStatus,
            });
            hydratedCacheKey.current = cacheKey;
          }
          setHasMore(newRecs.length === limit);
        }
      } catch (e) {
        if (sequence === requestSequence.current) setError((e as Error).message);
      } finally {
        if (sequence === requestSequence.current) {
          setIsLoading(false);
          setIsRefreshing(false);
          setIsLoadingMore(false);
        }
      }
    },
    [savedOnly, filterLocation, filterWorkMode, filterSalaryMin, applySavedRows, cacheKey],
  );

  const load = useCallback(() => {
    setOffset(0);
    void fetchJobs(0, false);
  }, [fetchJobs]);

  useEffect(() => {
    // React Strict Mode replays effects in development. Guard the automatic
    // recommendation load so it cannot issue duplicate POST requests, which
    // otherwise race the backend generation guard and surface two 409 errors.
    const autoLoadKey = `${savedOnly}:${cacheKey}`;
    if (lastAutoLoadKey.current === autoLoadKey) return;
    lastAutoLoadKey.current = autoLoadKey;
    queueMicrotask(load);
  }, [savedOnly, cacheKey, load]);

  async function syncExternalJobs() {
    setError("");
    try {
      await requestExternalJobSync();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }


  async function toggleSave(jobId: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const current = statusByJobId[jobId];
    // Unsave only when status is plain "saved". Applied/rejected stay tracked via status buttons.
    const shouldUnsave = current === "saved";
    // Producer fix: capture per-job previous, not whole map shallow, to avoid concurrent rollback corruption.
    const previousStatus = statusByJobId[jobId];
    const previousJobs = savedOnly ? [...jobs] : null;

    if (shouldUnsave) {
      setStatusByJobId((map) => {
        const next = { ...map };
        delete next[jobId];
        return next;
      });
      if (savedOnly) {
        setJobs((list) => list.filter((j) => j.id !== jobId));
      }
    } else {
      setStatusByJobId((map) => ({
        ...map,
        [jobId]: current && current !== "dismissed" ? current : "saved",
      }));
    }

    try {
      if (shouldUnsave) {
        await unsaveJob(jobId);
      } else {
        const result = await saveJob(jobId);
        const serverStatus = normalizeStatus(result?.status || "saved");
        setStatusByJobId((map) => ({ ...map, [jobId]: serverStatus }));
      }
    } catch (err) {
      setError((err as Error).message);
      // Rollback only this job's key — enriched with truncated jobId for telemetry.
      setStatusByJobId((map) => {
        const next = { ...map };
        if (previousStatus === undefined) delete next[jobId];
        else next[jobId] = previousStatus;
        return next;
      });
      if (savedOnly && previousJobs) setJobs(previousJobs);
      if (savedOnly) load();
    }
  }

  async function setJobStatus(jobId: string, status: SavedJobStatus, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    const previous = { ...statusByJobId };
    setStatusBusyId(jobId);
    setError("");
    setStatusByJobId((map) => ({ ...map, [jobId]: status }));

    // On recommendations feed, dismissed jobs leave the list.
    if (status === "dismissed" && !savedOnly) {
      setJobs((current) => current.filter((j) => j.id !== jobId));
      setRecommendations((current) => current.filter((r) => r.job.id !== jobId));
      if (selectedJob === jobId) setSelectedJob(null);
      setStatusByJobId((map) => {
        const next = { ...map };
        delete next[jobId];
        return next;
      });
    }

    // On pipeline page, dismissed rows leave the list.
    if (savedOnly && status === "dismissed") {
      setJobs((list) => list.filter((j) => j.id !== jobId));
      setStatusByJobId((map) => {
        const next = { ...map };
        delete next[jobId];
        return next;
      });
    }

    try {
      await updateSavedJobStatus(jobId, status);
    } catch (err) {
      setError((err as Error).message);
      setStatusByJobId(previous);
      if (savedOnly || status === "dismissed") load();
    } finally {
      setStatusBusyId(null);
    }
  }

  async function dismissJob(jobId: string, e?: React.MouseEvent) {
    await setJobStatus(jobId, "dismissed", e);
  }

  const visibleJobs = useMemo(() => {
    if (!savedOnly) return jobs;
    return jobs.filter((job) => {
      const status = statusByJobId[job.id] || "saved";
      if (pipelineFilter === "all") return isPipelineStatus(status);
      if (pipelineFilter === "applied") {
        return status === "applied" || status === "interviewing" || status === "offer";
      }
      if (pipelineFilter === "rejected") {
        return status === "rejected" || status === "withdrawn";
      }
      return status === "saved";
    });
  }, [jobs, savedOnly, pipelineFilter, statusByJobId]);

  const selected = visibleJobs.find((job) => job.id === selectedJob) || jobs.find((j) => j.id === selectedJob) || null;
  const selectedRec = recommendations.find((row) => row.job.id === selectedJob);
  const selectedStatus = selected ? statusByJobId[selected.id] : undefined;

  return (
    <div className="feature-page jobs-radar-page">
      <PageHeader
        title={savedOnly ? "Saved jobs" : "Job *matches*"}
        description={
          savedOnly
            ? "Jobs you saved, applied to, or rejected. Counts update when you change a status."
            : "Roles scored from your saved resume and preferences. The list does not invent jobs or skills."
        }
        actions={
          savedOnly ? (
            <Link className="wb-button wb-button-ghost" href="/jobs">
              Back to recommendations
            </Link>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button
                variant="primary"
                onClick={() => void syncExternalJobs()}
                data-testid="freehire-sync"
              >
                <CopilotIcon name="refresh" size={16} />
                <span>Refresh job search</span>
              </Button>
              <Link className="wb-button wb-button-ghost" href="/jobs/saved">
                View saved ({counts.total})
              </Link>
            </div>
          )
        }
      />

      {/* "How matches are chosen": collapse into a small disclosure row under header */}
      {!savedOnly ? (
        <Collapsible
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-control)",
            padding: "10px 16px",
            background: "var(--surface-1)",
          }}
        >
          <CollapsibleTrigger
            type="button"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-2)",
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: 0,
            }}
          >
            <span>
              How matches are chosen ·{" "}
              <span style={{ color: "var(--ink-3)" }}>
                Scoring:{" "}
                {agentStatus.mode === "agent"
                  ? "Using a language model"
                  : agentStatus.mode === "evidence_fallback"
                    ? "Matched from your resume"
                    : "Matched from your profile"}
              </span>
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>▾</span>
          </CollapsibleTrigger>
          <CollapsibleContent
            style={{
              marginTop: 8,
              fontSize: 13,
              lineHeight: "20px",
              color: "var(--ink-2)",
            }}
          >
            Jobs come from the search source configured for your account. Each one is scored against your resume.{" "}
            {agentStatus.mode === "agent"
              ? agentStatus.provider || "Language model"
              : "Missing details are not filled in."}
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {/* Saved / Applied / Rejected: replace three cards with tabs that carry counts */}
      <div role="tablist" className="wb-tabs" aria-label="Job pipeline filter" style={{ marginBottom: 0 }}>
        {!savedOnly ? (
          <button
            type="button"
            role="tab"
            aria-selected={true}
            className="wb-tab-item is-active"
            title="Personalized matches scored against your confirmed resume"
          >
            Matches ({jobs.length})
          </button>
        ) : (
          <Link
            className="wb-tab-item"
            href="/jobs"
            title="Personalized matches scored against your confirmed resume"
          >
            Matches
          </Link>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={savedOnly && pipelineFilter === "saved"}
          className={`wb-tab-item ${savedOnly && pipelineFilter === "saved" ? "is-active" : ""}`}
          onClick={() => {
            if (!savedOnly) navigate("/jobs/saved");
            else setPipelineFilter("saved");
          }}
          title="Bookmarked for later"
        >
          Saved ({counts.saved})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={savedOnly && pipelineFilter === "applied"}
          className={`wb-tab-item ${savedOnly && pipelineFilter === "applied" ? "is-active" : ""}`}
          onClick={() => {
            if (!savedOnly) navigate("/jobs/saved");
            else setPipelineFilter("applied");
          }}
          title="Applications you tracked"
        >
          Applied ({counts.applied})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={savedOnly && pipelineFilter === "rejected"}
          className={`wb-tab-item ${savedOnly && pipelineFilter === "rejected" ? "is-active" : ""}`}
          onClick={() => {
            if (!savedOnly) navigate("/jobs/saved");
            else setPipelineFilter("rejected");
          }}
          title="Roles you passed on"
        >
          Rejected ({counts.rejected})
        </button>
      </div>

      {isRefreshing ? (
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }} aria-live="polite">
          Updating recommendations…
        </p>
      ) : null}

      {/* Filters: responsive single row on >=1024px, bottom sheet on <1024px */}
      {!savedOnly ? (
        <>
          <div
            role="search"
            aria-label="Filter job recommendations"
            className="wb-job-filters-desktop"
          >
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                Location
              </label>
              <input
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                placeholder="City or region"
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--hairline)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                Work mode
              </label>
              <input
                value={filterWorkMode}
                onChange={(e) => setFilterWorkMode(e.target.value)}
                placeholder="remote, hybrid…"
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--hairline)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 14,
                }}
              />
            </div>

            <div style={{ width: 140 }}>
              <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                Min salary ($)
              </label>
              <input
                type="number"
                value={filterSalaryMin}
                onChange={(e) =>
                  setFilterSalaryMin(e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="50000"
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--hairline)",
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 14,
                }}
              />
            </div>

            {activeFilterCount > 0 ? (
              <button
                type="button"
                className="wb-button wb-button-ghost"
                onClick={() => {
                  setFilterLocation("");
                  setFilterWorkMode("");
                  setFilterSalaryMin("");
                }}
                style={{ height: 40, fontSize: 13 }}
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <div className="wb-job-filters-mobile-bar">
            <Button
              variant="secondary"
              onClick={() => setMobileFiltersOpen(true)}
              style={{ height: 40 }}
            >
              <CopilotIcon name="settings" size={16} />
              <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
            </Button>
            {activeFilterCount > 0 ? (
              <button
                type="button"
                className="wb-button wb-button-ghost"
                onClick={() => {
                  setFilterLocation("");
                  setFilterWorkMode("");
                  setFilterSalaryMin("");
                }}
                style={{ fontSize: 13, height: 40 }}
              >
                Reset filters
              </button>
            ) : null}
          </div>

          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetContent title="Filter recommendations">
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                    Location
                  </label>
                  <input
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    placeholder="City or region"
                    style={{
                      width: "100%",
                      height: 44,
                      padding: "0 12px",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                    Work mode
                  </label>
                  <input
                    value={filterWorkMode}
                    onChange={(e) => setFilterWorkMode(e.target.value)}
                    placeholder="remote, hybrid…"
                    style={{
                      width: "100%",
                      height: 44,
                      padding: "0 12px",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, color: "var(--ink-3)", marginBottom: 6 }}>
                    Min salary ($)
                  </label>
                  <input
                    type="number"
                    value={filterSalaryMin}
                    onChange={(e) =>
                      setFilterSalaryMin(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="50000"
                    style={{
                      width: "100%",
                      height: 44,
                      padding: "0 12px",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid var(--hairline)",
                      background: "var(--surface-2)",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <SheetClose asChild>
                    <Button variant="primary" style={{ flex: 1 }}>
                      Apply
                    </Button>
                  </SheetClose>
                  {activeFilterCount > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setFilterLocation("");
                        setFilterWorkMode("");
                        setFilterSalaryMin("");
                      }}
                    >
                      Reset
                    </Button>
                  ) : null}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      {error ? (
        <div className="feature-alert" role="alert">
          <p className="field-error">{error}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="jobs-grid" aria-busy="true" aria-label="Loading jobs">
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
          <JobCardSkeleton />
        </div>
      ) : visibleJobs.length === 0 ? (
        <EmptyState
          headline={savedOnly ? "No jobs in this view" : "No jobs yet"}
          description={
            savedOnly
              ? pipelineFilter === "applied"
                ? "Mark a saved job as applied to list it here."
                : pipelineFilter === "rejected"
                  ? "Mark a saved job as rejected to list it here."
                  : "Save a job or mark it applied to list it here."
              : "Save a resume, then open job matches."
          }
        />
      ) : (
        <div className="stack">
          <div className="jobs-grid" role="list" aria-label={savedOnly ? "Saved jobs" : "Job matches"}>
            {visibleJobs.map((job) => {
              const rec = recommendations.find((row) => row.job.id === job.id);
              const status = statusByJobId[job.id];
              const busy = statusBusyId === job.id;
              return (
                <div key={job.id} role="listitem">
                  <JobCard
                    job={job}
                    recommendation={rec}
                    status={status}
                    busy={busy}
                    onOpen={() => setSelectedJob(job.id)}
                    onToggleSave={(e) => void toggleSave(job.id, e)}
                    onMarkApplied={(e) => void setJobStatus(job.id, "applied", e)}
                    onMarkRejected={(e) => {
                      const prevStatus = status;
                      void setJobStatus(job.id, "rejected", e);
                      showToast({
                        message: `Marked "${job.title}" as rejected`,
                        undoLabel: "Undo",
                        duration: 5000,
                        onUndo: () => {
                          void setJobStatus(job.id, prevStatus || "saved");
                        },
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
          {!savedOnly && hasMore ? (
            <div className="jobs-load-more">
              <Button
                variant="secondary"
                disabled={isLoadingMore}
                onClick={() => {
                  const next = offset + limit;
                  setOffset(next);
                  void fetchJobs(next, true);
                }}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <AnimatePresence>
        {selected ? (
          <JobModal
            job={selected}
            recommendation={selectedRec}
            status={selectedStatus}
            onToggleSave={() => void toggleSave(selected.id)}
            onMarkApplied={() => void setJobStatus(selected.id, "applied")}
            onMarkRejected={() => {
              const prev = selectedStatus;
              void setJobStatus(selected.id, "rejected");
              showToast({
                message: `Marked "${selected.title}" as rejected`,
                undoLabel: "Undo",
                duration: 5000,
                onUndo: () => {
                  void setJobStatus(selected.id, prev || "saved");
                },
              });
            }}
            onClose={() => setSelectedJob(null)}
            onDismiss={() => void dismissJob(selected.id)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void getJob(jobId)
      .then(setJob)
      .catch((e: Error) => setError(e.message));
  }, [jobId]);
  return (
    <>
      <PageHeader
        title={job?.title || "Job details"}
        description={
          job ? `${job.company}${job.location ? `  ·  ${job.location}` : ""}` : "Loading job details"
        }
      />
      {error ? (
        <Card>
          <p role="alert" className="field-error">
            {error}
          </p>
        </Card>
      ) : job ? (
        <Card className="stack">
          <div className="cluster">
            <Badge variant="secondary">
              <CopilotIcon name="pin" size={14} /> {job.location || "Location not specified"}
            </Badge>
            <Badge variant="secondary">
              <CopilotIcon name="check" size={14} /> Stored job record
            </Badge>
            {job.work_mode ? <Badge variant="secondary">{job.work_mode}</Badge> : null}
            {job.salary_min != null || job.salary_max != null ? (
              <Badge variant="secondary">
                {job.salary_min != null && job.salary_max != null
                  ? `$${Number(job.salary_min).toLocaleString()} – $${Number(job.salary_max).toLocaleString()}`
                  : job.salary_min != null
                    ? `From $${Number(job.salary_min).toLocaleString()}`
                    : `Up to $${Number(job.salary_max).toLocaleString()}`}
              </Badge>
            ) : null}
          </div>
          <p>{job.description || "No description supplied."}</p>
          {job.requirements?.length ? (
            <div>
              <h2>Requirements</h2>
              <ul>
                {job.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}
              </ul>
            </div>
          ) : null}
          <div className="cluster">
            <Link className="button button-secondary" href="/jobs">Back to jobs</Link>
            {job.application_url ? (
              <a className="button button-primary" href={job.application_url} target="_blank" rel="noreferrer">
                Apply on employer site <CopilotIcon name="external" size={14} />
              </a>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="skeleton">
          <span />
          <span />
        </Card>
      )}
    </>
  );
}

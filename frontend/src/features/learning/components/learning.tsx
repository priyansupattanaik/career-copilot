import { Link } from "@/shared/ui/router-link";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { apiRequest, isAbortError } from "@/shared/api/client";
import { deleteLearningPath, generateLearningPath, getLearningPath, listLearningPaths } from "../api";
import LoadingState from "@/components/ui/loading-state";
import {
  PageHeader,
  Surface,
  EmptyState,
  Skeleton,
  Button,
} from "@/shared/ui/workbench";
import { Badge, Progress } from "@/shared/ui/primitives";

import { motion, useReducedMotion } from "motion/react";
import { FLUID_SPRING_TRANSITION } from "@/components/ui/motion-system";
import type {
  AtsAnalysis,
  LearningItem,
  Path,
  Resource,
  ResourceProgressResponse,
} from "@/features/learning/learning-types";
import {
  applyHeartbeat,
  extractYoutubeVideoId,
  formatClock,
  isArticleResource,
  isExactVideo,
  isVideoResource,
  itemWatchPercent,
  resourceWatchPercent,
} from "@/features/learning/watch-progress";
import { YoutubeLessonPlayer, type LessonHeartbeat } from "@/features/learning/youtube-player";
import "@/features/learning/learning.css";

function pathStepCount(path: Path): number {
  if (typeof path.item_count === "number" && Number.isFinite(path.item_count)) {
    return path.item_count;
  }
  return (path.items || []).length;
}

function resourceBadgeLabel(resource: Resource) {
  if (isExactVideo(resource)) return "Video lesson";
  if (isVideoResource(resource)) return "Video search";
  if ((resource.resource_type || "").toLowerCase() === "docs_search") return "Docs";
  if (isArticleResource(resource)) return "Article / blog";
  return "Resource";
}

function resourceActionLabel(resource: Resource) {
  if (isExactVideo(resource)) return "Watch in path";
  if (isVideoResource(resource)) return "Browse video lessons";
  if ((resource.resource_type || "").toLowerCase() === "docs_search") return "Browse documentation";
  if (isArticleResource(resource)) return "Browse articles";
  return "Open resource";
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function gapCount(analysis: AtsAnalysis): number {
  const missing = analysis.summary?.missing_terms?.length ?? analysis.score_breakdown?.missing_terms?.length ?? analysis.summary?.missing ?? 0;
  const partial = analysis.score_breakdown?.partial_terms?.length ?? 0;
  return Number(missing) + Number(partial);
}

function analysisLabel(analysis: AtsAnalysis): string {
  const role =
    analysis.job_description?.role_title ||
    analysis.job_description?.title ||
    "Job description";
  const company = analysis.job_description?.company;
  return company ? `${role} · ${company}` : role;
}

function pathForAnalysis(paths: Path[], analysisId: string): Path | undefined {
  return paths.find(
    (path) => path.source_type === "ats_analysis" && String(path.source_id || "") === String(analysisId),
  );
}

function pickResumePoint(path: Path): { itemId: string; resourceId: string } {
  const items = path.items || [];
  const lastItem = String(path.watch_summary?.last_item_id || "");
  const lastResource = String(path.watch_summary?.last_resource_id || "");
  if (lastItem && items.some((item) => item.id === lastItem)) {
    return { itemId: lastItem, resourceId: lastResource };
  }
  const incomplete = items.find((item) => itemWatchPercent(item) < 90) || items[0];
  if (!incomplete) return { itemId: "", resourceId: "" };
  const resources = incomplete.learning_resources || [];
  const resource =
    resources.find((row) => isExactVideo(row) && resourceWatchPercent(row) < 90) ||
    resources.find(isExactVideo) ||
    resources[0];
  return { itemId: incomplete.id, resourceId: resource?.id || "" };
}

function applyResourceToPath(
  path: Path,
  resourceId: string,
  patch: Partial<Resource>,
  extras?: { progress_percentage?: number; item_status?: LearningItem["status"]; item_watch_percent?: number; watch_summary?: Path["watch_summary"] },
): Path {
  const items = (path.items || []).map((item) => {
    const owns = (item.learning_resources || []).some((resource) => resource.id === resourceId);
    const resources = (item.learning_resources || []).map((resource) =>
      resource.id === resourceId ? { ...resource, ...patch } : resource,
    );
    const nextItem = { ...item, learning_resources: resources };
    const watch =
      owns && extras?.item_watch_percent != null ? extras.item_watch_percent : itemWatchPercent(nextItem);
    return {
      ...nextItem,
      watch_percent: watch,
      status:
        owns && extras?.item_status
          ? extras.item_status
          : watch >= 90
            ? "completed"
            : watch > 0
              ? "in_progress"
              : item.status,
    };
  });
  const progress =
    extras?.progress_percentage ??
    (items.length ? Math.round(items.reduce((sum, item) => sum + itemWatchPercent(item), 0) / items.length) : 0);
  return {
    ...path,
    items,
    progress_percentage: progress,
    watch_summary: extras?.watch_summary || path.watch_summary,
    status: progress === 100 && items.length ? "completed" : "active",
  };
}

export function LearningHome() {
  const navigate = useNavigate();
  const [paths, setPaths] = useState<Path[]>([]);
  const [analyses, setAnalyses] = useState<AtsAnalysis[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listLearningPaths<Path>(),
      apiRequest<AtsAnalysis[]>("/ats-analyses"),
    ])
      .then(([pathRows, analysisRows]) => {
        if (!active) return;
        const nextPaths = Array.isArray(pathRows) ? pathRows : [];
        const nextAnalyses = (Array.isArray(analysisRows) ? analysisRows : []).filter(
          (row) => (row.status || "").toLowerCase() === "completed",
        );
        setError("");
        setPaths(nextPaths);
        setAnalyses(nextAnalyses);
        setSelectedId((current) => {
          if (current && nextAnalyses.some((row) => row.id === current)) return current;
          return nextAnalyses[0]?.id || "";
        });
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message || "Could not load learning paths.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selected = analyses.find((row) => row.id === selectedId) || null;
  const existingForSelected = selected ? pathForAnalysis(paths, selected.id) : undefined;

  async function generate() {
    if (!selectedId) {
      setError("Choose a finished resume check first. Lessons use only the missing words from that check.");
      return;
    }
    if (existingForSelected) {
      navigate(`/learning/${existingForSelected.id}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await generateLearningPath<Path>(selectedId);
      setPaths((current) => [created, ...current.filter((row) => row.id !== created.id)]);
      navigate(`/learning/${created.id}`);
    } catch (reason) {
      setError((reason as Error).message || "Could not build a study plan from that resume check.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePath(path: Path) {
    setDeletingId(path.id);
    setError("");
    try {
      await deleteLearningPath(path.id);
      setPaths((current) => current.filter((row) => row.id !== path.id));
      setConfirmDeleteId(null);
    } catch (reason) {
      setError((reason as Error).message || "The learning path could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <PageHeader
        title="Study *plan*"
        description="Lessons come from words missing in a finished resume check. Watch time is saved. Skipped time is not counted."
        actions={
          <Button
            variant="primary"
            onClick={() => void generate()}
            disabled={busy || !selectedId || Boolean(deletingId)}
          >
            {busy ? "Building…" : existingForSelected ? "Open this plan" : "Build from missing words"}
          </Button>
        }
      />

      {error ? (
        <div className="wb-notice wb-notice-error" role="alert">
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : null}

      {busy ? <LoadingState label="Building your learning path" variant="Drive" /> : null}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton height={80} />
          <Skeleton height={80} />
        </div>
      ) : (
        <>
          {/* Section 1: Choose a finished resume check */}
          <section aria-labelledby="lp-ats-heading">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                id="lp-ats-heading"
                style={{
                  fontSize: 16,
                  lineHeight: "24px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Choose a finished resume check
              </h2>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {analyses.length} completed runs
              </span>
            </div>

            {analyses.length === 0 ? (
              <EmptyState
                headline="No resume check yet"
                description="Compare a resume with a job first. Lessons use only the missing words from that check. Skills are not added for you."
                cta={
                  <Link className="wb-button wb-button-primary" href="/resume-analysis?tab=upload">
                    Open Resume Analysis
                  </Link>
                }
              />
            ) : (
              <Surface style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {analyses.map((analysis, index) => {
                    const linked = pathForAnalysis(paths, analysis.id);
                    const selectedRun = analysis.id === selectedId;
                    return (
                      <button
                        type="button"
                        key={analysis.id}
                        onClick={() => setSelectedId(analysis.id)}
                        aria-pressed={selectedRun}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px 20px",
                          background: selectedRun ? "var(--accent-soft)" : "transparent",
                          border: "none",
                          borderBottom: index < analyses.length - 1 ? "1px solid var(--line)" : "none",
                          borderLeft: selectedRun ? "3px solid var(--accent)" : "3px solid transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background-color 120ms ease",
                          width: "100%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontVariantNumeric: "tabular-nums",
                              fontSize: 18,
                              fontWeight: 600,
                              color: "var(--ink)",
                              minWidth: 48,
                            }}
                          >
                            {analysis.overall_score == null ? "—" : `${Math.round(Number(analysis.overall_score))}%`}
                          </span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                              {analysisLabel(analysis)}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>
                              {(analysis.resume?.title || "Resume") + " · " + gapCount(analysis) + " missing words · " + formatDate(analysis.completed_at || analysis.created_at)}
                            </div>
                          </div>
                        </div>

                        <div>
                          {linked ? (
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--ok)",
                                padding: "2px 8px",
                                borderRadius: 9999,
                                border: "1px solid var(--ok)",
                              }}
                            >
                              Path {linked.progress_percentage}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                              No path yet
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Surface>
            )}
          </section>

          {/* Section 2: Your paths */}
          <section aria-labelledby="lp-paths-heading">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <h2
                id="lp-paths-heading"
                style={{
                  fontSize: 16,
                  lineHeight: "24px",
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Your paths
              </h2>
              <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                {paths.length} saved
              </span>
            </div>

            {paths.length === 0 ? (
              <EmptyState
                headline="No learning path yet"
                description="Select a finished resume check above, then build a plan. Each step uses a missing word and a free lesson."
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {paths.map((path) => {
                  const steps = pathStepCount(path);
                  const watched = path.watch_summary?.watched_percent ?? path.progress_percentage;
                  return (
                    <Surface key={path.id} style={{ padding: 20 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 260 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                              {path.title}
                            </h3>
                            <span
                              style={{
                                fontSize: 12,
                                fontFamily: "var(--font-mono)",
                                color: watched === 100 ? "var(--ok)" : "var(--ink-2)",
                              }}
                            >
                              {watched}% complete
                            </span>
                          </div>
                          <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 10px 0" }}>
                            {path.source_snapshot?.role_title
                              ? `From resume check · ${path.source_snapshot.role_title}`
                              : path.description || "Built from missing words in a saved resume check."}
                          </p>
                          <div style={{ fontSize: 13, color: "var(--ink-3)", display: "flex", gap: 16 }}>
                            <span>{steps} steps</span>
                            {path.watch_summary?.last_resource_title ? (
                              <span>Last lesson: {path.watch_summary.last_resource_title}</span>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {confirmDeleteId === path.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <Button
                                variant="destructive"
                                disabled={deletingId === path.id}
                                onClick={() => void deletePath(path)}
                              >
                                {deletingId === path.id ? "Deleting…" : "Confirm delete"}
                              </Button>
                              <Button variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Link
                                className="wb-button wb-button-secondary"
                                href={`/learning/${path.id}`}
                              >
                                {watched > 0 ? "Continue watching" : "Open path"}
                              </Link>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(path.id)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--danger)",
                                  fontSize: 13,
                                  cursor: "pointer",
                                  padding: "6px 8px",
                                }}
                                aria-label={`Delete learning path ${path.title}`}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </Surface>
                  );
                })}
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "8px 0 0 0" }}>
                  Watch time is saved. Skipped time is not counted.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function LearningPath({ pathId }: { pathId: string }) {
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [path, setPath] = useState<Path | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const persistTimer = useRef<number | null>(null);
  const pendingRef = useRef<{
    resourceId: string;
    position_seconds: number;
    duration_seconds: number | null;
    watched_ranges: number[][];
  } | null>(null);
  const pathRef = useRef<Path | null>(null);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const load = useCallback(() => {
    if (!pathId) {
      setPath(null);
      setError("Learning path not found.");
      return;
    }
    setError("");
    getLearningPath<Path>(pathId)
      .then((data) => {
        setError("");
        setPath(data);
      })
      .catch((e: Error) => {
        if (isAbortError(e)) return;
        setPath(null);
        setError(e.message || "The learning path could not be loaded.");
      });
  }, [pathId]);

  useEffect(load, [load]);

  const items = useMemo(() => path?.items || [], [path]);
  const resumePoint = useMemo(() => (path ? pickResumePoint(path) : { itemId: "", resourceId: "" }), [path]);
  const selectedItemId = searchParams.get("item") || resumePoint.itemId;
  const selectedResourceId = searchParams.get("resource") || resumePoint.resourceId;

  const selectedItem = useMemo(() => {
    if (!items.length) return null;
    return items.find((item) => item.id === selectedItemId) || items[0];
  }, [items, selectedItemId]);

  const selectedResource = useMemo(() => {
    const resources = selectedItem?.learning_resources || [];
    if (!resources.length) return null;
    return resources.find((row) => row.id === selectedResourceId) || resources.find(isExactVideo) || resources[0];
  }, [selectedItem, selectedResourceId]);

  useEffect(() => {
    if (!path) return;
    const nextItem = selectedItem?.id;
    const nextResource = selectedResource?.id;
    if (!nextItem) return;
    if (nextItem === selectedItemId && nextResource === selectedResourceId) return;
    const next = new URLSearchParams(searchParams);
    next.set("item", nextItem);
    if (nextResource) next.set("resource", nextResource);
    setSearchParams(next, { replace: true });
  }, [path, selectedItem, selectedResource, selectedItemId, selectedResourceId, searchParams, setSearchParams]);

  const flushWatch = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    const hasProgress =
      pending.watched_ranges.length > 0 ||
      pending.position_seconds > 0 ||
      Boolean(pending.duration_seconds);
    if (!hasProgress) return;
    if (persistTimer.current != null) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    const ranges = pending.watched_ranges;
    if (pendingRef.current?.resourceId === pending.resourceId) {
      pendingRef.current = { ...pendingRef.current, watched_ranges: [] };
    }
    try {
      const result = await apiRequest<ResourceProgressResponse>(
        `/learning-paths/${pathId}/resources/${pending.resourceId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            position_seconds: pending.position_seconds,
            duration_seconds: pending.duration_seconds,
            watched_ranges: ranges,
          }),
        },
      );
      setPath((current) =>
        current
          ? applyResourceToPath(current, pending.resourceId, result, {
              progress_percentage: result.progress_percentage,
              item_status: result.item_status,
              item_watch_percent: result.item_watch_percent,
              watch_summary: result.watch_summary,
            })
          : current,
      );
    } catch (reason) {
      const latest = pendingRef.current;
      if (!latest || latest.resourceId === pending.resourceId) {
        pendingRef.current = {
          resourceId: pending.resourceId,
          position_seconds: latest?.position_seconds ?? pending.position_seconds,
          duration_seconds: latest?.duration_seconds ?? pending.duration_seconds,
          watched_ranges: [...ranges, ...(latest?.watched_ranges || [])],
        };
      }
      setError((reason as Error).message || "Watch progress could not be saved.");
    }
  }, [pathId]);

  const flushWatchRef = useRef(flushWatch);
  useEffect(() => {
    flushWatchRef.current = flushWatch;
  }, [flushWatch]);

  useEffect(() => {
    return () => {
      void flushWatchRef.current();
    };
  }, [pathId, selectedResource?.id]);

  function handleHeartbeat(resourceId: string, payload: LessonHeartbeat) {
    const live = (pathRef.current?.items || [])
      .flatMap((item) => item.learning_resources || [])
      .find((row) => row.id === resourceId);
    if (!live) return;
    const next = applyHeartbeat(
      live.watched_ranges,
      payload.range,
      payload.currentTime,
      payload.duration || live.duration_seconds || null,
    );
    setPath((current) =>
      current
        ? applyResourceToPath(current, resourceId, {
            ...next,
            last_watched_at: new Date().toISOString(),
          })
        : current,
    );
    const previous = pendingRef.current?.resourceId === resourceId ? pendingRef.current : null;
    pendingRef.current = {
      resourceId,
      position_seconds: next.position_seconds,
      duration_seconds: next.duration_seconds,
      watched_ranges: [...(previous?.watched_ranges || []), ...(payload.range ? [payload.range] : [])],
    };
    if (persistTimer.current != null) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      void flushWatch();
    }, 2500);
    if (payload.ended) void flushWatch();
  }

  async function patchResource(resource: Resource, body: Record<string, unknown>) {
    setUpdatingId(resource.id);
    setError("");
    try {
      const result = await apiRequest<ResourceProgressResponse>(
        `/learning-paths/${pathId}/resources/${resource.id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      setPath((current) =>
        current
          ? applyResourceToPath(current, resource.id, result, {
              progress_percentage: result.progress_percentage,
              item_status: result.item_status,
              item_watch_percent: result.item_watch_percent,
              watch_summary: result.watch_summary,
            })
          : current,
      );
    } catch (reason) {
      setError((reason as Error).message || "Progress could not be updated.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function update(item: LearningItem, status: LearningItem["status"]) {
    setUpdatingId(item.id);
    setError("");
    try {
      const result = await apiRequest<{ progress_percentage?: number; status?: string }>(
        `/learning-paths/${pathId}/items/${item.id}`,
        { method: "PATCH", body: JSON.stringify({ status }) },
      );
      const nextStatus = (result.status as LearningItem["status"]) || status;
      const nextProgress =
        typeof result.progress_percentage === "number" ? result.progress_percentage : undefined;
      setPath((current) => {
        if (!current) return current;
        const nextItems = (current.items || []).map((row) =>
          row.id === item.id
            ? {
                ...row,
                status: nextStatus,
                learning_resources: (row.learning_resources || []).map((resource) =>
                  nextStatus === "completed"
                    ? { ...resource, watch_status: "completed" as const, watch_percent: 100 }
                    : resource,
                ),
              }
            : row,
        );
        const computed =
          nextProgress ??
          (nextItems.length
            ? Math.round(nextItems.reduce((sum, row) => sum + itemWatchPercent(row), 0) / nextItems.length)
            : 0);
        return {
          ...current,
          items: nextItems,
          progress_percentage: computed,
          item_count: nextItems.length,
          status: computed === 100 && nextItems.length ? "completed" : "active",
        };
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function deletePath() {
    setDeleting(true);
    setError("");
    try {
      await deleteLearningPath(pathId);
      navigate("/learning");
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
    }
  }

  function selectLesson(item: LearningItem, resource?: Resource) {
    const next = new URLSearchParams(searchParams);
    next.set("item", item.id);
    if (resource?.id) next.set("resource", resource.id);
    setSearchParams(next, { replace: true });
    setPlayerError("");
  }

  const videoId = selectedResource
    ? extractYoutubeVideoId(selectedResource.url, selectedResource.metadata?.video_id)
    : null;
  const completed = items.filter((item) => itemWatchPercent(item) >= 90 || item.status === "completed").length;
  const overall = path?.progress_percentage ?? 0;
  const watchPercent = selectedResource ? resourceWatchPercent(selectedResource) : 0;

  return (
    <div className="lp-page">
      <header className="lp-masthead">
        <div>
          <h1 className="lp-title">{path?.title || "Path details"}</h1>
          <p className="lp-sub">
            {path?.description ||
              "Each step is a missing word with a free lesson. Open it, then mark it complete."}
          </p>
        </div>
        <div className="lp-masthead-actions">
          <Link className="button button-secondary" href="/learning">
            All paths
          </Link>
          {path ? (
            <Button
              variant="destructive"
              disabled={deleting || Boolean(updatingId)}
              onClick={() => setConfirmDelete(true)}
            >
              <CopilotIcon name="trash" size={17} />
              {deleting ? "Deleting…" : "Delete path"}
            </Button>
          ) : null}
        </div>
      </header>

      {error && (
        <div className="lp-alert" role="alert">
          <p>{error}</p>
          <div className="lp-chip-row" style={{ marginTop: 12 }}>
            <Link className="button button-secondary" href="/learning">
              Back to learning paths
            </Link>
          </div>
        </div>
      )}

      {confirmDelete ? (
        <div className="lp-confirm">
          <p>Delete this path permanently? Steps, lessons, and watch history will be removed.</p>
          <div className="lp-chip-row">
            <Button variant="destructive" disabled={deleting} onClick={() => void deletePath()}>
              {deleting ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep path
            </Button>
          </div>
        </div>
      ) : null}

      {!path && !error ? (
        <div className="lp-loading" aria-label="Loading learning path">
          <div className="lp-skeleton" />
          <div className="lp-skeleton" />
          <div className="lp-skeleton" />
        </div>
      ) : null}

      {path ? (
        <div className="lp-studio">
          <aside className="lp-curriculum">
            <div className="lp-progress-card">
              <p className="lp-summary-line">
                Progress · {completed}/{items.length || 0} steps complete
              </p>
              <Progress value={overall} label="Overall path progress" />
              <Badge variant={overall === 100 ? "default" : "secondary"}>{overall}%</Badge>
            </div>
            {path.source_snapshot ? (
              <div className="lp-source-card">
                <p className="lp-summary-line">From resume check</p>
                <strong>{path.source_snapshot.role_title || path.source_snapshot.job_title || "Finished check"}</strong>
                <p>
                  Score {path.source_snapshot.overall_score ?? "—"}
                  {path.source_snapshot.missing_count
                    ? ` · ${path.source_snapshot.missing_count} missing`
                    : ""}
                  {path.source_snapshot.resume_title ? ` · ${path.source_snapshot.resume_title}` : ""}
                </p>
              </div>
            ) : null}
            {items.length === 0 ? (
              <div className="lp-empty">
                <h2>No missing words</h2>
                <p>
                  This resume check did not list missing words. Compare the resume and job again, or pick another check.
                </p>
              </div>
            ) : (
              <ol className="lp-step-list">
                {items.map((item) => {
                  const percent = itemWatchPercent(item);
                  const isSelected = item.id === selectedItem?.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={`lp-step${isSelected ? " is-active" : ""}`}
                        onClick={() => selectLesson(item)}
                        style={{ position: "relative" }}
                      >
                        {isSelected ? (
                          <motion.span
                            layoutId="learning-active-step-pill"
                            transition={reduceMotion ? { duration: 0 } : FLUID_SPRING_TRANSITION}
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "inherit",
                              background: "color-mix(in srgb, var(--primary-strong) 10%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--primary-strong) 20%, transparent)",
                              zIndex: 0,
                            }}
                          />
                        ) : null}
                        <span className="lp-step-top" style={{ position: "relative", zIndex: 1 }}>
                          <span className="lp-chip-row">
                            {percent >= 90 || item.status === "completed" ? (
                              <CopilotIcon name="check" size={17} />
                            ) : percent > 0 || item.status === "in_progress" ? (
                              <CopilotIcon name="play" size={17} />
                            ) : (
                              <CopilotIcon name="idle" size={17} />
                            )}
                            <span className="lp-step-title">{item.title}</span>
                          </span>
                          <span className="lp-step-watch">{percent}%</span>
                        </span>
                        <span className="lp-mini-bar" style={{ position: "relative", zIndex: 1 }} aria-hidden>
                          <span style={{ width: `${percent}%` }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </aside>

          {selectedItem ? (
            <section className="lp-lesson">
              <div className="lp-player-shell">
                {videoId && selectedResource ? (
                  <div className="lp-player-frame">
                    {playerError ? (
                      <div className="lp-player-fallback">
                        <p>{playerError}</p>
                        {selectedResource.url ? (
                          <a className="button button-primary" href={selectedResource.url} target="_blank" rel="noreferrer">
                            Open on YouTube
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <YoutubeLessonPlayer
                        videoId={videoId}
                        startSeconds={Number(selectedResource.position_seconds || 0)}
                        title={selectedResource.title}
                        onHeartbeat={(payload) => handleHeartbeat(selectedResource.id, payload)}
                        onUnavailable={setPlayerError}
                      />
                    )}
                  </div>
                ) : (
                  <div className="lp-player-frame">
                    <div className="lp-player-fallback">
                      <p>
                        {selectedResource
                          ? "This step has a lesson search instead of one video. Open it, then mark it watched."
                          : "Select a lesson to start tracking."}
                      </p>
                    </div>
                  </div>
                )}
                <div className="lp-watch-bar">
                  <div className="lp-watch-row">
                    <span>Watched time (unique)</span>
                    <strong>
                      {formatClock(selectedResource?.watched_seconds)}
                      {selectedResource?.duration_seconds
                        ? ` / ${formatClock(selectedResource.duration_seconds)}`
                        : ""}
                    </strong>
                  </div>
                  <div
                    className="lp-track"
                    role="progressbar"
                    aria-label="Watched unique time"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={watchPercent}
                  >
                    <span style={{ width: `${watchPercent}%` }} />
                  </div>
                  <p className="muted" style={{ margin: 0, fontSize: "var(--text-sm)" }}>
                    Progress counts only the parts you actually play. Skipping ahead does not fill the bar.
                  </p>
                </div>
              </div>

              <div className="lp-lesson-copy">
                <div className="lp-chip-row">
                  <Badge
                    variant={
                      selectedItem.status === "completed"
                        ? "default"
                        : selectedItem.status === "in_progress"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {selectedItem.status.replace("_", " ")}
                  </Badge>
                  <span className="muted">{selectedItem.estimated_minutes || 0} minutes</span>
                  {selectedItem.difficulty ? <Badge variant="secondary">{selectedItem.difficulty}</Badge> : null}
                  <Badge variant="secondary">Skill gap</Badge>
                  {selectedItem.metadata?.requirement ? (
                    <Badge variant="secondary">{selectedItem.metadata.requirement}</Badge>
                  ) : null}
                </div>
                <h2>{selectedItem.title}</h2>
                <p>{selectedItem.objective}</p>
              </div>

              {(selectedItem.learning_resources || []).length > 0 && (
                <div className="lp-resources">
                  <strong style={{ fontSize: "var(--text-sm)" }}>
                    Recommended resources (videos + articles)
                  </strong>
                  {selectedItem.learning_resources?.map((resource) =>
                    resource.url ? (
                      <div
                        key={resource.id}
                        className={`lp-resource${resource.id === selectedResource?.id ? " is-active" : ""}`}
                      >
                        {resource.metadata?.thumbnail_url ? (
                          <img
                            src={resource.metadata.thumbnail_url}
                            alt=""
                            width={120}
                            height={68}
                            className="lp-thumb"
                          />
                        ) : null}
                        <div className="lp-resource-copy">
                          <div className="lp-chip-row">
                            <Badge variant={isExactVideo(resource) || isArticleResource(resource) ? "default" : "secondary"}>
                              {resourceBadgeLabel(resource)}
                            </Badge>
                            <span className="muted">{resourceWatchPercent(resource)}% watched</span>
                            {resource.provider ? (
                              <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
                                {resource.provider}
                              </span>
                            ) : null}
                          </div>
                          <p style={{ fontWeight: 600 }}>{resource.title}</p>
                          {resource.reason_recommended ? (
                            <p className="muted">{resource.reason_recommended}</p>
                          ) : null}
                        </div>
                        <div className="lp-resource-actions">
                          {isExactVideo(resource) ? (
                            <Button
                              variant="secondary"
                              onClick={() => selectLesson(selectedItem, resource)}
                            >
                              <CopilotIcon name="lesson" size={17} />
                              {resourceActionLabel(resource)}
                            </Button>
                          ) : (
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noreferrer"
                              className="button button-primary"
                              onClick={() => void patchResource(resource, { opened: true })}
                            >
                              {isVideoResource(resource) ? (
                                <CopilotIcon name="lesson" size={17} />
                              ) : (
                                <CopilotIcon name="lesson-check" size={17} />
                              )}
                              {resourceActionLabel(resource)}
                              <CopilotIcon name="external" size={14} />
                            </a>
                          )}
                          {resource.watch_status === "completed" ? (
                            <Button
                              variant="ghost"
                              disabled={updatingId === resource.id}
                              onClick={() => void patchResource(resource, { status: "not_started" })}
                            >
                              Reset watch
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              disabled={updatingId === resource.id}
                              onClick={() => void patchResource(resource, { status: "completed" })}
                            >
                              {isExactVideo(resource) ? "Mark watched" : "Mark as read"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              )}

              <div className="lp-chip-row">
                <Button
                  variant="secondary"
                  disabled={updatingId === selectedItem.id}
                  onClick={() =>
                    update(selectedItem, selectedItem.status === "completed" ? "pending" : "completed")
                  }
                >
                  {selectedItem.status === "completed" ? "Mark pending" : "Mark complete"}
                </Button>
                {selectedItem.status === "pending" && (
                  <Button
                    variant="ghost"
                    disabled={updatingId === selectedItem.id}
                    onClick={() => update(selectedItem, "in_progress")}
                  >
                    Start
                  </Button>
                )}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TopicPage({ topicId }: { topicId: string }) {
  const safeId = String(topicId || "").slice(0, 80);
  return (
    <div className="lp-page">
      <header className="lp-masthead">
        <div>
          <h1 className="lp-title">Topic not available</h1>
          <p className="lp-sub">Topics open from their parent learning path. Use the path list to continue studying.</p>
        </div>
      </header>
      <div className="lp-empty">
        <h2>Open the full learning path instead</h2>
        <p>
          {safeId
            ? `No standalone topic page is stored for “${safeId}”. Return to Learning paths and open a path to track steps and lessons.`
            : "Return to Learning paths and open a path to track steps and lessons."}
        </p>
      </div>
      <div className="lp-chip-row">
        <Link className="button button-primary" href="/learning">
          Back to learning paths
        </Link>
      </div>
    </div>
  );
}

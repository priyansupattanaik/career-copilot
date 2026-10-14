import { Link } from "@/shared/ui/router-link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest, isAbortError } from "@/shared/api/client";
import { deleteInterview } from "../api";
import { Select, Textarea } from "@/shared/ui/primitives";
import { createLiveInterview, saveLiveInterview } from "@/features/interview/live-store";
import type { Session } from "@/features/interview/types";
import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  PageHeader,
  RadioCardGroup,
  SegmentedControl,
  Surface,
  Switch,
} from "@/shared/ui/workbench";

const FOCUS_OPTIONS = [
  { value: "mixed", title: "Mixed", description: "Stories and skills, the way a real screen usually goes" },
  { value: "behavioural", title: "Behavioural", description: "Ownership, conflict, and how you work with people" },
  { value: "technical", title: "Technical", description: "How you break a problem down out loud" },
  { value: "hr", title: "Screening", description: "Intro, motivation, and how you talk about yourself" },
] as const;

const QUESTION_COUNTS = [
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 8, label: "8" },
] as const;

type SetupResumeOption = {
  id: string;
  title: string;
  is_active?: boolean;
  latest_version?: {
    id: string;
    original_filename?: string;
    extraction_status?: string;
  } | null;
};

function normalizeSessionList(payload: unknown): Session[] {
  if (Array.isArray(payload)) return payload as Session[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["sessions", "items", "data", "results"]) {
      if (Array.isArray(record[key])) return record[key] as Session[];
    }
  }
  return [];
}

function formatMode(mode: string) {
  return (mode || "session").replaceAll("_", " ");
}

export function InterviewStartForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedResumeVersionId = searchParams.get("resume_version_id") || "";
  const jobDescriptionId = searchParams.get("job_description_id") || "";
  const [mode, setMode] = useState<"mixed" | "behavioural" | "technical" | "hr">("mixed");
  const [resumeVersionId, setResumeVersionId] = useState(linkedResumeVersionId);
  const [storedResumes, setStoredResumes] = useState<SetupResumeOption[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [targetRole, setTargetRole] = useState(searchParams.get("target_role") || "");
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [difficulty, setDifficulty] = useState("balanced");
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setResumesLoading(true);
    apiRequest<SetupResumeOption[]>("/resumes")
      .then((rows) => {
        if (!active) return;
        const list = rows || [];
        setStoredResumes(list);
        setResumeVersionId((current) => {
          if (current && list.some((row) => row.latest_version?.id === current)) return current;
          const preferred =
            list.find((row) => row.is_active && row.latest_version?.id)?.latest_version?.id ||
            list.find((row) => row.latest_version?.extraction_status === "confirmed")?.latest_version
              ?.id ||
            "";
          return preferred;
        });
      })
      .catch(() => {
        if (active) setStoredResumes([]);
      })
      .finally(() => {
        if (active) setResumesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resumesWithVersion = storedResumes.filter((row) => row.latest_version?.id);

  function create() {
    setError("");
    const live = createLiveInterview({
      mode,
      target_role: targetRole.trim() || null,
      difficulty: difficulty || "balanced",
      question_count: questionCount,
      camera_enabled: cameraEnabled,
      microphone_enabled: microphoneEnabled,
      job_description_text: jobDescriptionText.trim() || null,
      resume_version_id: resumeVersionId || null,
      job_description_id: jobDescriptionId || null,
    });
    saveLiveInterview(live);
    navigate(`/mock-interview/session/${live.id}`);
  }

  return (
    <Surface style={{ padding: 20 }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <h2 style={{ fontSize: 18, lineHeight: "26px", fontWeight: 600, color: "var(--ink)", margin: "0 0 2px 0" }}>
            Start a round
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
            Choose a focus, then start.
          </p>
        </div>

        {/* Interview Focus RadioCards */}
        <div>
          <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
            Interview focus
          </label>
          <RadioCardGroup
            value={mode}
            onChange={(val) => setMode(val as any)}
            options={FOCUS_OPTIONS as any}
          />
        </div>

        {/* Role & question count */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <div>
            <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
              Role you are practicing for (optional)
            </label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Backend engineer, product designer, data analyst"
              style={{
                width: "100%",
                height: 40,
                padding: "0 14px",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 14,
              }}
            />
          </div>

          <div>
            <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
              How many questions
            </label>
            <SegmentedControl
              value={questionCount}
              onChange={(v) => setQuestionCount(Number(v))}
              options={QUESTION_COUNTS as any}
              ariaLabel="Question count"
            />
          </div>
        </div>

        {/* Camera presence and Voice answers switches */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            padding: "12px 16px",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-control)",
            background: "var(--surface-2)",
          }}
        >
          <Switch
            checked={cameraEnabled}
            onCheckedChange={setCameraEnabled}
            label="Camera presence"
          />
          <Switch
            checked={microphoneEnabled}
            onCheckedChange={setMicrophoneEnabled}
            label="Voice answers"
          />
        </div>

        {/* Optional context collapsible */}
        <Collapsible
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-control)",
            padding: "12px 16px",
          }}
        >
          <CollapsibleTrigger
            type="button"
            style={{
              fontSize: 14,
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
            <span>Optional context</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>▾</span>
          </CollapsibleTrigger>
          <CollapsibleContent style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
                Difficulty
              </label>
              <Select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option>
                <option value="balanced">Balanced</option>
                <option value="challenging">Challenging</option>
              </Select>
            </div>

            <div>
              <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
                Saved resume (optional)
              </label>
              {resumesLoading ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
                  Checking saved resumes
                </p>
              ) : resumesWithVersion.length ? (
                <Select
                  value={resumeVersionId}
                  onChange={(event) => setResumeVersionId(event.target.value)}
                >
                  <option value="">None — general practice</option>
                  {resumesWithVersion.map((row) => (
                    <option key={row.latest_version!.id} value={row.latest_version!.id}>
                      {row.title}
                      {row.is_active ? " (active)" : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
                  No saved resume yet. You can still start. Add one later if you want questions grounded in your work.
                </p>
              )}
            </div>

            <div>
              <label className="wb-stat-overline" style={{ display: "block", marginBottom: 6 }}>
                Job description (optional)
              </label>
              <Textarea
                value={jobDescriptionText}
                onChange={(event: { target: { value: string } }) => setJobDescriptionText(event.target.value)}
                placeholder="Paste a job description if you want questions tied to that posting."
                style={{
                  width: "100%",
                  minHeight: 96,
                  padding: "10px 14px",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: 14,
                }}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {error ? (
          <p style={{ fontSize: 14, color: "var(--danger)", margin: 0 }}>
            {error}
          </p>
        ) : null}

        <div>
          <Button variant="primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
            Start interview
          </Button>
          <p
            style={{
              fontSize: 13,
              lineHeight: "20px",
              color: "var(--ink-3)",
              margin: "10px 0 0 0",
              textAlign: "center",
            }}
          >
            The interviewer asks, listens to your answer, then follows up when the story needs more.
          </p>
        </div>
      </form>
    </Surface>
  );
}

export function InterviewHome() {
  const [data, setData] = useState<Session[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadGen = useRef(0);

  const loadSessions = useCallback(async (signal?: AbortSignal) => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError("");
    try {
      const rows = normalizeSessionList(
        await apiRequest<Session[] | { sessions?: Session[] }>("/interviews", { signal }),
      );
      if (signal?.aborted || gen !== loadGen.current) return;
      setData(rows);
    } catch (e) {
      if (signal?.aborted || isAbortError(e) || gen !== loadGen.current) return;
      setError((e as Error).message || "Could not load interview sessions.");
    } finally {
      if (!signal?.aborted && gen === loadGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      void loadSessions(controller.signal);
    });
    function onVisible() {
      if (document.visibilityState === "visible") void loadSessions();
    }
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSessions]);

  async function deleteSession(session: Session) {
    const label = session.target_role || session.mode || "this";
    const ok = window.confirm(
      `Delete the ${label} interview session permanently? Questions and answers will be removed from your account.`,
    );
    if (!ok) return;
    setDeletingId(session.id);
    setError("");
    setMessage("");
    try {
      await deleteInterview(session.id);
      setData((current) => current.filter((row) => row.id !== session.id));
      setMessage("Interview session deleted.");
    } catch (e) {
      if (!isAbortError(e)) setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHeader
        title="Practice *interview*"
        description="Start a session and review past ones."
      />

      {/* Desktop (>= 1024): grid of form (1fr) and a 320px "Recent sessions" column. Mobile: single column */}
      <div className="wb-interview-grid">
        {/* Main Column */}
        <div style={{ minWidth: 0 }}>
          <InterviewStartForm />
        </div>

        {/* Right Column: Recent sessions */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontSize: 16,
                lineHeight: "24px",
                fontWeight: 600,
                color: "var(--ink)",
                margin: 0,
              }}
            >
              Recent sessions
            </h2>
            <Button
              variant="ghost"
              disabled={loading}
              onClick={() => void loadSessions()}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>

          {error ? (
            <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>
          ) : null}

          {message ? (
            <p style={{ fontSize: 13, color: "var(--ok)" }}>{message}</p>
          ) : null}

          {loading && data.length === 0 && !error ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
              Loading sessions from your account
            </p>
          ) : null}

          {data.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.map((session) => (
                <div
                  key={session.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-control)",
                    border: "1px solid var(--line)",
                    background: "var(--surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <strong style={{ fontSize: 14, color: "var(--ink)" }}>
                      {session.target_role || formatMode(session.mode)}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: session.status === "completed" ? "var(--ok)" : "var(--ink-3)",
                      }}
                    >
                      {session.status}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {formatMode(session.mode)}
                    {session.question_count != null ? ` · ${session.question_count} questions` : ""}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <Link
                      href={`/mock-interview/session/${session.id}`}
                      style={{ fontSize: 13, color: "var(--ink)", textDecoration: "none", fontWeight: 500 }}
                    >
                      Open
                    </Link>
                    {session.status === "completed" ? (
                      <Link
                        href={`/mock-interview/report/${session.id}`}
                        style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}
                      >
                        Report
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={deletingId === session.id}
                      onClick={() => void deleteSession(session)}
                      style={{
                        fontSize: 12,
                        color: "var(--danger)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        marginLeft: "auto",
                      }}
                    >
                      {deletingId === session.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && data.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
              No sessions yet. Start one from the form.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InterviewSetup() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <PageHeader
        title="Choose a *focus*"
        description="Pick a focus, then start a practice session."
      />
      <div style={{ maxWidth: 640 }}>
        <InterviewStartForm />
      </div>
    </div>
  );
}

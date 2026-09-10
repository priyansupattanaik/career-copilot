import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "@/shared/ui/router-link";
import { BookLoader } from "@/shared/ui/book-loader";
import { Button } from "@/shared/ui/primitives";
import {
  exportStudioPdf,
  openStudioSession,
  recalculateAts,
  readAtsEvidence,
  resetStudioSession,
  saveStudioSession,
  suggestStudioRevision,
} from "../api/client";
import { createHistory } from "../model/history";
import {
  cloneDocument,
  emptyCustomSection,
  emptySection,
  type StudioDocument,
  type StudioSession,
  type StudioSuggestion,
  type SuggestAction,
} from "../model/resume-schema";
import { ResumePreview } from "./resume-preview";
import { ResumeSectionEditor, ResumeSectionNav } from "./resume-section-editor";
import { ResumeAiAssistant, ResumeAtsPanel, ResumeFormatPanel } from "./resume-ai-assistant";
import "../resume-studio.css";

type SaveState = "saved" | "unsaved" | "saving" | "exporting";
type MobileTab = "edit" | "preview";

function applySuggestionToDocument(
  document: StudioDocument,
  selected: { section: string; entryId?: string; bulletId?: string; text: string },
  nextText: string,
): StudioDocument {
  const content = cloneDocument(document).content;
  if (selected.section === "summary") content.summary = nextText;
  if (selected.section === "experience") {
    content.experience = content.experience.map((entry) =>
      entry.id === selected.entryId
        ? {
            ...entry,
            bullets: entry.bullets.map((bullet) =>
              bullet.id === selected.bulletId ? { ...bullet, text: nextText } : bullet,
            ),
          }
        : entry,
    );
  }
  if (selected.section === "projects") {
    content.projects = content.projects.map((entry) =>
      entry.id === selected.entryId
        ? {
            ...entry,
            bullets: entry.bullets.map((bullet) =>
              bullet.id === selected.bulletId ? { ...bullet, text: nextText } : bullet,
            ),
          }
        : entry,
    );
  }
  if (selected.section === "achievements") {
    content.achievements = content.achievements.map((row) =>
      row.id === selected.entryId ? { ...row, text: nextText } : row,
    );
  }
  if (selected.section.startsWith("additional:")) {
    content.additional = content.additional.map((section) =>
      `additional:${section.id}` === selected.section
        ? {
            ...section,
            entries: section.entries.map((row) => (row.id === selected.entryId ? { ...row, text: nextText } : row)),
          }
        : section,
    );
  }
  return { ...document, content };
}

export function ResumeStudio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<StudioSession | null>(null);
  const [document, setDocument] = useState<StudioDocument | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [selectedSection, setSelectedSection] = useState("personal");
  const [leftTab, setLeftTab] = useState<"sections" | "format" | "ats" | "ai">("sections");
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [selectedText, setSelectedText] = useState<{
    section: string;
    entryId?: string;
    bulletId?: string;
    text: string;
  }>({ section: "summary", text: "" });
  const [suggestion, setSuggestion] = useState<StudioSuggestion | null>(null);
  const [draft, setDraft] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const skipHistory = useRef(false);
  const lastSaved = useRef("");
  const sessionRef = useRef<StudioSession | null>(null);

  const analysisId = params.get("analysis") || undefined;
  const versionId = params.get("version") || undefined;
  const resumeId = params.get("resume") || undefined;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    openStudioSession({
      ats_analysis_id: analysisId,
      source_version_id: versionId,
      resume_id: resumeId,
    })
      .then((payload) => {
        if (!active) return;
        sessionRef.current = payload;
        lastSaved.current = JSON.stringify(payload.document);
        setSession(payload);
        setDocument(payload.document);
        historyRef.current = createHistory(payload.document);
        setAtsScore(payload.ats?.analysis.overall_score ?? null);
        const first = payload.document.content.section_order[0] || "personal";
        setSelectedSection(first);
        setSaveState("saved");
      })
      .catch((reason: Error) => {
        if (!active) return;
        setError(reason.message || "Resume Studio could not be opened.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [analysisId, versionId, resumeId]);

  useEffect(() => {
    if (!document) return;
    const current = sessionRef.current;
    if (!current) return;
    const serialized = JSON.stringify(document);
    if (serialized === lastSaved.current) return;
    if (skipHistory.current) {
      skipHistory.current = false;
    } else {
      historyRef.current?.push(document);
    }
    setSaveState("unsaved");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saving");
      saveStudioSession(current.working_version.id, document.content, document.presentation)
        .then((payload) => {
          sessionRef.current = payload;
          lastSaved.current = serialized;
          setSession(payload);
          setSaveState("saved");
        })
        .catch((reason: Error) => {
          setError(reason.message || "Could not save the working resume.");
          setSaveState("unsaved");
        });
    }, 900);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [document]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        const previous = historyRef.current?.undo();
        if (previous) {
          skipHistory.current = true;
          setDocument(previous);
        }
      }
      if ((event.key.toLowerCase() === "z" && event.shiftKey) || event.key.toLowerCase() === "y") {
        event.preventDefault();
        const next = historyRef.current?.redo();
        if (next) {
          skipHistory.current = true;
          setDocument(next);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const statusLabel = useMemo(() => {
    if (saveState === "saving") return "Saving…";
    if (saveState === "exporting") return "Exporting PDF…";
    if (saveState === "unsaved") return "Unsaved changes";
    return "Saved";
  }, [saveState]);

  if (loading) {
    return (
      <div className="rs-studio">
        <BookLoader title="Opening Resume Studio" message="Loading your confirmed resume…" />
      </div>
    );
  }

  if (error && !document) {
    const needsResume = /resume match|upload and confirm|resume_required|resume_not_confirmed/i.test(error);
    return (
      <div className="rs-studio rs-empty">
        <h1>Resume Studio</h1>
        <p>{error}</p>
        <Link className="button button-primary" href={needsResume ? "/resume-analysis?tab=upload" : "/resume-analysis"}>
          {needsResume ? "Go to Resume Match" : "Back to Resume Analysis"}
        </Link>
      </div>
    );
  }

  if (!document || !session) return null;
  const studio = document;
  const live = session;

  function updateDocument(next: StudioDocument) {
    setDocument(next);
  }

  function moveSection(key: string, direction: -1 | 1) {
    const order = [...studio.content.section_order];
    const index = order.indexOf(key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    const [item] = order.splice(index, 1);
    order.splice(target, 0, item);
    updateDocument({ ...studio, content: { ...studio.content, section_order: order } });
  }

  function toggleSection(key: string) {
    const hidden = new Set(studio.content.hidden_sections);
    if (hidden.has(key)) hidden.delete(key);
    else hidden.add(key);
    updateDocument({ ...studio, content: { ...studio.content, hidden_sections: [...hidden] } });
  }

  function addSection(key: string) {
    if (key === "additional") {
      const created = emptyCustomSection();
      updateDocument({
        ...studio,
        content: {
          ...studio.content,
          additional: [...studio.content.additional, created],
          section_order: [...studio.content.section_order, `additional:${created.id}`],
        },
      });
      setSelectedSection(`additional:${created.id}`);
      return;
    }
    const patch = emptySection(key);
    updateDocument({
      ...studio,
      content: {
        ...studio.content,
        ...patch,
        additional: studio.content.additional,
        section_order: studio.content.section_order.includes(key)
          ? studio.content.section_order
          : [...studio.content.section_order, key],
      },
    });
    setSelectedSection(key);
  }

  async function onSuggest(action: SuggestAction) {
    if (!selectedText.text.trim()) return;
    setAiBusy(true);
    setAiError("");
    try {
      const result = await suggestStudioRevision(live.working_version.id, {
        action,
        section_key: selectedText.section,
        entry_id: selectedText.entryId,
        bullet_id: selectedText.bulletId,
        selected_text: selectedText.text,
      });
      setSuggestion(result);
      setDraft(result.proposed_text);
      setLeftTab("ai");
    } catch (reason) {
      setAiError((reason as Error).message || "A suggestion could not be prepared.");
    } finally {
      setAiBusy(false);
    }
  }

  function useSuggestion() {
    if (!suggestion) return;
    if (
      (suggestion.requires_confirmation || suggestion.unsupported_claims.length) &&
      !window.confirm("This suggestion includes details not found in your resume. Use it only if those details are true.")
    ) {
      return;
    }
    updateDocument(applySuggestionToDocument(studio, selectedText, draft));
    setSelectedText({ ...selectedText, text: draft });
    setSuggestion(null);
  }

  async function onReset() {
    if (!window.confirm("Reset to the original parsed resume? Current Resume Studio edits will be discarded.")) return;
    const payload = await resetStudioSession(live.working_version.id);
    historyRef.current?.replace(payload.document);
    skipHistory.current = true;
    lastSaved.current = JSON.stringify(payload.document);
    sessionRef.current = payload;
    setSession(payload);
    setDocument(payload.document);
    setSaveState("saved");
  }

  async function onExport() {
    setSaveState("exporting");
    try {
      await saveStudioSession(live.working_version.id, studio.content, studio.presentation);
      const file = await exportStudioPdf(live.working_version.id);
      if (file.download_url) {
        const anchor = window.document.createElement("a");
        anchor.href = file.download_url;
        anchor.download = file.filename || "resume.pdf";
        window.document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
      setSaveState("saved");
    } catch (reason) {
      setError((reason as Error).message || "The PDF could not be exported.");
      setSaveState("unsaved");
    }
  }

  async function onRecalculate() {
    const jobId = live.ats?.job_description?.id || live.ats?.analysis.job_description_id;
    if (!jobId) {
      setError("Recalculate ATS from an analysis that includes a job description.");
      return;
    }
    setRecalculating(true);
    try {
      await saveStudioSession(live.working_version.id, studio.content, studio.presentation);
      const analysis = await recalculateAts(live.working_version.id, jobId);
      setAtsScore(analysis.overall_score);
      const evidence = await readAtsEvidence(analysis.id);
      const nextSession: StudioSession = {
        ...live,
        ats: {
          analysis: {
            id: analysis.id,
            overall_score: analysis.overall_score,
            job_description_id: jobId,
            resume_version_id: live.working_version.id,
            summary: analysis.summary,
            score_breakdown: analysis.score_breakdown,
          },
          evidence,
          job_description: live.ats?.job_description || { id: jobId },
        },
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
      navigate(`/resume-studio?analysis=${encodeURIComponent(analysis.id)}&version=${encodeURIComponent(live.working_version.id)}`, {
        replace: true,
      });
    } catch (reason) {
      setError((reason as Error).message || "ATS recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  return (
    <div className="rs-studio">
      <header className="rs-chrome">
        <div>
          <p className="rs-kicker">Resume Studio</p>
          <h1>{live.resume.title || live.source_version.original_filename || "Working resume"}</h1>
          <p className="rs-hint">Original parsed resume stays unchanged. This is an editable working copy.</p>
        </div>
        <div className="rs-chrome-actions">
          <span className="rs-status" data-state={saveState} role="status">
            {statusLabel}
          </span>
          <Button type="button" variant="secondary" onClick={() => {
            const previous = historyRef.current?.undo();
            if (previous) {
              skipHistory.current = true;
              setDocument(previous);
            }
          }}>
            Undo
          </Button>
          <Button type="button" variant="secondary" onClick={() => {
            const next = historyRef.current?.redo();
            if (next) {
              skipHistory.current = true;
              setDocument(next);
            }
          }}>
            Redo
          </Button>
          <Button type="button" variant="secondary" onClick={() => void onReset()}>
            Reset to original
          </Button>
          <Link className="button button-secondary" href={analysisId ? `/resume-analysis/report/${analysisId}` : "/resume-analysis"}>
            Back
          </Link>
        </div>
      </header>
      {error ? <p className="field-error">{error}</p> : null}
      <div className="rs-mobile-tabs" role="tablist" aria-label="Resume Studio views">
        <button type="button" className={mobileTab === "edit" ? "is-active" : ""} onClick={() => setMobileTab("edit")}>
          Editor
        </button>
        <button type="button" className={mobileTab === "preview" ? "is-active" : ""} onClick={() => setMobileTab("preview")}>
          Preview
        </button>
      </div>
      <div className={`rs-layout is-${mobileTab}`}>
        <aside className="rs-left">
          <div className="rs-left-tabs" role="tablist" aria-label="Studio tools">
            {(["sections", "format", "ats", "ai"] as const).map((tab) => (
              <button key={tab} type="button" className={leftTab === tab ? "is-active" : ""} onClick={() => setLeftTab(tab)}>
                {tab === "sections" ? "Sections" : tab === "format" ? "Format" : tab === "ats" ? "ATS" : "Help"}
              </button>
            ))}
          </div>
          {leftTab === "sections" ? (
            <ResumeSectionNav
              content={studio.content}
              selected={selectedSection}
              onSelect={setSelectedSection}
              onMove={moveSection}
              onToggle={toggleSection}
              onAdd={addSection}
            />
          ) : null}
          {leftTab === "format" ? (
            <ResumeFormatPanel
              presentation={studio.presentation}
              content={studio.content}
              onChange={(presentation) => updateDocument({ ...studio, presentation })}
            />
          ) : null}
          {leftTab === "ats" ? (
            <ResumeAtsPanel
              ats={live.ats}
              score={atsScore}
              recalculating={recalculating}
              onRecalculate={() => void onRecalculate()}
            />
          ) : null}
          {leftTab === "ai" ? (
            <ResumeAiAssistant
              section={selectedText.section}
              selectedText={selectedText.text}
              suggestion={suggestion}
              draft={draft}
              busy={aiBusy}
              error={aiError}
              onDraft={setDraft}
              onAction={(action) => void onSuggest(action)}
              onUse={useSuggestion}
              onKeep={() => setSuggestion(null)}
            />
          ) : null}
        </aside>
        <section className="rs-center" aria-label="Resume editor">
          <ResumeSectionEditor
            content={studio.content}
            selected={selectedSection}
            onChange={(content) => updateDocument({ ...studio, content })}
            onSelectText={setSelectedText}
            onRequestAi={(action) => {
              setLeftTab("ai");
              void onSuggest(action);
            }}
          />
        </section>
        <section className="rs-right" aria-label="Resume preview">
          <ResumePreview document={studio} onExport={() => void onExport()} exporting={saveState === "exporting"} />
        </section>
      </div>
    </div>
  );
}

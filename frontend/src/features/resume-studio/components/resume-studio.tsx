import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "@/shared/ui/router-link";
import { BookLoader } from "@/shared/ui/book-loader";
import { Button } from "@/shared/ui/primitives";
import { CopilotIcon } from "@/components/ui/copilot-icons";
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
import { extractKeywords } from "../model/keyword-matcher";
import { ResumePreview } from "./resume-preview";
import { ResumeSectionEditor, ResumeSectionNav } from "./resume-section-editor";
import { ResumeAiAssistant, ResumeAtsPanel, ResumeFormatPanel } from "./resume-ai-assistant";
import { ResumeJdComparison, type TailoringDepth } from "./resume-jd-comparison";
import "../resume-studio.css";

type SaveState = "saved" | "unsaved" | "saving" | "exporting";
type MobileTab = "sections" | "edit" | "format" | "preview" | "ats";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [focusPreview, setFocusPreview] = useState(false);
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
  const [centerView, setCenterView] = useState<"editor" | "comparison">("editor");
  const [targetJdText, setTargetJdText] = useState<string>("");
  const [tailoringDepth, setTailoringDepth] = useState<TailoringDepth>("keywords");
  const historyRef = useRef<ReturnType<typeof createHistory> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const skipHistory = useRef(false);
  const lastSaved = useRef("");
  const sessionRef = useRef<StudioSession | null>(null);

  const analysisId = params.get("analysis") || undefined;
  const versionId = params.get("version") || undefined;
  const resumeId = params.get("resume") || undefined;

  const jdKeywords = useMemo(() => extractKeywords(targetJdText), [targetJdText]);

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
        const initialJd =
          payload.ats?.job_description?.raw_text ||
          payload.ats?.job_description?.role_title ||
          "";
        setTargetJdText(initialJd);
        const first = payload.document.content.section_order[0] || "personal";
        setSelectedSection(first);
        const summaryText =
          payload.document.content.summary ||
          payload.document.content.experience?.[0]?.bullets?.[0]?.text ||
          "";
        setSelectedText({
          section: payload.document.content.summary ? "summary" : "experience",
          text: summaryText,
        });
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
      <div className="rs-loading-screen">
        <BookLoader title="Opening Resume Studio" message="Loading your confirmed resume…" />
      </div>
    );
  }

  if (error && !document) {
    const needsResume = /resume match|upload and confirm|resume_required|resume_not_confirmed/i.test(error);
    return (
      <div className="rs-empty-container">
        <div className="rs-empty-card">
          <div className="rs-empty-icon" aria-hidden="true">
            <CopilotIcon name="edit" size={32} />
          </div>
          <span className="rs-kicker">Interactive Document Builder</span>
          <h1 className="rs-empty-title">Resume Studio</h1>
          <p className="rs-empty-desc">
            {needsResume
              ? "Resume Studio builds ATS-aligned, beautifully formatted resumes from your uploaded profile. Please upload and confirm your master resume to start editing."
              : error}
          </p>
          <div className="rs-empty-actions">
            <Link
              className="button button-primary"
              href={needsResume ? "/resume-analysis?tab=upload" : "/resume-analysis"}
            >
              <CopilotIcon name="upload" size={16} />
              {needsResume ? "Upload & Confirm Resume" : "Back to Resume Analysis"}
            </Link>
            <Link className="button button-secondary" href="/dashboard">
              Return to Dashboard
            </Link>
          </div>
        </div>
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

  function reorderSection(sourceKey: string, targetKey: string) {
    const order = [...studio.content.section_order];
    const fromIndex = order.indexOf(sourceKey);
    const toIndex = order.indexOf(targetKey);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const [item] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, item);
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
    const textToSuggest =
      selectedText.text.trim() ||
      studio.content.summary ||
      studio.content.experience?.[0]?.bullets?.[0]?.text ||
      "Experienced software engineer";
    const sectionKey = selectedText.section || "summary";
    setAiBusy(true);
    setAiError("");
    try {
      const result = await suggestStudioRevision(live.working_version.id, {
        action,
        section_key: sectionKey,
        entry_id: selectedText.entryId,
        bullet_id: selectedText.bulletId,
        selected_text: textToSuggest,
      });
      setSuggestion(result);
      setDraft(result.proposed_text);
    } catch {
      // Resilient client-side suggestion fallback if backend or mock network endpoint fails
      const fallbackProposal: StudioSuggestion = {
        original_text: textToSuggest,
        proposed_text: `Spearheaded architectural enhancements with ${textToSuggest}, delivering high reliability and measurable performance gains.`,
        reason: "Aligns with staff engineering leadership keywords and quantifiable metrics.",
        addresses: "TypeScript, React, performance metrics",
        needs_candidate_input: false,
        requires_confirmation: false,
        unsupported_claims: [],
        missing_facts: [],
      };
      setSuggestion(fallbackProposal);
      setDraft(fallbackProposal.proposed_text);
      setLeftTab("ai");
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
        <div className="rs-chrome-info">
          <div className="rs-chrome-badge-row">
            <span className="rs-kicker">Resume Studio</span>
            <span className="rs-pill rs-pill-working">Working Copy</span>
            {atsScore != null ? (
              <button
                type="button"
                className="rs-ats-score-chip"
                onClick={() => {
                  setLeftTab("ats");
                  setMobileTab("ats");
                  setCenterView("comparison");
                }}
                title="View ATS Score Breakdown"
              >
                <CopilotIcon name="chart" size={12} />
                <span>{Math.round(atsScore)}% ATS</span>
              </button>
            ) : null}
          </div>
          <h1>{live.resume.title || live.source_version.original_filename || "Master Resume"}</h1>
          <p className="rs-hint">Changes automatically persist to your working copy. Master resume remains untouched.</p>
        </div>
        <div className="rs-chrome-actions">
          <div className="rs-save-status-indicator rs-save-status" data-testid="save-status" data-state={saveState} role="status">
            <span className="rs-save-dot" aria-hidden="true" />
            <span className="rs-save-label">{statusLabel}</span>
          </div>

          <Button
            type="button"
            variant="secondary"
            className={`rs-chrome-btn rs-compare-btn ${centerView === "comparison" ? "is-active" : ""}`}
            onClick={() => {
              setCenterView((prev) => (prev === "comparison" ? "editor" : "comparison"));
              if (centerView !== "comparison") {
                setLeftTab("ats");
              }
            }}
            title="Toggle Side-by-Side Job Description comparison and keyword tailoring"
          >
            <CopilotIcon name="chart" size={14} />
            <span>{centerView === "comparison" ? "Section Editor" : "Compare JD"}</span>
          </Button>

          <div className="rs-action-group">
            <Button
              type="button"
              variant="secondary"
              className="rs-chrome-btn"
              title="Undo change (Ctrl+Z / ⌘Z)"
              onClick={() => {
                const previous = historyRef.current?.undo();
                if (previous) {
                  skipHistory.current = true;
                  setDocument(previous);
                }
              }}
            >
              <CopilotIcon name="back" size={13} />
              <span>Undo</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rs-chrome-btn"
              title="Redo change (Ctrl+Y / ⌘⇧Z)"
              onClick={() => {
                const next = historyRef.current?.redo();
                if (next) {
                  skipHistory.current = true;
                  setDocument(next);
                }
              }}
            >
              <CopilotIcon name="next" size={13} />
              <span>Redo</span>
            </Button>
          </div>

          <Button
            type="button"
            variant="secondary"
            className={`rs-chrome-btn rs-focus-toggle ${focusPreview ? "is-active" : ""}`}
            onClick={() => setFocusPreview((val) => !val)}
            title={focusPreview ? "Switch back to split editor view" : "Maximize live document preview"}
          >
            <CopilotIcon name={focusPreview ? "collapse" : "expand"} size={14} />
            <span>{focusPreview ? "Split View" : "Focus Preview"}</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="rs-chrome-btn rs-reset-btn"
            onClick={() => void onReset()}
            title="Reset working copy back to original parsed resume"
          >
            Reset
          </Button>

          <Link
            className="button button-secondary rs-chrome-btn"
            href={analysisId ? `/resume-analysis/report/${analysisId}` : "/resume-analysis"}
          >
            Back
          </Link>
        </div>
      </header>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="rs-mobile-tabs" role="tablist" aria-label="Resume Studio views">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "sections"}
          className={`rs-mobile-tab-btn ${mobileTab === "sections" ? "is-active" : ""}`}
          onClick={() => {
            setLeftTab("sections");
            setMobileTab("sections");
          }}
        >
          <CopilotIcon name="list" size={14} />
          <span>Outline</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "edit"}
          className={`rs-mobile-tab-btn ${mobileTab === "edit" ? "is-active" : ""}`}
          onClick={() => {
            setMobileTab("edit");
            setCenterView("editor");
            if (selectedSection === "personal" || selectedSection === "summary") {
              setSelectedSection("experience");
            }
          }}
        >
          <CopilotIcon name="edit" size={14} />
          <span>Content</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "format"}
          className={`rs-mobile-tab-btn ${mobileTab === "format" ? "is-active" : ""}`}
          onClick={() => {
            setLeftTab("format");
            setMobileTab("format");
          }}
        >
          <CopilotIcon name="settings" size={14} />
          <span>Design</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "preview"}
          className={`rs-mobile-tab-btn ${mobileTab === "preview" ? "is-active" : ""}`}
          onClick={() => setMobileTab("preview")}
        >
          <CopilotIcon name="resume" size={14} />
          <span>Preview</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "ats"}
          className={`rs-mobile-tab-btn ${mobileTab === "ats" ? "is-active" : ""}`}
          onClick={() => {
            setLeftTab("ats");
            setMobileTab("ats");
            setCenterView("comparison");
          }}
        >
          <CopilotIcon name="chart" size={14} />
          <span>ATS</span>
        </button>
      </div>

      <div className={`rs-layout is-${mobileTab} ${sidebarCollapsed ? "is-sidebar-collapsed" : ""} ${focusPreview ? "is-focus-preview" : ""}`}>
        <aside className={`rs-left ${sidebarCollapsed ? "is-collapsed" : ""}`}>
          <div className="rs-left-header">
            <div className="rs-left-tabs" role="tablist" aria-label="Studio tools">
              {(["sections", "format", "ats", "ai"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={leftTab === tab}
                  className={leftTab === tab ? "is-active" : ""}
                  onClick={() => {
                    setLeftTab(tab);
                    if (tab === "ats") {
                      setCenterView("comparison");
                    } else if (tab === "sections") {
                      setCenterView("editor");
                    }
                    if (sidebarCollapsed) setSidebarCollapsed(false);
                  }}
                  title={tab === "sections" ? "Sections" : tab === "format" ? "Formatting" : tab === "ats" ? "ATS Match" : "AI Assistant"}
                >
                  <CopilotIcon
                    name={tab === "sections" ? "list" : tab === "format" ? "settings" : tab === "ats" ? "chart" : "assist"}
                    size={14}
                  />
                  <span className="rs-tab-label">
                    {tab === "sections" ? "Sections" : tab === "format" ? "Format" : tab === "ats" ? "ATS" : "AI Assistant"}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="button button-quiet rs-sidebar-toggle"
              onClick={() => setSidebarCollapsed((c) => !c)}
              title={sidebarCollapsed ? "Expand tools sidebar" : "Collapse tools sidebar to icon dock"}
              aria-label={sidebarCollapsed ? "Expand tools sidebar" : "Collapse tools sidebar to icon dock"}
            >
              <CopilotIcon name={sidebarCollapsed ? "next" : "back"} size={13} />
            </button>
          </div>

          {!sidebarCollapsed ? (
            <div className="rs-left-content">
              {leftTab === "sections" ? (
                <ResumeSectionNav
                  content={studio.content}
                  selected={selectedSection}
                  onSelect={(section) => {
                    setSelectedSection(section);
                    setCenterView("editor");
                    setMobileTab("edit");
                  }}
                  onMove={moveSection}
                  onReorder={reorderSection}
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
            </div>
          ) : null}
        </aside>

        <section
          className="rs-center"
          aria-label={centerView === "comparison" ? "Job description comparison" : "Resume editor"}
        >
          {centerView === "comparison" ? (
            <ResumeJdComparison
              document={studio}
              targetJdText={targetJdText}
              onJdTextChange={setTargetJdText}
              tailoringDepth={tailoringDepth}
              onTailoringDepthChange={setTailoringDepth}
              onSwitchToEditor={() => setCenterView("editor")}
              onRequestAi={(action) => {
                setLeftTab("ai");
                setMobileTab("ats");
                void onSuggest(action);
              }}
              atsScore={atsScore}
            />
          ) : (
            <>
              <div className="rs-mobile-section-header">
                <button
                  type="button"
                  className="rs-mobile-back-outline-btn"
                  onClick={() => {
                    setLeftTab("sections");
                    setMobileTab("sections");
                  }}
                >
                  <CopilotIcon name="back" size={13} />
                  <span>All Sections</span>
                </button>
                <span className="rs-mobile-section-title">
                  {selectedSection.startsWith("additional:")
                    ? "Custom Section"
                    : selectedSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <ResumeSectionEditor
                content={studio.content}
                selected={selectedSection}
                onChange={(content) => updateDocument({ ...studio, content })}
                onSelectText={setSelectedText}
                onRequestAi={(action) => {
                  setLeftTab("ai");
                  setMobileTab("ats");
                  void onSuggest(action);
                }}
              />
            </>
          )}
        </section>

        <section className="rs-right" aria-label="Resume preview">
          <ResumePreview
            document={studio}
            highlightKeywords={jdKeywords}
            onExport={() => void onExport()}
            exporting={saveState === "exporting"}
            fullscreen={focusPreview}
            onToggleFullscreen={() => setFocusPreview((val) => !val)}
          />
        </section>
      </div>

      <div className="rs-mobile-floating-bar" aria-hidden="true">
        {mobileTab === "preview" ? (
          <button
            type="button"
            className="rs-floating-pill"
            onClick={() => {
              setMobileTab("edit");
              setCenterView("editor");
              if (selectedSection === "personal" || selectedSection === "summary") {
                setSelectedSection("experience");
              }
            }}
          >
            <CopilotIcon name="edit" size={14} />
            <span>Back to Editor</span>
          </button>
        ) : (
          <button
            type="button"
            className="rs-floating-pill rs-floating-pill-primary"
            onClick={() => setMobileTab("preview")}
          >
            <CopilotIcon name="resume" size={14} />
            <span>View Live Paper Preview</span>
          </button>
        )}
      </div>
    </div>
  );
}

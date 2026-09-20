import { Button, Textarea } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/select-field";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { atsFormatNotes } from "../model/ats-format";
import {
  FONT_OPTIONS,
  TEMPLATE_OPTIONS,
  type PresentationSettings,
  type ResumeContent,
  type StudioAtsContext,
  type StudioSuggestion,
  type SuggestAction,
} from "../model/resume-schema";

const ACTIONS: { id: SuggestAction; label: string; when: (section: string) => boolean }[] = [
  { id: "improve_summary", label: "Improve summary", when: (section) => section === "summary" },
  { id: "improve_bullet", label: "Improve bullet", when: (section) => section === "experience" || section === "projects" },
  { id: "make_concise", label: "Make more concise", when: () => true },
  { id: "make_achievement_oriented", label: "Make more achievement-oriented", when: (section) => section === "experience" || section === "projects" },
  { id: "improve_ats_relevance", label: "Improve ATS relevance", when: () => true },
  { id: "suggest_stronger_wording", label: "Suggest stronger wording", when: () => true },
  { id: "explain_recommendation", label: "Explain this recommendation", when: () => true },
  { id: "suggest_supported_skills", label: "Suggest supported skills", when: (section) => section === "skills" },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rs-field">
      <span className="rs-field-label">{label}</span>
      {children}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rs-field rs-range">
      <div className="rs-range-header">
        <span className="rs-field-label">{label}</span>
        <span className="rs-range-val">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function ResumeFormatPanel({
  presentation,
  content,
  onChange,
}: {
  presentation: PresentationSettings;
  content: ResumeContent;
  onChange: (next: PresentationSettings) => void;
}) {
  const notes = atsFormatNotes(presentation, content);
  const selectedTemplate = TEMPLATE_OPTIONS.find((item) => item.id === presentation.template);

  return (
    <div className="rs-format">
      <div className="rs-panel-header">
        <div>
          <p className="rs-kicker">Design & Typography</p>
          <h2 className="rs-panel-title">Document Styling</h2>
        </div>
      </div>

      <div className="rs-format-section">
        <span className="rs-format-section-title">Layout & Template</span>
        <Field label="Template Style">
          <Select
            aria-label="Template Style"
            value={presentation.template}
            onChange={(event) => onChange({ ...presentation, template: event.target.value as PresentationSettings["template"] })}
          >
            {TEMPLATE_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        {selectedTemplate?.note ? <p className="rs-hint rs-hint-sm">{selectedTemplate.note}</p> : null}

        <Field label="Page Paper Size">
          <Select
            aria-label="Page Paper Size"
            value={presentation.page_size}
            onChange={(event) => onChange({ ...presentation, page_size: event.target.value as PresentationSettings["page_size"] })}
          >
            <option value="a4">A4 (Standard 210 × 297 mm)</option>
            <option value="letter">US Letter (8.5 × 11 in)</option>
          </Select>
        </Field>
      </div>

      <div className="rs-format-section">
        <span className="rs-format-section-title">Typography</span>
        <Field label="Font Family">
          <Select
            aria-label="Font Family"
            value={presentation.font_family}
            onChange={(event) => onChange({ ...presentation, font_family: event.target.value as PresentationSettings["font_family"] })}
          >
            {FONT_OPTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="rs-grid-2col">
          <RangeField label="Body font size" value={presentation.font_size} min={9} max={12.5} step={0.5} unit="pt" onChange={(font_size) => onChange({ ...presentation, font_size })} />
          <RangeField label="Heading size" value={presentation.heading_size} min={10} max={16} step={0.5} unit="pt" onChange={(heading_size) => onChange({ ...presentation, heading_size })} />
        </div>

        <RangeField label="Line height" value={presentation.line_height} min={1.1} max={1.6} step={0.02} unit="×" onChange={(line_height) => onChange({ ...presentation, line_height })} />
      </div>

      <div className="rs-format-section">
        <span className="rs-format-section-title">Spacing & Margins</span>
        <div className="rs-grid-2col">
          <RangeField label="Section gap" value={presentation.section_spacing} min={4} max={28} step={1} unit="pt" onChange={(section_spacing) => onChange({ ...presentation, section_spacing })} />
          <RangeField label="Heading gap" value={presentation.heading_spacing} min={1} max={14} step={1} unit="pt" onChange={(heading_spacing) => onChange({ ...presentation, heading_spacing })} />
        </div>
        <RangeField label="Bullet spacing" value={presentation.bullet_spacing} min={0} max={10} step={1} unit="pt" onChange={(bullet_spacing) => onChange({ ...presentation, bullet_spacing })} />
        <div className="rs-grid-2col">
          <RangeField label="Page top/bottom" value={presentation.margin_top} min={10} max={28} step={1} unit="mm" onChange={(margin) => onChange({ ...presentation, margin_top: margin, margin_bottom: margin })} />
          <RangeField label="Page left/right" value={presentation.margin_left} min={10} max={28} step={1} unit="mm" onChange={(margin) => onChange({ ...presentation, margin_left: margin, margin_right: margin })} />
        </div>
      </div>

      <div className="rs-format-section">
        <span className="rs-format-section-title">Alignment & Accents</span>
        <div className="rs-grid-2col">
          <Field label="Header Alignment">
            <Select
              aria-label="Header Alignment"
              value={presentation.header_alignment}
              onChange={(event) => onChange({ ...presentation, header_alignment: event.target.value as PresentationSettings["header_alignment"] })}
            >
              <option value="left">Left Aligned</option>
              <option value="center">Centered</option>
              <option value="right">Right Aligned</option>
            </Select>
          </Field>
          <Field label="Heading Alignment">
            <Select
              aria-label="Heading Alignment"
              value={presentation.heading_alignment}
              onChange={(event) => onChange({ ...presentation, heading_alignment: event.target.value as PresentationSettings["heading_alignment"] })}
            >
              <option value="left">Left</option>
              <option value="center">Centered</option>
            </Select>
          </Field>
        </div>

        <Field label="Section Divider">
          <Select
            aria-label="Section Divider"
            value={presentation.divider}
            onChange={(event) => onChange({ ...presentation, divider: event.target.value as PresentationSettings["divider"] })}
          >
            <option value="line">Solid Line Rule</option>
            <option value="space">Clean Spacing Only</option>
            <option value="none">No Divider</option>
          </Select>
        </Field>

        <div className="rs-color-row">
          <Field label="Accent Color">
            <div className="rs-color-picker-wrap">
              <input
                type="color"
                className="rs-color-input"
                aria-label="Accent color"
                value={presentation.accent_color}
                onChange={(event) => onChange({ ...presentation, accent_color: event.target.value })}
              />
              <span className="rs-color-hex">{presentation.accent_color.toUpperCase()}</span>
            </div>
          </Field>
        </div>
      </div>

      <div className="rs-format-notes" aria-live="polite">
        {notes.map((note) => (
          <p key={note.message} data-tone={note.tone} className="rs-format-note-pill">
            <CopilotIcon name={note.tone === "caution" ? "warning" : "info"} size={14} />
            <span>{note.message}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function ResumeAtsPanel({
  ats,
  score,
  recalculating,
  onRecalculate,
}: {
  ats: StudioAtsContext | null;
  score: number | null;
  recalculating: boolean;
  onRecalculate: () => void;
}) {
  if (!ats) {
    return (
      <div className="rs-ats">
        <p className="rs-kicker">ATS improvement</p>
        <p className="rs-hint">Open Resume Studio from an ATS report to attach scoring evidence to this working resume.</p>
      </div>
    );
  }
  const summary = (ats.analysis.summary || {}) as {
    missing_terms?: string[];
    critical_missing?: string[];
    do_not_claim?: string[];
    disclaimer?: string;
  };
  const missing = ats.evidence.filter(
    (row) => row.match_status === "not_found" || row.match_status === "missing",
  );
  const matched = ats.evidence.filter(
    (row) => row.match_status === "matched" || row.match_status === "full_match",
  );
  const partial = ats.evidence.filter(
    (row) => row.match_status === "partial_match" || row.match_status === "partial",
  );
  return (
    <div className="rs-ats">
      <div className="rs-pane-head">
        <div>
          <p className="rs-kicker">ATS improvement</p>
          <p className="rs-score">{score == null ? "—" : `${Math.round(score)}%`}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onRecalculate} disabled={recalculating || !ats.job_description?.id}>
          {recalculating ? "Scoring…" : "Recalculate ATS"}
        </Button>
      </div>
      <p className="rs-hint">
        {summary.disclaimer || "This score is keyword coverage from the existing ATS engine, not a hiring prediction."}
      </p>
      {missing.length ? (
        <div className="rs-ats-section">
          <p className="rs-kicker">Missing Skills & Qualifications</p>
          <ul className="rs-issue-list">
            {missing.slice(0, 8).map((row) => (
              <li key={row.id || row.requirement_text} className="rs-ats-evidence-row rs-evidence-card">
                <div className="rs-evidence-header">
                  <span className="rs-badge-missing is-missing" data-status="missing">Missing</span>
                  <strong>{row.requirement_text}</strong>
                </div>
                <span>
                  {summary.do_not_claim?.some((item) =>
                    (row.requirement_text || "").toLowerCase().includes(String(item).toLowerCase()),
                  )
                    ? "Qualification gap — only add this if you can truthfully claim it."
                    : row.explanation || "Not detected in the current resume text. If you already have this experience, say so more clearly."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {matched.length ? (
        <div className="rs-ats-section">
          <p className="rs-kicker">Matched Skills & Qualifications</p>
          <ul className="rs-issue-list">
            {matched.slice(0, 8).map((row) => (
              <li key={row.id || row.requirement_text} className="rs-ats-evidence-row rs-evidence-card">
                <div className="rs-evidence-header">
                  <span className="rs-badge-match is-matched" data-status="matched">Matched</span>
                  <strong>{row.requirement_text}</strong>
                </div>
                <span>
                  {row.resume_evidence_text
                    ? `Verified experience: “${row.resume_evidence_text}”`
                    : row.explanation || "Verified match found in resume."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {partial.length ? (
        <div className="rs-ats-section">
          <p className="rs-kicker">Partial Alignment</p>
          <ul className="rs-issue-list">
            {partial.slice(0, 6).map((row) => (
              <li key={row.id || row.requirement_text} className="rs-ats-evidence-row rs-evidence-card">
                <div className="rs-evidence-header">
                  <span className="rs-badge-missing is-missing" data-status="missing">Partial</span>
                  <strong>{row.requirement_text}</strong>
                </div>
                <span>{row.resume_evidence_text ? `Current quote: “${row.resume_evidence_text}”` : row.explanation || "Partial match only."}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function ResumeAiAssistant({
  section,
  selectedText,
  suggestion,
  draft,
  busy,
  error,
  onDraft,
  onAction,
  onUse,
  onKeep,
}: {
  section: string;
  selectedText: string;
  suggestion: StudioSuggestion | null;
  draft: string;
  busy: boolean;
  error: string;
  onDraft: (value: string) => void;
  onAction: (action: SuggestAction) => void;
  onUse: () => void;
  onKeep: () => void;
}) {
  const actions = ACTIONS.filter((item) => item.when(section)).slice(0, 4);
  return (
    <div className="rs-ai rs-assistant rs-ai-panel">
      <p className="rs-kicker">Writing help</p>
      <p className="rs-hint">Suggestions stay grounded in your resume and ATS evidence. Nothing is applied until you accept it.</p>
      <div className="rs-ai-actions rs-action-chips">
        {actions.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="secondary"
            className="rs-suggest-btn"
            disabled={busy}
            onClick={() => onAction(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      {suggestion ? (
        <div className="rs-compare rs-suggestion rs-proposal">
          <p className="rs-kicker">Proposed Revision</p>
          <div>
            <p className="rs-kicker">Original</p>
            <p>{suggestion.original_text}</p>
          </div>
          <div>
            <p className="rs-kicker">Suggested</p>
            <Textarea value={draft} onChange={(event) => onDraft(event.target.value)} />
          </div>
          {suggestion.reason ? <p className="rs-hint">Reason: {suggestion.reason}</p> : <p className="rs-hint">Proposed change aligns with target requirements.</p>}
          {suggestion.addresses ? <p className="rs-hint">Addresses: {suggestion.addresses}</p> : null}
          {suggestion.requires_confirmation || suggestion.unsupported_claims.length ? (
            <p className="rs-warn" role="status">
              This suggestion includes details that were not found in your resume. Confirm they are true before using it.
              {suggestion.unsupported_claims.length ? ` (${suggestion.unsupported_claims.join(", ")})` : ""}
            </p>
          ) : null}
          {suggestion.needs_candidate_input && suggestion.missing_facts.length ? (
            <ul className="rs-issue-list">
              {suggestion.missing_facts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <div className="rs-ai-actions rs-action-chips">
            <Button type="button" onClick={onUse} disabled={!draft.trim()}>
              Use suggestion
            </Button>
            <Button type="button" variant="secondary" onClick={onKeep}>
              Keep original
            </Button>
          </div>
        </div>
      ) : (
        <p className="rs-hint">{selectedText.trim() ? "Select an action to propose a rewrite of the highlighted text." : "Select a summary, bullet, or section to get contextual help."}</p>
      )}
      {busy ? (
        <p className="rs-hint" role="status">
          <CopilotIcon name="loader" size={14} /> Preparing a grounded suggestion…
        </p>
      ) : null}
    </div>
  );
}

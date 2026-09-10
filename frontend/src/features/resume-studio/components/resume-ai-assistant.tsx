import { Button, Textarea } from "@/shared/ui/primitives";
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
      <span>
        {label} <b>{value}{unit}</b>
      </span>
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
  return (
    <div className="rs-format">
      <p className="rs-kicker">Formatting</p>
      <label className="rs-field">
        <span>Template</span>
        <select
          className="field"
          value={presentation.template}
          onChange={(event) => onChange({ ...presentation, template: event.target.value as PresentationSettings["template"] })}
        >
          {TEMPLATE_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p className="rs-hint">{TEMPLATE_OPTIONS.find((item) => item.id === presentation.template)?.note}</p>
      <label className="rs-field">
        <span>Page size</span>
        <select
          className="field"
          value={presentation.page_size}
          onChange={(event) => onChange({ ...presentation, page_size: event.target.value as PresentationSettings["page_size"] })}
        >
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
        </select>
      </label>
      <label className="rs-field">
        <span>Font</span>
        <select
          className="field"
          value={presentation.font_family}
          onChange={(event) => onChange({ ...presentation, font_family: event.target.value as PresentationSettings["font_family"] })}
        >
          {FONT_OPTIONS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <RangeField label="Body size" value={presentation.font_size} min={9} max={12.5} step={0.5} unit="pt" onChange={(font_size) => onChange({ ...presentation, font_size })} />
      <RangeField label="Heading size" value={presentation.heading_size} min={10} max={16} step={0.5} unit="pt" onChange={(heading_size) => onChange({ ...presentation, heading_size })} />
      <RangeField label="Line height" value={presentation.line_height} min={1.1} max={1.6} step={0.02} unit="" onChange={(line_height) => onChange({ ...presentation, line_height })} />
      <RangeField label="Section spacing" value={presentation.section_spacing} min={4} max={28} step={1} unit="pt" onChange={(section_spacing) => onChange({ ...presentation, section_spacing })} />
      <RangeField label="Heading spacing" value={presentation.heading_spacing} min={1} max={14} step={1} unit="pt" onChange={(heading_spacing) => onChange({ ...presentation, heading_spacing })} />
      <RangeField label="Bullet spacing" value={presentation.bullet_spacing} min={0} max={10} step={1} unit="pt" onChange={(bullet_spacing) => onChange({ ...presentation, bullet_spacing })} />
      <RangeField label="Top/bottom margin" value={presentation.margin_top} min={10} max={28} step={1} unit="mm" onChange={(margin) => onChange({ ...presentation, margin_top: margin, margin_bottom: margin })} />
      <RangeField label="Side margin" value={presentation.margin_left} min={10} max={28} step={1} unit="mm" onChange={(margin) => onChange({ ...presentation, margin_left: margin, margin_right: margin })} />
      <label className="rs-field">
        <span>Header alignment</span>
        <select
          className="field"
          value={presentation.header_alignment}
          onChange={(event) => onChange({ ...presentation, header_alignment: event.target.value as PresentationSettings["header_alignment"] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
      <label className="rs-field">
        <span>Heading alignment</span>
        <select
          className="field"
          value={presentation.heading_alignment}
          onChange={(event) => onChange({ ...presentation, heading_alignment: event.target.value as PresentationSettings["heading_alignment"] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>
      </label>
      <label className="rs-field">
        <span>Accent color</span>
        <input
          type="color"
          aria-label="Accent color"
          value={presentation.accent_color}
          onChange={(event) => onChange({ ...presentation, accent_color: event.target.value })}
        />
      </label>
      <label className="rs-field">
        <span>Section divider</span>
        <select
          className="field"
          value={presentation.divider}
          onChange={(event) => onChange({ ...presentation, divider: event.target.value as PresentationSettings["divider"] })}
        >
          <option value="line">Line</option>
          <option value="space">Space</option>
          <option value="none">None</option>
        </select>
      </label>
      <div className="rs-format-notes" aria-live="polite">
        {notes.map((note) => (
          <p key={note.message} data-tone={note.tone}>
            {note.message}
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
  const missing = ats.evidence.filter((row) => row.match_status === "not_found");
  const partial = ats.evidence.filter((row) => row.match_status === "partial_match");
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
        <div>
          <p className="rs-kicker">Not found in this resume</p>
          <ul className="rs-issue-list">
            {missing.slice(0, 8).map((row) => (
              <li key={row.id || row.requirement_text}>
                <strong>{row.requirement_text}</strong>
                <span>
                  {summary.do_not_claim?.some((item) =>
                    (row.requirement_text || "").toLowerCase().includes(String(item).toLowerCase()),
                  )
                    ? "Qualification gap — only add this if you can truthfully claim it."
                    : "Not detected in the current resume text. If you already have this experience, say so more clearly."}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {partial.length ? (
        <div>
          <p className="rs-kicker">Weak evidence</p>
          <ul className="rs-issue-list">
            {partial.slice(0, 6).map((row) => (
              <li key={row.id || row.requirement_text}>
                <strong>{row.requirement_text}</strong>
                <span>{row.resume_evidence_text ? `Current quote: “${row.resume_evidence_text}”` : "Partial match only."}</span>
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
    <div className="rs-ai">
      <p className="rs-kicker">Writing help</p>
      <p className="rs-hint">Suggestions stay grounded in your resume and ATS evidence. Nothing is applied until you accept it.</p>
      <div className="rs-ai-actions">
        {actions.map((item) => (
          <Button key={item.id} type="button" variant="secondary" disabled={busy || !selectedText.trim()} onClick={() => onAction(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      {suggestion ? (
        <div className="rs-compare">
          <div>
            <p className="rs-kicker">Original</p>
            <p>{suggestion.original_text}</p>
          </div>
          <div>
            <p className="rs-kicker">Suggested</p>
            <Textarea value={draft} onChange={(event) => onDraft(event.target.value)} />
          </div>
          {suggestion.reason ? <p className="rs-hint">{suggestion.reason}</p> : null}
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
          <div className="rs-ai-actions">
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

import { useMemo } from "react";
import { Button } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/select-field";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  calculateMatchStats,
  extractKeywords,
} from "../model/keyword-matcher";
import type { StudioDocument, SuggestAction } from "../model/resume-schema";

export type TailoringDepth = "nudge" | "keywords" | "full";

export interface ResumeJdComparisonProps {
  document: StudioDocument;
  targetJdText: string;
  onJdTextChange: (text: string) => void;
  tailoringDepth: TailoringDepth;
  onTailoringDepthChange: (depth: TailoringDepth) => void;
  onSwitchToEditor?: () => void;
  onRequestAi?: (action: SuggestAction) => void;
  atsScore?: number | null;
}

/**
 * Aggregates all searchable text from a StudioDocument for keyword matching.
 */
function extractResumeFullText(document: StudioDocument): string {
  const content = document.content;
  const parts: string[] = [];

  if (content.personal?.name) parts.push(content.personal.name);
  if (content.summary) parts.push(content.summary);

  if (content.skill_groups) {
    for (const group of content.skill_groups) {
      if (group.name) parts.push(group.name);
      for (const item of group.items) {
        if (item.name) parts.push(item.name);
      }
    }
  }

  if (content.experience) {
    for (const exp of content.experience) {
      if (exp.employer) parts.push(exp.employer);
      if (exp.title) parts.push(exp.title);
      for (const bullet of exp.bullets) {
        if (bullet.text) parts.push(bullet.text);
      }
    }
  }

  if (content.projects) {
    for (const proj of content.projects) {
      if (proj.name) parts.push(proj.name);
      if (proj.description) parts.push(proj.description);
      if (proj.technologies) parts.push(proj.technologies.join(" "));
      for (const bullet of proj.bullets) {
        if (bullet.text) parts.push(bullet.text);
      }
    }
  }

  if (content.education) {
    for (const edu of content.education) {
      if (edu.institution) parts.push(edu.institution);
      if (edu.degree) parts.push(edu.degree);
      if (edu.specialization) parts.push(edu.specialization);
      if (edu.details) parts.push(edu.details);
    }
  }

  if (content.certifications) {
    for (const cert of content.certifications) {
      if (cert.name) parts.push(cert.name);
      if (cert.issuer) parts.push(cert.issuer);
    }
  }

  if (content.achievements) {
    for (const ach of content.achievements) {
      if (ach.text) parts.push(ach.text);
    }
  }

  if (content.languages) {
    for (const lang of content.languages) {
      if (lang.language) parts.push(lang.language);
    }
  }

  if (content.additional) {
    for (const sec of content.additional) {
      if (sec.title) parts.push(sec.title);
      for (const entry of sec.entries) {
        if (entry.text) parts.push(entry.text);
      }
    }
  }

  return parts.join(" ");
}

export function ResumeJdComparison({
  document,
  targetJdText,
  onJdTextChange,
  tailoringDepth,
  onTailoringDepthChange,
  onSwitchToEditor,
  onRequestAi,
}: ResumeJdComparisonProps) {
  const resumeText = useMemo(() => extractResumeFullText(document), [document]);
  const jdKeywords = useMemo(() => extractKeywords(targetJdText), [targetJdText]);
  const stats = useMemo(
    () => calculateMatchStats(resumeText, jdKeywords),
    [resumeText, jdKeywords],
  );

  const matchToneClass =
    stats.matchPercentage >= 50
      ? "is-matched match-high"
      : stats.matchPercentage >= 30
      ? "is-warning match-medium"
      : "is-missing match-low";

  const depthDescriptions: Record<TailoringDepth, string> = {
    nudge: "Light nudge: Minimal edits to better align existing experience.",
    keywords: "Keyword enhance: Blend in relevant keywords without changing role or scope.",
    full: "Full tailor: Comprehensive tailoring using the job description.",
  };

  return (
    <div className="rs-jd-comparison" data-testid="jd-comparison-view">
      {/* Top Stats Bar */}
      <div className="rs-jd-stats" data-testid="jd-stats-bar">
        <div className="rs-jd-stats-group">
          <span className="rs-stat-badge" title="Total unique keywords extracted from JD">
            <CopilotIcon name="chart" size={13} />
            <span>{stats.totalKeywords} keywords extracted</span>
          </span>
          <span className="rs-stat-badge" title="Keywords matched in your resume">
            <CopilotIcon name="check" size={13} />
            <span>{stats.matchedCount} matches found</span>
          </span>
        </div>
        <div className="rs-jd-stats-rate">
          <span
            className={`rs-match-badge rs-badge-match ${matchToneClass}`}
            data-testid="match-percentage"
          >
            {stats.matchPercentage}% Match
          </span>
        </div>
      </div>

      {/* Main Two-Column Body */}
      <div className="rs-jd-grid">
        {/* Left Column: Job Description Input & Formatted Viewer */}
        <div className="rs-jd-pane">
          <div className="rs-jd-pane-header">
            <div className="rs-jd-title-row">
              <p className="rs-kicker">Target Role</p>
              <h3 className="rs-jd-heading">Job Description</h3>
            </div>
            {targetJdText.trim() ? (
              <span className="rs-char-count">{targetJdText.length} chars</span>
            ) : null}
          </div>

          <div className="rs-jd-input-wrapper">
            <textarea
              className="rs-jd-input"
              data-testid="jd-raw-text"
              placeholder="Paste target job description here to analyze keyword match..."
              value={targetJdText}
              onChange={(e) => onJdTextChange(e.target.value)}
              rows={4}
              aria-label="Job description raw text input"
            />
          </div>

          {targetJdText.trim() ? (
            <div className="rs-jd-preview-scroll" tabIndex={0} aria-label="Job description preview">
              <div className="rs-jd-content whitespace-pre-wrap">{targetJdText}</div>
            </div>
          ) : (
            <div className="rs-jd-empty-guidance" role="region" aria-label="Empty JD guidance">
              <CopilotIcon name="info" size={16} />
              <p>
                No job description provided yet. Paste a job description above to see live keyword
                gap analysis, matched terms, and tailored suggestions.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Gap Analysis & Tailoring Controls */}
        <div className="rs-gap-pane">
          <div className="rs-gap-pane-header">
            <p className="rs-kicker">ATS Gap Analysis</p>
            <h3 className="rs-gap-heading">Keyword Breakdown & Tailoring</h3>
          </div>

          {/* Matched Keywords Section */}
          <div className="rs-gap-section">
            <div className="rs-gap-section-title-row">
              <h4 className="rs-gap-subheading">Matched Skills & Keywords</h4>
              <span className="rs-count-pill rs-count-matched">{stats.matchedKeywords.length}</span>
            </div>
            {stats.matchedKeywords.length > 0 ? (
              <div className="rs-chip-container">
                {stats.matchedKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="rs-chip-matched is-matched rs-badge-match"
                    data-status="matched"
                    data-testid="matched-chip"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rs-hint">No matching keywords found yet.</p>
            )}
          </div>

          {/* Missing Keywords Section */}
          <div className="rs-gap-section">
            <div className="rs-gap-section-title-row">
              <h4 className="rs-gap-subheading">Missing Skills & Keywords</h4>
              <span className="rs-count-pill rs-count-missing">{stats.missingKeywords.length}</span>
            </div>
            {stats.missingKeywords.length > 0 ? (
              <div className="rs-chip-container">
                {stats.missingKeywords.map((kw) => (
                  <button
                    type="button"
                    key={kw}
                    className="rs-chip-missing is-missing rs-badge-missing"
                    data-status="missing"
                    data-testid="missing-chip"
                    onClick={() => onRequestAi?.("improve_ats_relevance")}
                    title={`Click to tailor resume for missing keyword: ${kw}`}
                  >
                    + {kw}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rs-hint">All extracted keywords are covered in your resume!</p>
            )}
          </div>

          {/* Tailoring Depth Section */}
          <div className="rs-gap-section rs-tailoring-controls">
            <h4 className="rs-gap-subheading">Tailoring Depth</h4>
            <div data-testid="tailoring-depth-select" className="rs-tailoring-select">
              <Select
                aria-label="Tailoring Depth"
                value={tailoringDepth}
                onChange={(e) => onTailoringDepthChange(e.target.value as TailoringDepth)}
              >
                <option value="nudge">Light nudge</option>
                <option value="keywords">Keyword enhance</option>
                <option value="full">Full tailor</option>
              </Select>
            </div>
            <p className="rs-hint rs-depth-desc">{depthDescriptions[tailoringDepth]}</p>
          </div>

          {/* Action Triggers */}
          <div className="rs-action-chips">
            <Button
              type="button"
              variant="primary"
              className="rs-suggest-btn"
              onClick={() => onRequestAi?.("improve_ats_relevance")}
            >
              <CopilotIcon name="assist" size={14} />
              <span>Tailor Resume with Keywords</span>
            </Button>
            {onSwitchToEditor ? (
              <Button type="button" variant="secondary" onClick={onSwitchToEditor}>
                <span>Open Section Editor</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

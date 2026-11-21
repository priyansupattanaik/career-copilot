import { useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Surface } from "@/shared/ui/workbench";
import { DEGREE_OPTIONS, FIELD_OF_STUDY_OPTIONS } from "@/features/profile/model/profile-options";
import type { CandidateExperience, CandidateEducation } from "./types";

interface BackgroundSectionProps {
  experiences: CandidateExperience[];
  onAddExperience: (exp: CandidateExperience) => Promise<void>;
  onUpdateExperience: (id: string, exp: Partial<CandidateExperience>) => Promise<void>;
  onDeleteExperience: (id: string) => Promise<void>;
  education: CandidateEducation[];
  onAddEducation: (edu: CandidateEducation) => Promise<void>;
  onUpdateEducation: (id: string, edu: Partial<CandidateEducation>) => Promise<void>;
  onDeleteEducation: (id: string) => Promise<void>;
}

function formatMonthYear(dateStr?: string | null): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    if (month >= 1 && month <= 12) {
      return `${months[month - 1]} ${year}`;
    }
  }
  return dateStr;
}

export function BackgroundSection({
  experiences,
  onAddExperience,
  onUpdateExperience,
  onDeleteExperience,
  education,
  onAddEducation,
  onUpdateEducation,
  onDeleteEducation,
}: BackgroundSectionProps) {
  // Experience modal states
  const [showExpModal, setShowExpModal] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [expDraft, setExpDraft] = useState<CandidateExperience>({
    company_name: "",
    role_title: "",
    employment_type: "Full-time",
    start_date: "",
    end_date: "",
    is_current: false,
    summary: "",
  });
  const [expError, setExpError] = useState("");
  const [deleteExpId, setDeleteExpId] = useState<string | null>(null);
  const [expandedExpIds, setExpandedExpIds] = useState<Record<string, boolean>>({});

  // Education modal states
  const [showEduModal, setShowEduModal] = useState(false);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [eduDraft, setEduDraft] = useState<CandidateEducation>({
    institution: "",
    degree: "",
    field_of_study: "",
    start_year: "",
    end_year: "",
    grade_text: "",
  });
  const [eduError, setEduError] = useState("");
  const [deleteEduId, setDeleteEduId] = useState<string | null>(null);

  // Experience handlers
  function openAddExp() {
    setExpDraft({
      company_name: "",
      role_title: "",
      employment_type: "Full-time",
      start_date: "",
      end_date: "",
      is_current: false,
      summary: "",
    });
    setEditingExpId(null);
    setExpError("");
    setShowExpModal(true);
  }

  function openEditExp(item: CandidateExperience) {
    setExpDraft({ ...item });
    setEditingExpId(item.id || null);
    setExpError("");
    setShowExpModal(true);
  }

  async function handleSaveExp() {
    if (!expDraft.company_name.trim()) {
      setExpError("Company name is required.");
      return;
    }
    if (!expDraft.role_title.trim()) {
      setExpError("Role title is required.");
      return;
    }
    setExpError("");
    if (editingExpId) {
      await onUpdateExperience(editingExpId, expDraft);
    } else {
      await onAddExperience(expDraft);
    }
    setShowExpModal(false);
  }

  // Education handlers
  function openAddEdu() {
    setEduDraft({
      institution: "",
      degree: "",
      field_of_study: "",
      start_year: "",
      end_year: "",
      grade_text: "",
    });
    setEditingEduId(null);
    setEduError("");
    setShowEduModal(true);
  }

  function openEditEdu(item: CandidateEducation) {
    setEduDraft({ ...item });
    setEditingEduId(item.id || null);
    setEduError("");
    setShowEduModal(true);
  }

  async function handleSaveEdu() {
    if (!eduDraft.institution.trim()) {
      setEduError("Institution name is required.");
      return;
    }
    setEduError("");
    if (editingEduId) {
      await onUpdateEducation(editingEduId, eduDraft);
    } else {
      await onAddEducation(eduDraft);
    }
    setShowEduModal(false);
  }

  function toggleSummaryExpand(id: string) {
    setExpandedExpIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-sans)",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 600,
    color: "var(--ink-2)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    padding: "0 12px",
    borderRadius: "var(--radius-md, 8px)",
    border: "1px solid var(--border-control)",
    backgroundColor: "var(--surface-2)",
    color: "var(--ink)",
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    outline: "none",
  };

  return (
    <Surface
      id="section-background"
      className="profile-background-section settings-card"
      style={{
        padding: "24px var(--settings-pad, 28px)",
        borderRadius: "var(--settings-radius, 20px)",
        background: "var(--app-panel, var(--surface))",
        border: "1px solid var(--app-line, var(--border))",
        boxShadow: "var(--app-shadow-soft, var(--shadow-sm))",
        boxSizing: "border-box",
      }}
    >
      {/* Section Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 18,
            lineHeight: "28px",
            fontWeight: 600,
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Experience & education
        </h2>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            lineHeight: "22px",
            color: "var(--ink-2)",
            margin: "4px 0 0 0",
          }}
        >
          Your career trajectory and academic achievements. We use these milestones to evaluate qualifications and role seniority.
        </p>
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: "var(--radius-md, 8px)",
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            lineHeight: "18px",
            color: "var(--ink-2)",
          }}
        >
          Add at least one experience, or set years of experience to 0 for fresher credit.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {/* ================= WORK EXPERIENCE ================= */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 12,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-2)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Experience ({experiences.length})
            </h3>
            <button
              type="button"
              onClick={openAddExp}
              className="wb-button wb-button-ghost"
              style={{ height: 40 }}
            >
              <CopilotIcon name="plus" size={14} />
              <span>Add experience</span>
            </button>
          </div>

          {experiences.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px 0" }}>
                No experience added yet.
              </p>
              <button
                type="button"
                onClick={openAddExp}
                className="wb-button wb-button-secondary"
                style={{ height: 36 }}
              >
                <CopilotIcon name="plus" size={14} />
                <span>Add experience</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {experiences.map((exp, idx) => {
                const id = exp.id || String(idx);
                const isExpanded = Boolean(expandedExpIds[id]);
                const startDateStr = formatMonthYear(exp.start_date);
                const endDateStr = exp.is_current ? "Present" : formatMonthYear(exp.end_date);
                const dateDisplay = startDateStr
                  ? `${startDateStr} – ${endDateStr || "Present"}`
                  : exp.is_current ? "Aug 2024 – Present" : "";

                return (
                  <div
                    key={id}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-md, 8px)",
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <h4
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: 14,
                              lineHeight: "20px",
                              fontWeight: 600,
                              color: "var(--ink)",
                              margin: 0,
                            }}
                          >
                            {exp.role_title} · {exp.company_name}
                          </h4>
                          {exp.employment_type && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                height: 20,
                                padding: "0 6px",
                                borderRadius: "var(--radius-sm, 4px)",
                                backgroundColor: "var(--surface-3)",
                                color: "var(--ink-2)",
                                fontFamily: "var(--font-sans)",
                                fontSize: 10,
                                fontWeight: 500,
                              }}
                            >
                              {exp.employment_type}
                            </span>
                          )}
                          {exp.is_current && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                height: 20,
                                padding: "0 6px",
                                borderRadius: "var(--radius-sm, 4px)",
                                backgroundColor: "var(--accent-soft)",
                                color: "var(--accent)",
                                fontFamily: "var(--font-sans)",
                                fontSize: 10,
                                fontWeight: 600,
                              }}
                            >
                              Present
                            </span>
                          )}
                        </div>
                        {dateDisplay && (
                          <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", margin: "4px 0 0 0" }}>
                            {dateDisplay}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openEditExp(exp)}
                          className="wb-button wb-button-ghost"
                          style={{ width: 40, height: 40, padding: 0 }}
                          title="Edit"
                        >
                          <CopilotIcon name="edit" size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteExpId(id)}
                          className="wb-button wb-button-ghost"
                          style={{ width: 40, height: 40, padding: 0, color: "var(--danger)" }}
                          title="Remove"
                        >
                          <CopilotIcon name="trash" size={14} />
                        </button>
                      </div>
                    </div>

                    {exp.summary && (
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 13,
                            lineHeight: "20px",
                            color: "var(--ink-2)",
                            margin: 0,
                            display: isExpanded ? "block" : "-webkit-box",
                            WebkitLineClamp: isExpanded ? undefined : 3,
                            WebkitBoxOrient: isExpanded ? undefined : "vertical",
                            overflow: isExpanded ? "visible" : "hidden",
                          }}
                        >
                          {exp.summary}
                        </p>
                        {exp.summary.length > 180 && (
                          <button
                            type="button"
                            onClick={() => toggleSummaryExpand(id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              color: "var(--accent)",
                              fontFamily: "var(--font-sans)",
                              fontSize: 11,
                              fontWeight: 500,
                              cursor: "pointer",
                              marginTop: 4,
                            }}
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ================= EDUCATION ================= */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 12,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink-2)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                margin: 0,
              }}
            >
              Education ({education.length})
            </h3>
            <button
              type="button"
              onClick={openAddEdu}
              className="wb-button wb-button-ghost"
              style={{ height: 40 }}
            >
              <CopilotIcon name="plus" size={14} />
              <span>Add education</span>
            </button>
          </div>

          {education.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px" }}>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", margin: "0 0 12px 0" }}>
                No education added yet.
              </p>
              <button
                type="button"
                onClick={openAddEdu}
                className="wb-button wb-button-secondary"
                style={{ height: 36 }}
              >
                <CopilotIcon name="plus" size={14} />
                <span>Add education</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              {education.map((edu, idx) => {
                const id = edu.id || String(idx);
                const titleStr = [edu.degree, edu.field_of_study].filter(Boolean).join(" · ");
                const dates = [edu.start_year, edu.end_year].filter(Boolean).join(" – ");

                return (
                  <div
                    key={id}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-md, 8px)",
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          lineHeight: "20px",
                          fontWeight: 600,
                          color: "var(--ink)",
                          margin: 0,
                        }}
                      >
                        {titleStr || "Education"} with {edu.institution}
                      </h4>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                        {dates && (
                          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)" }}>
                            {dates}
                          </span>
                        )}
                        {edu.grade_text && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              height: 20,
                              padding: "0 6px",
                              borderRadius: "var(--radius-sm, 4px)",
                              backgroundColor: "var(--surface-3)",
                              color: "var(--ink-2)",
                              fontFamily: "var(--font-sans)",
                              fontSize: 10,
                            }}
                          >
                            {edu.grade_text}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEditEdu(edu)}
                        className="wb-button wb-button-ghost"
                        style={{ width: 40, height: 40, padding: 0 }}
                        title="Edit"
                      >
                        <CopilotIcon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteEduId(id)}
                        className="wb-button wb-button-ghost"
                        style={{ width: 40, height: 40, padding: 0, color: "var(--danger)" }}
                        title="Remove"
                      >
                        <CopilotIcon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Experience Add/Edit Modal */}
      {showExpModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="exp-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <h4
                id="exp-dialog-title"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {editingExpId ? "Edit experience" : "Add experience"}
              </h4>
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-3)",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Company name *</label>
                <input
                  type="text"
                  value={expDraft.company_name}
                  onChange={(e) => setExpDraft({ ...expDraft, company_name: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Role title *</label>
                <input
                  type="text"
                  value={expDraft.role_title}
                  onChange={(e) => setExpDraft({ ...expDraft, role_title: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Employment type</label>
                  <select
                    value={expDraft.employment_type || "Full-time"}
                    onChange={(e) => setExpDraft({ ...expDraft, employment_type: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                    <option value="Freelance">Freelance</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input
                    type="month"
                    value={expDraft.start_date || ""}
                    onChange={(e) => setExpDraft({ ...expDraft, start_date: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
                <input
                  id="exp-is-current"
                  type="checkbox"
                  checked={Boolean(expDraft.is_current)}
                  onChange={(e) => setExpDraft({ ...expDraft, is_current: e.target.checked })}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
                />
                <label htmlFor="exp-is-current" style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink)", cursor: "pointer" }}>
                  I currently work here
                </label>
              </div>

              {!expDraft.is_current && (
                <div>
                  <label style={labelStyle}>End Date</label>
                  <input
                    type="month"
                    value={expDraft.end_date || ""}
                    onChange={(e) => setExpDraft({ ...expDraft, end_date: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Summary / Responsibilities</label>
                <textarea
                  rows={3}
                  value={expDraft.summary || ""}
                  onChange={(e) => setExpDraft({ ...expDraft, summary: e.target.value })}
                  placeholder="Key accomplishments, impact, tech stack..."
                  style={{ ...inputStyle, height: "auto", padding: "10px 12px", resize: "none" }}
                />
              </div>

              {expError && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--danger)", margin: 0 }}>
                  {expError}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="wb-button wb-button-ghost"
                style={{ height: 40 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExp}
                className="wb-button wb-button-primary"
                style={{ height: 40 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Experience Confirmation Dialog */}
      {deleteExpId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 384,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <h4 style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              Remove this entry?
            </h4>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
              Are you sure you want to remove this experience entry? This cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteExpId(null)}
                className="wb-button wb-button-ghost"
                style={{ height: 36 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteExpId;
                  setDeleteExpId(null);
                  await onDeleteExperience(target);
                }}
                className="wb-button"
                style={{ height: 36, backgroundColor: "var(--danger)", color: "#000", fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Education Add/Edit Modal */}
      {showEduModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edu-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <h4
                id="edu-dialog-title"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {editingEduId ? "Edit education" : "Add education"}
              </h4>
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-3)",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Institution *</label>
                <input
                  type="text"
                  value={eduDraft.institution}
                  onChange={(e) => setEduDraft({ ...eduDraft, institution: e.target.value })}
                  placeholder="e.g. Stanford University"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Degree</label>
                  <input
                    list="degree-catalog"
                    type="text"
                    value={eduDraft.degree || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, degree: e.target.value })}
                    placeholder="e.g. B.Tech"
                    style={inputStyle}
                  />
                  <datalist id="degree-catalog">
                    {DEGREE_OPTIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={labelStyle}>Field of Study</label>
                  <input
                    list="field-catalog"
                    type="text"
                    value={eduDraft.field_of_study || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, field_of_study: e.target.value })}
                    placeholder="e.g. Computer Science"
                    style={inputStyle}
                  />
                  <datalist id="field-catalog">
                    {FIELD_OF_STUDY_OPTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Year</label>
                  <input
                    type="text"
                    value={eduDraft.start_year || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, start_year: e.target.value })}
                    placeholder="e.g. 2020"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>End Year</label>
                  <input
                    type="text"
                    value={eduDraft.end_year || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, end_year: e.target.value })}
                    placeholder="e.g. 2024"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Grade / GPA (Optional)</label>
                <input
                  type="text"
                  value={eduDraft.grade_text || ""}
                  onChange={(e) => setEduDraft({ ...eduDraft, grade_text: e.target.value })}
                  placeholder="e.g. 3.8 GPA or 85%"
                  style={inputStyle}
                />
              </div>

              {eduError && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--danger)", margin: 0 }}>
                  {eduError}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="wb-button wb-button-ghost"
                style={{ height: 40 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdu}
                className="wb-button wb-button-primary"
                style={{ height: 40 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Education Confirmation Dialog */}
      {deleteEduId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 384,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <h4 style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
              Remove this entry?
            </h4>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-2)", margin: 0 }}>
              Are you sure you want to remove this education entry? This cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeleteEduId(null)}
                className="wb-button wb-button-ghost"
                style={{ height: 36 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteEduId;
                  setDeleteEduId(null);
                  await onDeleteEducation(target);
                }}
                className="wb-button"
                style={{ height: 36, backgroundColor: "var(--danger)", color: "#000", fontWeight: 600 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}

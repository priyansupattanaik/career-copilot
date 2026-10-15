import { useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
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

export function formatMonthYear(dateStr?: string | null): string {
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
    if (!expDraft.company_name.trim() || !expDraft.role_title.trim()) {
      setExpError("Company name and role title are required.");
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

  return (
    <section
      id="section-background"
      className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-neutral-900"
    >
      {/* Left Column: Heading & Explanation */}
      <div className="lg:col-span-4">
        <h2 className="text-xl font-medium text-white tracking-tight">
          Experience & education
        </h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          Your career trajectory and academic achievements. We use these milestones to
          evaluate qualifications and role seniority.
        </p>
        <p className="text-xs text-neutral-400 mt-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-850">
          Add at least one experience, or set years of experience to 0 for fresher credit.
        </p>
      </div>

      {/* Right Column: Surface */}
      <div className="lg:col-span-8 bg-[#0A0A0A] border border-neutral-850 rounded-2xl p-6 sm:p-8 space-y-8">
        {/* ================= WORK EXPERIENCE ================= */}
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
                Experience
              </h3>
            </div>
            <button
              type="button"
              onClick={openAddExp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 hover:border-neutral-700 transition-colors"
            >
              <CopilotIcon name="plus" className="w-3.5 h-3.5" />
              <span>Add experience</span>
            </button>
          </div>

          {experiences.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-neutral-500 text-xs">No experience added yet.</p>
              <button
                type="button"
                onClick={openAddExp}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-neutral-200 border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <CopilotIcon name="plus" className="w-3 h-3" />
                <span>Add experience</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
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
                    className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-850 hover:border-neutral-800 transition-all space-y-2.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white">
                            {exp.role_title} · {exp.company_name}
                          </h4>
                          {exp.employment_type && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-300">
                              {exp.employment_type}
                            </span>
                          )}
                          {exp.is_current && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Present
                            </span>
                          )}
                        </div>
                        {dateDisplay && (
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {dateDisplay}
                          </p>
                        )}
                      </div>

                      {/* Action buttons: Edit and Remove */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditExp(exp)}
                          className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition-colors"
                          title="Edit"
                        >
                          <CopilotIcon name="edit" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteExpId(id)}
                          className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 text-xs transition-colors"
                          title="Remove"
                        >
                          <CopilotIcon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Summary clamped to 3 lines */}
                    {exp.summary && (
                      <div>
                        <p
                          className={`text-xs text-neutral-300 leading-relaxed font-sans ${
                            isExpanded ? "" : "line-clamp-3"
                          }`}
                        >
                          {exp.summary}
                        </p>
                        {exp.summary.length > 180 && (
                          <button
                            type="button"
                            onClick={() => toggleSummaryExpand(id)}
                            className="text-[11px] text-cyan-400 hover:text-cyan-300 mt-1 font-medium block"
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
          <div className="flex items-center justify-between pb-3 border-b border-neutral-850">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase">
                Education
              </h3>
            </div>
            <button
              type="button"
              onClick={openAddEdu}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 hover:border-neutral-700 transition-colors"
            >
              <CopilotIcon name="plus" className="w-3.5 h-3.5" />
              <span>Add education</span>
            </button>
          </div>

          {education.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-neutral-500 text-xs">No education added yet.</p>
              <button
                type="button"
                onClick={openAddEdu}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-neutral-200 border border-neutral-800 hover:border-neutral-700 transition-colors"
              >
                <CopilotIcon name="plus" className="w-3 h-3" />
                <span>Add education</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {education.map((edu, idx) => {
                const id = edu.id || String(idx);
                const titleStr = [edu.degree, edu.field_of_study].filter(Boolean).join(" · ");
                const dates = [edu.start_year, edu.end_year].filter(Boolean).join(" – ");

                return (
                  <div
                    key={id}
                    className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-850 hover:border-neutral-800 transition-all space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {titleStr || "Education"} with {edu.institution}
                        </h4>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400">
                          {dates && <span>{dates}</span>}
                          {edu.grade_text && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-neutral-800 text-neutral-300">
                              {edu.grade_text}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons: Edit and Remove */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditEdu(edu)}
                          className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition-colors"
                          title="Edit"
                        >
                          <CopilotIcon name="edit" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteEduId(id)}
                          className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 text-xs transition-colors"
                          title="Remove"
                        >
                          <CopilotIcon name="trash" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* Experience Add/Edit Dialog */}
      {showExpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-sm font-semibold text-white">
                {editingExpId ? "Edit experience" : "Add experience"}
              </h4>
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Company name *
                </label>
                <input
                  type="text"
                  value={expDraft.company_name}
                  onChange={(e) => setExpDraft({ ...expDraft, company_name: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Role title *
                </label>
                <input
                  type="text"
                  value={expDraft.role_title}
                  onChange={(e) => setExpDraft({ ...expDraft, role_title: e.target.value })}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Employment type
                </label>
                <select
                  value={expDraft.employment_type || "Full-time"}
                  onChange={(e) => setExpDraft({ ...expDraft, employment_type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                  <option value="Freelance">Freelance</option>
                </select>
              </div>

              {/* Month inputs for dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    Start date (Month)
                  </label>
                  <input
                    type="month"
                    value={expDraft.start_date || ""}
                    onChange={(e) => setExpDraft({ ...expDraft, start_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    End date (Month)
                  </label>
                  <input
                    type="month"
                    disabled={Boolean(expDraft.is_current)}
                    value={expDraft.is_current ? "" : expDraft.end_date || ""}
                    onChange={(e) => setExpDraft({ ...expDraft, end_date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="currently-working"
                  checked={Boolean(expDraft.is_current)}
                  onChange={(e) =>
                    setExpDraft({
                      ...expDraft,
                      is_current: e.target.checked,
                      end_date: e.target.checked ? null : expDraft.end_date,
                    })
                  }
                  className="rounded border-neutral-800 bg-neutral-950 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="currently-working" className="text-neutral-300 cursor-pointer select-none">
                  Currently working here
                </label>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Summary / Key Achievements
                </label>
                <textarea
                  rows={3}
                  maxLength={800}
                  value={expDraft.summary || ""}
                  onChange={(e) => setExpDraft({ ...expDraft, summary: e.target.value })}
                  placeholder="Describe your scope of impact, key systems built, or measurable outcomes..."
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60 resize-none leading-relaxed"
                />
              </div>

              {expError && <p className="text-xs text-rose-400">{expError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowExpModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExp}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-neutral-200 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Experience Confirmation Dialog */}
      {deleteExpId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white">
              Remove this entry?
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to remove this experience entry? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteExpId(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white bg-neutral-900"
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
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Education Add/Edit Dialog */}
      {showEduModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-sm font-semibold text-white">
                {editingEduId ? "Edit education" : "Add education"}
              </h4>
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Institution *
                </label>
                <input
                  type="text"
                  value={eduDraft.institution}
                  onChange={(e) => setEduDraft({ ...eduDraft, institution: e.target.value })}
                  placeholder="e.g. Stanford University"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    Degree
                  </label>
                  <input
                    list="degree-catalog"
                    type="text"
                    value={eduDraft.degree || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, degree: e.target.value })}
                    placeholder="e.g. B.Tech"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                  <datalist id="degree-catalog">
                    {DEGREE_OPTIONS.map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    Field of Study
                  </label>
                  <input
                    list="field-catalog"
                    type="text"
                    value={eduDraft.field_of_study || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, field_of_study: e.target.value })}
                    placeholder="e.g. Computer Science"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                  <datalist id="field-catalog">
                    {FIELD_OF_STUDY_OPTIONS.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    Start Year
                  </label>
                  <input
                    type="text"
                    value={eduDraft.start_year || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, start_year: e.target.value })}
                    placeholder="e.g. 2020"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">
                    End Year
                  </label>
                  <input
                    type="text"
                    value={eduDraft.end_year || ""}
                    onChange={(e) => setEduDraft({ ...eduDraft, end_year: e.target.value })}
                    placeholder="e.g. 2024"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">
                  Grade / GPA (Optional)
                </label>
                <input
                  type="text"
                  value={eduDraft.grade_text || ""}
                  onChange={(e) => setEduDraft({ ...eduDraft, grade_text: e.target.value })}
                  placeholder="e.g. 3.8 GPA or 85%"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              {eduError && <p className="text-xs text-rose-400">{eduError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowEduModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdu}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-neutral-200 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Education Confirmation Dialog */}
      {deleteEduId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-white">
              Remove this entry?
            </h4>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Are you sure you want to remove this education entry? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteEduId(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white bg-neutral-900"
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
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

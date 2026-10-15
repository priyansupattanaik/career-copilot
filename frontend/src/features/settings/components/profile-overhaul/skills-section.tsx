import { useState, type KeyboardEvent } from "react";
import { POPULAR_SKILL_OPTIONS } from "@/features/profile/model/profile-options";
import type { CandidateSkill } from "./types";

interface SkillsSectionProps {
  skills: CandidateSkill[];
  onAddSkill: (name: string) => Promise<void>;
  onDeleteSkill: (idOrIdx: string | number) => Promise<void>;
}

export function SkillsSection({
  skills,
  onAddSkill,
  onDeleteSkill,
}: SkillsSectionProps) {
  const [skillInput, setSkillInput] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    const raw = skillInput.trim();
    if (!raw || busy) return;

    // Case-insensitive duplicate check
    const normalized = raw.toLowerCase();
    const alreadyExists = skills.some((s) => (s.name || "").trim().toLowerCase() === normalized);
    if (alreadyExists) {
      setDuplicateWarning(true);
      setTimeout(() => setDuplicateWarning(false), 2000);
      return;
    }

    try {
      setBusy(true);
      await onAddSkill(raw);
      setSkillInput("");
      setDuplicateWarning(false);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleAdd();
    }
  }

  const visibleSkills = showAll ? skills : skills.slice(0, 16);
  const hasHiddenSkills = skills.length > 16;

  return (
    <section
      id="section-skills"
      className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-neutral-900"
    >
      {/* Left Column: Heading & Description */}
      <div className="lg:col-span-4">
        <h2 className="text-xl font-medium text-white tracking-tight">
          Skills
        </h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          Languages, frameworks, databases, and engineering tools you actively use.
          Recruiters and job matches prioritize exact keyword matches from your skill list.
        </p>
      </div>

      {/* Right Column: Surface */}
      <div className="lg:col-span-8 bg-[#0A0A0A] border border-neutral-850 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Add Skill Combobox & Add button */}
        <div>
          <label
            htmlFor="skill-autocomplete-input"
            className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
          >
            Add a skill
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="skill-autocomplete-input"
                list="skills-catalog"
                type="text"
                value={skillInput}
                onChange={(e) => {
                  setSkillInput(e.target.value);
                  setDuplicateWarning(false);
                }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. TypeScript, Docker, PostgreSQL, PyTorch..."
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              />
              <datalist id="skills-catalog">
                {POPULAR_SKILL_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <button
              type="button"
              disabled={!skillInput.trim() || busy}
              onClick={handleAdd}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 shrink-0"
            >
              Add
            </button>
          </div>
          {duplicateWarning && (
            <p className="text-xs text-amber-400 mt-1.5 animate-in fade-in">
              This skill is already in your list.
            </p>
          )}
        </div>

        {/* Skills Chips */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Your Skills ({skills.length})
            </span>
            {hasHiddenSkills && (
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {showAll ? "Show fewer (16)" : `Show all (${skills.length})`}
              </button>
            )}
          </div>

          {skills.length === 0 ? (
            <p className="text-xs text-neutral-500 italic py-4">
              No skills yet. Add skills or autofill from your resume.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {visibleSkills.map((skill, idx) => {
                const id = skill.id || idx;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-200 hover:border-neutral-700 transition-all group"
                  >
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteSkill(id)}
                      className="text-neutral-500 group-hover:text-rose-400 hover:text-rose-300 p-0.5 rounded transition-colors text-xs"
                      aria-label={`Remove ${skill.name}`}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

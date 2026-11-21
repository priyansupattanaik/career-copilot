import { useState, type KeyboardEvent } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Surface } from "@/shared/ui/workbench";
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

  return (
    <Surface
      id="section-skills"
      className="profile-skills-section settings-card"
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
          Skills
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
          Languages, frameworks, databases, and engineering tools you actively use. Recruiters and job matches prioritize exact keyword matches from your skill list.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Add Skill Combobox & Add button */}
        <div>
          <label htmlFor="skill-autocomplete-input" style={labelStyle}>
            Add a skill
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
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
                style={{
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
                }}
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
              className="wb-button wb-button-primary"
              style={{ height: 40 }}
            >
              Add
            </button>
          </div>
          {duplicateWarning && (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--warn)", margin: "4px 0 0 0" }}>
              This skill is already in your list.
            </p>
          )}
        </div>

        {/* Skills Chips */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={labelStyle}>
              Your skills ({skills.length})
            </span>
            {hasHiddenSkills && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="wb-button wb-button-ghost"
                style={{ height: 28, fontSize: 12 }}
              >
                {showAll ? "Show fewer" : `Show all ${skills.length}`}
              </button>
            )}
          </div>

          {skills.length === 0 ? (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", margin: 0 }}>
              No skills added yet. Type a skill above to get started.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {visibleSkills.map((skill, idx) => {
                const idOrIdx = skill.id || idx;
                return (
                  <span
                    key={idOrIdx}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      height: 24,
                      padding: "0 8px",
                      borderRadius: "var(--radius-full, 9999px)",
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      onClick={() => onDeleteSkill(idOrIdx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        margin: 0,
                        cursor: "pointer",
                        color: "var(--ink-3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                      }}
                      className="wb-ghost-link"
                      aria-label={`Remove ${skill.name}`}
                    >
                      <CopilotIcon name="trash" size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

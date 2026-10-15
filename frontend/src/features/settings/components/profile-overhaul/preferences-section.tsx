import { useState, type KeyboardEvent } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Surface } from "@/shared/ui/workbench";
import type { CandidatePreferences } from "./types";

interface PreferencesSectionProps {
  preferences: CandidatePreferences;
  onChange: (prefs: CandidatePreferences) => void;
}

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD", "CHF"];
const AVAILABLE_WORK_MODES = ["Remote", "Hybrid", "On-site"] as const;

export function PreferencesSection({
  preferences,
  onChange,
}: PreferencesSectionProps) {
  const [roleInput, setRoleInput] = useState("");
  const [locInput, setLocInput] = useState("");

  // Target roles add/remove
  function handleAddRole() {
    const raw = roleInput.trim();
    if (!raw) return;
    if (!preferences.target_roles.includes(raw)) {
      onChange({
        ...preferences,
        target_roles: [...preferences.target_roles, raw],
      });
    }
    setRoleInput("");
  }

  function handleRemoveRole(idx: number) {
    onChange({
      ...preferences,
      target_roles: preferences.target_roles.filter((_, i) => i !== idx),
    });
  }

  // Preferred locations add/remove
  function handleAddLoc() {
    const raw = locInput.trim();
    if (!raw) return;
    if (!preferences.preferred_locations.includes(raw)) {
      onChange({
        ...preferences,
        preferred_locations: [...preferences.preferred_locations, raw],
      });
    }
    setLocInput("");
  }

  function handleRemoveLoc(idx: number) {
    onChange({
      ...preferences,
      preferred_locations: preferences.preferred_locations.filter((_, i) => i !== idx),
    });
  }

  // Work mode toggle
  function toggleWorkMode(mode: string) {
    const exists = preferences.work_modes.includes(mode);
    const updated = exists
      ? preferences.work_modes.filter((m) => m !== mode)
      : [...preferences.work_modes, mode];
    onChange({ ...preferences, work_modes: updated });
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
      id="section-preferences"
      className="profile-preferences-section"
      style={{
        padding: "var(--space-6, 24px)",
        borderRadius: "var(--radius-lg, 12px)",
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
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
          Job preferences
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
          These preferences are used to find and rank relevant job matches for you.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Target Roles */}
        <div>
          <label htmlFor="pref-target-roles" style={labelStyle}>
            Target roles
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              id="pref-target-roles"
              type="text"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddRole();
                }
              }}
              placeholder="e.g. Lead Architect, Staff Engineer (press Enter)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              disabled={!roleInput.trim()}
              onClick={handleAddRole}
              className="wb-button wb-button-primary"
              style={{ height: 40 }}
            >
              Add
            </button>
          </div>
          {preferences.target_roles.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {preferences.target_roles.map((role, idx) => (
                <span
                  key={idx}
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
                    color: "var(--ink)",
                  }}
                >
                  <span>{role}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(idx)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--ink-3)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    className="wb-ghost-link"
                    aria-label={`Remove ${role}`}
                  >
                    <CopilotIcon name="trash" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preferred Locations */}
        <div>
          <label htmlFor="pref-target-locations" style={labelStyle}>
            Preferred locations
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              id="pref-target-locations"
              type="text"
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLoc();
                }
              }}
              placeholder="e.g. San Francisco, CA, London, Remote (press Enter)"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              disabled={!locInput.trim()}
              onClick={handleAddLoc}
              className="wb-button wb-button-primary"
              style={{ height: 40 }}
            >
              Add
            </button>
          </div>
          {preferences.preferred_locations.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {preferences.preferred_locations.map((loc, idx) => (
                <span
                  key={idx}
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
                    color: "var(--ink)",
                  }}
                >
                  <span>{loc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLoc(idx)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "var(--ink-3)",
                      display: "flex",
                      alignItems: "center",
                    }}
                    className="wb-ghost-link"
                    aria-label={`Remove ${loc}`}
                  >
                    <CopilotIcon name="trash" size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Work Modes */}
        <div>
          <label style={labelStyle}>Work modes</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AVAILABLE_WORK_MODES.map((mode) => {
              const isSelected = preferences.work_modes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleWorkMode(mode)}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-control)",
                    backgroundColor: isSelected ? "var(--accent-soft)" : "var(--surface-2)",
                    color: isSelected ? "var(--accent)" : "var(--ink)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 120ms ease",
                  }}
                >
                  {isSelected && <CopilotIcon name="check" size={14} />}
                  <span>{mode}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Salary expectation */}
        <div>
          <label htmlFor="pref-salary-min" style={labelStyle}>
            Minimum annual base salary
          </label>
          <div style={{ display: "flex", gap: 8, maxWidth: 360 }}>
            <select
              aria-label="Salary currency"
              value={preferences.salary_currency || "USD"}
              onChange={(e) => onChange({ ...preferences, salary_currency: e.target.value })}
              style={{ ...inputStyle, width: 90 }}
            >
              {COMMON_CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
            <input
              id="pref-salary-min"
              type="number"
              step="5000"
              min="0"
              value={preferences.salary_min != null ? preferences.salary_min : ""}
              onChange={(e) =>
                onChange({
                  ...preferences,
                  salary_min: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="e.g. 150000"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </div>
      </div>
    </Surface>
  );
}

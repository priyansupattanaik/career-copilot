import { useState, type KeyboardEvent } from "react";
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

  return (
    <section
      id="section-preferences"
      className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-neutral-900"
    >
      {/* Left Column: Heading & Description */}
      <div className="lg:col-span-4">
        <h2 className="text-xl font-medium text-white tracking-tight">
          Job preferences
        </h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          These preferences are used to find and rank jobs for you.
        </p>
      </div>

      {/* Right Column: Surface */}
      <div className="lg:col-span-8 bg-[#0A0A0A] border border-neutral-850 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Target Roles */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            Target roles
          </label>
          <div className="flex gap-2 mb-3">
            <input
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60"
            />
            <button
              type="button"
              disabled={!roleInput.trim()}
              onClick={handleAddRole}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-neutral-850 hover:bg-neutral-800 text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {preferences.target_roles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.target_roles.map((role, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-200"
                >
                  <span>{role}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(idx)}
                    className="text-neutral-500 hover:text-rose-400 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preferred Locations */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            Preferred locations
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={locInput}
              onChange={(e) => setLocInput(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLoc();
                }
              }}
              placeholder="e.g. San Francisco, CA or Remote (press Enter)"
              className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60"
            />
            <button
              type="button"
              disabled={!locInput.trim()}
              onClick={handleAddLoc}
              className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-neutral-850 hover:bg-neutral-800 text-white disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {preferences.preferred_locations.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {preferences.preferred_locations.map((loc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-200"
                >
                  <span>{loc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLoc(idx)}
                    className="text-neutral-500 hover:text-rose-400 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Work Modes */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            Work arrangements
          </label>
          <div className="flex flex-wrap gap-3">
            {AVAILABLE_WORK_MODES.map((mode) => {
              const active = preferences.work_modes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleWorkMode(mode)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                    active
                      ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/40"
                      : "bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-white"
                  }`}
                >
                  {mode}
                </button>
              );
            })}
          </div>
        </div>

        {/* Minimum Salary & Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Salary currency
            </label>
            <select
              value={preferences.salary_currency || "USD"}
              onChange={(e) => onChange({ ...preferences, salary_currency: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white text-sm focus:outline-none focus:border-cyan-500/60"
            >
              {COMMON_CURRENCIES.map((cur) => (
                <option key={cur} value={cur}>
                  {cur}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Minimum salary
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={preferences.salary_min == null ? "" : preferences.salary_min}
              onChange={(e) =>
                onChange({
                  ...preferences,
                  salary_min: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="e.g. 120000"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

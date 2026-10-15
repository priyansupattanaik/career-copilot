import { useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { LOCATION_OPTIONS, ROLE_OPTIONS } from "@/features/profile/model/profile-options";
import type { CandidateLink } from "./types";

interface AboutSectionProps {
  fullName: string;
  onFullNameChange: (val: string) => void;
  location: string;
  onLocationChange: (val: string) => void;
  currentRole: string;
  onCurrentRoleChange: (val: string) => void;
  yearsExperience: string | number;
  onYearsExperienceChange: (val: string | number) => void;
  bio: string;
  onBioChange: (val: string) => void;
  links: CandidateLink[];
  onAddLink: (link: CandidateLink) => void;
  onDeleteLink: (linkIdOrIdx: string | number) => void;
}

export function AboutSection({
  fullName,
  onFullNameChange,
  location,
  onLocationChange,
  currentRole,
  onCurrentRoleChange,
  yearsExperience,
  onYearsExperienceChange,
  bio,
  onBioChange,
  links,
  onAddLink,
  onDeleteLink,
}: AboutSectionProps) {
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkType, setNewLinkType] = useState<string>("linkedin");
  const [newLinkUrl, setNewLinkUrl] = useState<string>("");
  const [linkError, setLinkError] = useState<string>("");

  const yNum = yearsExperience !== "" && yearsExperience !== null && yearsExperience !== undefined
    ? Number(yearsExperience)
    : NaN;
  const isFresher = !Number.isNaN(yNum) && yNum === 0;

  function handleCreateLink() {
    setLinkError("");
    let url = newLinkUrl.trim();
    if (!url) {
      setLinkError("Please enter a valid URL.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      new URL(url);
    } catch {
      setLinkError("Invalid web address format.");
      return;
    }

    onAddLink({
      link_type: newLinkType,
      url,
      label: newLinkType,
    });
    setNewLinkUrl("");
    setShowAddLink(false);
  }

  return (
    <section
      id="section-about"
      className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-neutral-900"
    >
      {/* Left Column: Heading & Explanation */}
      <div className="lg:col-span-4">
        <h2 className="text-xl font-medium text-white tracking-tight">
          About you
        </h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          Your core professional identity. This information appears on your profile
          header and helps recruiters find and understand your background.
        </p>
      </div>

      {/* Right Column: Surface */}
      <div className="lg:col-span-8 bg-[#0A0A0A] border border-neutral-850 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="profile-full-name" className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            Full name <span className="text-cyan-400">*</span>
          </label>
          <input
            id="profile-full-name"
            type="text"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="e.g. Alex Rivera"
            className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* 2-Column: Current Role & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Current Role Combobox */}
          <div>
            <label htmlFor="profile-current-role" className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Current role / Title
            </label>
            <input
              id="profile-current-role"
              list="role-catalog"
              type="text"
              value={currentRole}
              onChange={(e) => onCurrentRoleChange(e.target.value)}
              placeholder="e.g. Senior Software Engineer"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <datalist id="role-catalog">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>

          {/* Location Combobox */}
          <div>
            <label htmlFor="profile-location" className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
              Location
            </label>
            <input
              id="profile-location"
              list="location-catalog"
              type="text"
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder="e.g. Bengaluru, India or Remote"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <datalist id="location-catalog">
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Years of Experience */}
        <div>
          <label htmlFor="profile-years-exp" className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
            Years of experience
          </label>
          <div className="max-w-xs">
            <input
              id="profile-years-exp"
              type="number"
              min="0"
              max="50"
              step="1"
              value={yearsExperience === "" ? "" : yearsExperience}
              onChange={(e) => onYearsExperienceChange(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 5 (Enter 0 if fresher/student)"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>
          {isFresher && (
            <p className="text-xs text-cyan-400 mt-2 flex items-center gap-1.5 font-medium animate-in fade-in">
              <CopilotIcon name="sparkles" className="w-3.5 h-3.5 shrink-0" />
              <span>0 years indicates you are entering the workforce or changing fields. We'll highlight your education and projects.</span>
            </p>
          )}
        </div>

        {/* Bio / Summary */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="profile-bio" className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              About summary / Bio
            </label>
            <span className="text-[11px] text-neutral-500 font-mono">
              {(bio || "").length}/1200
            </span>
          </div>
          <textarea
            id="profile-bio"
            rows={4}
            maxLength={1200}
            value={bio}
            onChange={(e) => onBioChange(e.target.value)}
            placeholder="Briefly describe your focus, tech stack, and what drives your engineering work..."
            className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Links Subsection */}
        <div className="pt-4 border-t border-neutral-850">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Profile & Portfolio Links
            </span>
            <button
              type="button"
              onClick={() => setShowAddLink(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              + Add link
            </button>
          </div>

          {/* Links list */}
          {links.length === 0 ? (
            <p className="text-xs text-neutral-500 italic py-2">
              No links added yet. Add your LinkedIn, GitHub, or portfolio website.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link, idx) => (
                <div
                  key={link.id || idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 border border-neutral-850 hover:border-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-neutral-800 text-neutral-300 shrink-0">
                      {link.link_type}
                    </span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neutral-300 hover:text-white truncate hover:underline"
                    >
                      {link.url}
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteLink(link.id || idx)}
                    className="text-neutral-500 hover:text-rose-400 p-1 text-xs shrink-0 transition-colors"
                    title="Remove link"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add Link Inline Form */}
          {showAddLink && (
            <div className="mt-4 p-4 rounded-xl bg-neutral-900 border border-neutral-750 space-y-3 animate-in fade-in">
              <span className="text-xs font-semibold text-white block">
                Add profile link
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={newLinkType}
                  onChange={(e) => setNewLinkType(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>
              </div>
              {linkError && <p className="text-xs text-rose-400">{linkError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddLink(false);
                    setLinkError("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-850"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateLink}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-neutral-200 transition-colors"
                >
                  Add Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { useState, useEffect, useRef } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { apiRequest } from "@/shared/api/client";
import {
  LOCATION_OPTIONS,
  ROLE_OPTIONS,
  CAREER_LEVEL_OPTIONS,
  CAREER_GOAL_OPTIONS,
} from "@/features/profile/model/profile-options";
import {
  isPublicProfileUsername,
  normalizePublicProfileUsername,
} from "@/features/profile/model/public-profile-username";
import type { CandidateLink } from "./types";

interface AboutSectionProps {
  fullName: string;
  onFullNameChange: (val: string) => void;
  username: string;
  onUsernameChange: (val: string) => void;
  savedUsername?: string;
  headline: string;
  onHeadlineChange: (val: string) => void;
  location: string;
  onLocationChange: (val: string) => void;
  currentRole: string;
  onCurrentRoleChange: (val: string) => void;
  yearsExperience: string | number;
  onYearsExperienceChange: (val: string | number) => void;
  careerLevel: string;
  onCareerLevelChange: (val: string) => void;
  careerGoal: string;
  onCareerGoalChange: (val: string) => void;
  bio: string;
  onBioChange: (val: string) => void;
  links: CandidateLink[];
  onAddLink: (link: CandidateLink) => Promise<void>;
  onUpdateLink?: (idOrIdx: string | number, link: CandidateLink) => Promise<void>;
  onDeleteLink: (linkIdOrIdx: string | number) => Promise<void>;
}

export function AboutSection({
  fullName,
  onFullNameChange,
  username,
  onUsernameChange,
  savedUsername,
  headline,
  onHeadlineChange,
  location,
  onLocationChange,
  currentRole,
  onCurrentRoleChange,
  yearsExperience,
  onYearsExperienceChange,
  careerLevel,
  onCareerLevelChange,
  careerGoal,
  onCareerGoalChange,
  bio,
  onBioChange,
  links,
  onAddLink,
  onUpdateLink,
  onDeleteLink,
}: AboutSectionProps) {
  // Username availability state
  const [availability, setAvailability] = useState<{
    available?: boolean;
    reason?: string | null;
  } | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Link dialog states
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [editingLinkIdOrIdx, setEditingLinkIdOrIdx] = useState<string | number | null>(null);
  const [dialogLinkType, setDialogLinkType] = useState<string>("linkedin");
  const [dialogLinkUrl, setDialogLinkUrl] = useState<string>("");
  const [linkError, setLinkError] = useState<string>("");

  // Debounced username availability check
  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const raw = username || "";
    const normalized = normalizePublicProfileUsername(raw);

    if (!normalized) {
      setAvailability(null);
      setCheckingUsername(false);
      return;
    }

    if (savedUsername && normalized === normalizePublicProfileUsername(savedUsername)) {
      setAvailability({ available: true });
      setCheckingUsername(false);
      return;
    }

    if (!isPublicProfileUsername(normalized)) {
      setAvailability({
        available: false,
        reason: "3–30 lowercase letters, numbers, and underscores.",
      });
      setCheckingUsername(false);
      return;
    }

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    setCheckingUsername(true);
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await apiRequest<{ available?: boolean; reason?: string | null }>(
          `/profile/username/availability?username=${encodeURIComponent(normalized)}`
        );
        setAvailability({
          available: Boolean(res?.available),
          reason: res?.reason,
        });
      } catch {
        setAvailability(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 250);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [username, savedUsername]);

  function openAddLinkModal() {
    setEditingLinkIdOrIdx(null);
    setDialogLinkType("linkedin");
    setDialogLinkUrl("");
    setLinkError("");
    setShowLinkDialog(true);
  }

  function openEditLinkModal(link: CandidateLink, idOrIdx: string | number) {
    setEditingLinkIdOrIdx(idOrIdx);
    setDialogLinkType(link.link_type || "other");
    setDialogLinkUrl(link.url || "");
    setLinkError("");
    setShowLinkDialog(true);
  }

  async function handleSaveLink() {
    setLinkError("");
    let url = dialogLinkUrl.trim();
    if (!url) {
      setLinkError("URL is required.");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        setLinkError("Only HTTP and HTTPS URLs are accepted.");
        return;
      }
    } catch {
      setLinkError("Please enter a valid URL.");
      return;
    }

    const payload: CandidateLink = {
      link_type: dialogLinkType,
      url,
      label: dialogLinkType,
    };

    if (editingLinkIdOrIdx !== null && onUpdateLink) {
      await onUpdateLink(editingLinkIdOrIdx, payload);
    } else {
      await onAddLink(payload);
    }
    setShowLinkDialog(false);
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
        {/* Row 1: Full name* | Username */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-full-name"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Full name <span className="text-cyan-400">*</span>
            </label>
            <input
              id="profile-full-name"
              type="text"
              required
              aria-required="true"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              placeholder="e.g. Alex Rivera"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
          </div>

          <div>
            <label
              htmlFor="profile-username"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Username
            </label>
            <input
              id="profile-username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={30}
              value={username || ""}
              onChange={(e) => onUsernameChange(e.target.value)}
              placeholder="e.g. alex_rivera"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all font-mono"
            />
            <p className="text-[11px] mt-1.5 leading-tight">
              {checkingUsername ? (
                <span className="text-neutral-400">Checking availability…</span>
              ) : availability ? (
                availability.available ? (
                  <span className="text-emerald-400">
                    Available. Public profile and sign-in: /{normalizePublicProfileUsername(username)}
                  </span>
                ) : (
                  <span className="text-rose-400">
                    {availability.reason || "That username is not available."}
                  </span>
                )
              ) : (
                <span className="text-neutral-500">
                  Choose a unique username. 3–30 letters, numbers, and underscores.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Row 2: Headline (full width, max 120 characters, counter from 100) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="profile-headline"
              className="text-xs font-semibold text-neutral-300 uppercase tracking-wider"
            >
              Headline
            </label>
            {(headline || "").length >= 100 && (
              <span className="text-[11px] font-mono text-neutral-400">
                {(headline || "").length}/120
              </span>
            )}
          </div>
          <input
            id="profile-headline"
            type="text"
            maxLength={120}
            value={headline || ""}
            onChange={(e) => onHeadlineChange(e.target.value)}
            placeholder="e.g. Staff Backend Engineer | Distributed Systems & High-Throughput APIs"
            className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
          />
        </div>

        {/* Row 3: Location* | Current role* */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-location"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Location <span className="text-cyan-400">*</span>
            </label>
            <input
              id="profile-location"
              list="location-catalog"
              type="text"
              required
              aria-required="true"
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

          <div>
            <label
              htmlFor="profile-current-role"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Current role <span className="text-cyan-400">*</span>
            </label>
            <input
              id="profile-current-role"
              list="role-catalog"
              type="text"
              required
              aria-required="true"
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
        </div>

        {/* Row 4: Years of experience* | Career level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-years-exp"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Years of experience <span className="text-cyan-400">*</span>
            </label>
            <input
              id="profile-years-exp"
              type="number"
              min="0"
              max="60"
              step="1"
              required
              aria-required="true"
              value={yearsExperience === "" ? "" : yearsExperience}
              onChange={(e) =>
                onYearsExperienceChange(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="e.g. 5"
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            <p className="text-[11px] text-neutral-400 mt-1.5 leading-tight">
              Choose 0 years if you are a fresher with no work history yet.
            </p>
          </div>

          <div>
            <label
              htmlFor="profile-career-level"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Career level
            </label>
            <select
              id="profile-career-level"
              value={careerLevel || ""}
              onChange={(e) => onCareerLevelChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            >
              <option value="">Select career level</option>
              {CAREER_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 5: Career goal | (empty) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-career-goal"
              className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2"
            >
              Career goal
            </label>
            <select
              id="profile-career-goal"
              value={careerGoal || ""}
              onChange={(e) => onCareerGoalChange(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
            >
              <option value="">Select career goal</option>
              {CAREER_GOAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden sm:block" />
        </div>

        {/* Row 6: About (full-width textarea, 3 rows, labelled 'About') */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="profile-about-bio"
              className="text-xs font-semibold text-neutral-300 uppercase tracking-wider"
            >
              About
            </label>
            <span className="text-[11px] text-neutral-500 font-mono">
              {(bio || "").length}/4000
            </span>
          </div>
          <textarea
            id="profile-about-bio"
            rows={3}
            maxLength={4000}
            value={bio || ""}
            onChange={(e) => onBioChange(e.target.value)}
            placeholder="Briefly describe your background, technical interests, and what drives your engineering work..."
            className="w-full px-4 py-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all resize-none leading-relaxed"
          />
        </div>

        {/* Subsection: Links */}
        <div className="pt-4 border-t border-neutral-850">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
              Links
            </span>
            <button
              type="button"
              onClick={openAddLinkModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-cyan-400 border border-neutral-800 hover:border-cyan-500/40 transition-colors"
            >
              <CopilotIcon name="plus" className="w-3.5 h-3.5" />
              <span>Add link</span>
            </button>
          </div>

          {/* Links list */}
          {links.length === 0 ? (
            <p className="text-xs text-neutral-500 italic py-2">
              No links added yet. Add your LinkedIn, GitHub, or portfolio website.
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link, idx) => {
                const idOrIdx = link.id || idx;
                return (
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
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditLinkModal(link, idOrIdx)}
                        className="p-1 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                        title="Edit link"
                      >
                        <CopilotIcon name="edit" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLink(idOrIdx)}
                        className="p-1 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        title="Remove link"
                      >
                        <CopilotIcon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Link Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-sm font-semibold text-white">
                {editingLinkIdOrIdx !== null ? "Edit link" : "Add link"}
              </h4>
              <button
                type="button"
                onClick={() => setShowLinkDialog(false)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Link type
                </label>
                <select
                  value={dialogLinkType}
                  onChange={(e) => setDialogLinkType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                  URL
                </label>
                <input
                  type="url"
                  value={dialogLinkUrl}
                  onChange={(e) => setDialogLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              {linkError && <p className="text-xs text-rose-400">{linkError}</p>}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setShowLinkDialog(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLink}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-neutral-200 transition-colors"
              >
                Save link
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import { useState, useEffect, useRef } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { apiRequest } from "@/shared/api/client";
import { Surface } from "@/shared/ui/workbench";
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
      if (editingLinkIdOrIdx !== null) {
        if (onUpdateLink) {
          await onUpdateLink(editingLinkIdOrIdx, {
            link_type: dialogLinkType,
            url,
          });
        }
      } else {
        await onAddLink({
          link_type: dialogLinkType,
          url,
        });
      }
      setShowLinkDialog(false);
    } catch (err: any) {
      setLinkError(err?.message || "Failed to save link.");
    }
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
      id="section-about"
      className="profile-about-section settings-card"
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
          About you
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
          Your core professional identity. This information appears on your profile header and helps recruiters find and understand your background.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Row 1: Full name* | Username */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px 24px" }}>
          <div>
            <label htmlFor="profile-full-name" style={labelStyle}>
              Full name <span style={{ color: "var(--accent)" }}>*</span>
            </label>
            <input
              id="profile-full-name"
              type="text"
              required
              aria-required="true"
              value={fullName}
              onChange={(e) => onFullNameChange(e.target.value)}
              placeholder="e.g. Alex Rivera"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="profile-username" style={labelStyle}>
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
              style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
            />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, lineHeight: "16px", margin: "4px 0 0 0" }}>
              {checkingUsername ? (
                <span style={{ color: "var(--ink-3)" }}>Checking availability…</span>
              ) : availability ? (
                availability.available ? (
                  <span style={{ color: "var(--ok)" }}>
                    Available. Public profile: /{normalizePublicProfileUsername(username)}
                  </span>
                ) : (
                  <span style={{ color: "var(--danger)" }}>
                    {availability.reason || "That username is not available."}
                  </span>
                )
              ) : (
                <span style={{ color: "var(--ink-3)" }}>
                  Choose a unique username. 3–30 letters, numbers, and underscores.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Row 2: Headline */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label htmlFor="profile-headline" style={labelStyle}>
              Headline
            </label>
            {(headline || "").length >= 100 && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
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
            style={inputStyle}
          />
        </div>

        {/* Row 3: Location* | Current role* */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px 24px" }}>
          <div>
            <label htmlFor="profile-location" style={labelStyle}>
              Location <span style={{ color: "var(--accent)" }}>*</span>
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
              style={inputStyle}
            />
            <datalist id="location-catalog">
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="profile-current-role" style={labelStyle}>
              Current role <span style={{ color: "var(--accent)" }}>*</span>
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
              style={inputStyle}
            />
            <datalist id="role-catalog">
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </div>

        {/* Row 4: Years of experience* | Career level */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px 24px" }}>
          <div>
            <label htmlFor="profile-years-exp" style={labelStyle}>
              Years of experience <span style={{ color: "var(--accent)" }}>*</span>
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
              style={inputStyle}
            />
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-3)", margin: "4px 0 0 0" }}>
              Choose 0 years if you are a fresher with no work history yet.
            </p>
          </div>

          <div>
            <label htmlFor="profile-career-level" style={labelStyle}>
              Career level
            </label>
            <select
              id="profile-career-level"
              value={careerLevel || ""}
              onChange={(e) => onCareerLevelChange(e.target.value)}
              style={inputStyle}
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

        {/* Row 5: Career goal */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px 24px" }}>
          <div>
            <label htmlFor="profile-career-goal" style={labelStyle}>
              Career goal
            </label>
            <select
              id="profile-career-goal"
              value={careerGoal || ""}
              onChange={(e) => onCareerGoalChange(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select career goal</option>
              {CAREER_GOAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 6: About (bio) */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label htmlFor="profile-about-bio" style={labelStyle}>
              About
            </label>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
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
            style={{
              ...inputStyle,
              height: "auto",
              padding: "12px",
              resize: "none",
              lineHeight: "22px",
            }}
          />
        </div>

        {/* Subsection: Links */}
        <div style={{ paddingTop: 16, borderTop: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={labelStyle}>Links</span>
            <button
              type="button"
              onClick={openAddLinkModal}
              className="wb-button wb-button-ghost"
              style={{ height: 40 }}
            >
              <CopilotIcon name="plus" size={14} />
              <span>Add link</span>
            </button>
          </div>

          {links.length === 0 ? (
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ink-3)", fontStyle: "italic", margin: 0 }}>
              No links added yet. Add your LinkedIn, GitHub, or portfolio website.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((link, idx) => {
                const idOrIdx = link.id || idx;
                return (
                  <div
                    key={link.id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md, 8px)",
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--hairline)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, paddingRight: 12 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          height: 24,
                          padding: "0 8px",
                          borderRadius: "var(--radius-sm, 4px)",
                          backgroundColor: "var(--surface-3)",
                          color: "var(--ink-2)",
                          fontFamily: "var(--font-sans)",
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          flexShrink: 0,
                        }}
                      >
                        {link.link_type}
                      </span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          color: "var(--ink)",
                          textDecoration: "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {link.url}
                      </a>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => openEditLinkModal(link, idOrIdx)}
                        className="wb-button wb-button-ghost"
                        style={{ width: 40, height: 40, padding: 0 }}
                        title="Edit link"
                      >
                        <CopilotIcon name="edit" size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteLink(idOrIdx)}
                        className="wb-button wb-button-ghost"
                        style={{ width: 40, height: 40, padding: 0, color: "var(--danger)" }}
                        title="Remove link"
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

      {/* Add / Edit Link Dialog */}
      {showLinkDialog && (
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
          aria-labelledby="link-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
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
                id="link-dialog-title"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                {editingLinkIdOrIdx !== null ? "Edit link" : "Add link"}
              </h4>
              <button
                type="button"
                onClick={() => setShowLinkDialog(false)}
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
                <label style={labelStyle}>Link type</label>
                <select
                  value={dialogLinkType}
                  onChange={(e) => setDialogLinkType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="github">GitHub</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="website">Website</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>URL</label>
                <input
                  type="url"
                  value={dialogLinkUrl}
                  onChange={(e) => setDialogLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  style={inputStyle}
                />
              </div>

              {linkError && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--danger)", margin: 0 }}>
                  {linkError}
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
                onClick={() => setShowLinkDialog(false)}
                className="wb-button wb-button-ghost"
                style={{ height: 40 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLink}
                className="wb-button wb-button-primary"
                style={{ height: 40 }}
              >
                Save link
              </button>
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}

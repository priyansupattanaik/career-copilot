import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Link } from "@/shared/ui/router-link";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { ScoreRing, Surface } from "@/shared/ui/workbench";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { normalizePublicProfileUsername } from "@/features/profile/model/public-profile-username";
import type { ProfileMissingItem } from "@/features/profile/model/profile-completion";
import { vitePublicAppOrigin } from "@/shared/config";

interface IdentityStripProps {
  fullName: string;
  avatarUrl?: string | null;
  headline?: string | null;
  currentRole?: string | null;
  location?: string | null;
  yearsExperience?: number | string | null;
  username?: string | null;
  completionScore: number;
  completedCount?: number;
  totalCount?: number;
  missingItems: ProfileMissingItem[];
  onUploadAvatar?: (file: File) => Promise<void>;
  onRemoveAvatar?: () => Promise<void>;
  avatarBusy?: boolean;
}

export function formatYearsExperience(years: number | string | null | undefined): string {
  if (years === null || years === undefined || years === "") return "";
  const n = Number(years);
  if (Number.isNaN(n) || n < 0) return "";
  if (n === 1) return "1 year";
  return `${n} years`;
}

export function IdentityStrip({
  fullName,
  avatarUrl,
  headline,
  currentRole,
  location,
  yearsExperience,
  username,
  completionScore,
  completedCount = 0,
  totalCount = 8,
  missingItems,
  onUploadAvatar,
  onRemoveAvatar,
  avatarBusy = false,
}: IdentityStripProps) {
  const [copied, setCopied] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  const cleanName = fullName?.trim() || "Your Name";
  const initials =
    cleanName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "U";

  // Build meta line strictly per spec: location, current role, years of experience
  const metaParts: string[] = [];
  if (location?.trim()) metaParts.push(location.trim());
  if (currentRole?.trim()) metaParts.push(currentRole.trim());
  const expStr = formatYearsExperience(yearsExperience);
  if (expStr) metaParts.push(expStr);
  const metaLine = metaParts.join(" · ");

  const cleanUsername = normalizePublicProfileUsername(username || "");
  const baseOrigin = typeof window !== "undefined" ? (vitePublicAppOrigin() || window.location.origin) : "";
  const publicUrl = cleanUsername && baseOrigin ? `${baseOrigin}/u/${cleanUsername}` : "";

  // Close photo menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(event.target as Node)) {
        setShowPhotoMenu(false);
      }
    }
    if (showPhotoMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPhotoMenu]);

  async function handleCopyLink() {
    if (!publicUrl) return;
    const success = await copyTextToClipboard(publicUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onUploadAvatar) {
      void onUploadAvatar(file);
    }
    if (e.target) e.target.value = "";
    setShowPhotoMenu(false);
  }

  const isComplete = completedCount === totalCount;

  return (
    <Surface
      className="profile-identity-strip"
      style={{
        padding: "var(--space-6, 24px)",
        borderRadius: "var(--radius-lg, 12px)",
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
        position: "relative",
      }}
    >
      <div className="identity-strip-grid">
        {/* Left: Avatar 72px round */}
        <div
          className="identity-strip-avatar-wrap"
          ref={photoMenuRef}
          style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "var(--radius-full, 9999px)",
              overflow: "hidden",
              border: "1px solid var(--hairline)",
              backgroundColor: "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={cleanName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 22,
                  fontWeight: 500,
                  color: "var(--ink-2)",
                }}
              >
                {initials}
              </span>
            )}
          </div>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={handleFileChange}
            aria-label="Choose profile photo"
          />

          {/* Avatar badge: 28px circular icon button at bottom-right, offset -4px, 2px --canvas ring, edit icon */}
          <button
            type="button"
            disabled={avatarBusy}
            onClick={() => setShowPhotoMenu((prev) => !prev)}
            aria-label="Change photo"
            data-allow-overlap="true"
            className="identity-strip-avatar-badge"
            style={{
              position: "absolute",
              bottom: -4,
              right: -4,
              width: 28,
              height: 28,
              borderRadius: "var(--radius-full, 9999px)",
              backgroundColor: "var(--surface-2)",
              border: "2px solid var(--canvas)",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              cursor: "pointer",
            }}
          >
            {avatarBusy ? (
              <div
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "var(--ink)",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            ) : (
              <CopilotIcon name="edit" size={14} />
            )}
          </button>

          {/* Photo Dropdown Menu */}
          {showPhotoMenu && (
            <div
              className="identity-strip-photo-menu"
              style={{
                position: "absolute",
                left: 0,
                top: 76,
                zIndex: 40,
                minWidth: 140,
                borderRadius: "var(--radius-md, 8px)",
                backgroundColor: "var(--surface-3)",
                border: "1px solid var(--hairline-strong)",
                padding: "var(--space-1, 4px)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
              role="menu"
              aria-label="Photo options"
            >
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="wb-menu-item"
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm, 4px)",
                  fontSize: 13,
                  lineHeight: "18px",
                  color: "var(--ink)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                role="menuitem"
              >
                Choose photo
              </button>
              {avatarUrl && onRemoveAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoMenu(false);
                    void onRemoveAvatar();
                  }}
                  className="wb-menu-item is-danger"
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm, 4px)",
                    fontSize: 13,
                    lineHeight: "18px",
                    color: "var(--danger)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  role="menuitem"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>

        {/* Middle: Details (min-width 0, full name, @username, headline, metaLine) */}
        <div className="identity-strip-info" style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 8,
              minWidth: 0,
              flexWrap: "nowrap",
            }}
          >
            <h1
              id="identity-strip-heading"
              tabIndex={-1}
              style={{
                fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)',
                fontSize: 28,
                lineHeight: "32px",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                outline: "none",
              }}
            >
              {cleanName}
            </h1>
            {cleanUsername && (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  lineHeight: "20px",
                  color: "var(--ink-2)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                @{cleanUsername}
              </span>
            )}
          </div>

          {headline?.trim() ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: "22px",
                color: "var(--ink)",
                margin: "4px 0 0 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {headline.trim()}
            </p>
          ) : null}

          {metaLine ? (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: "20px",
                color: "var(--ink-2)",
                margin: "4px 0 0 0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {metaLine}
            </p>
          ) : null}
        </div>

        {/* Right: Meter + Actions */}
        <div className="identity-strip-right">
          {/* Completeness meter 56px */}
          <div
            className="identity-strip-meter"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              position: "relative",
            }}
          >
            <div style={{ width: 56, height: 56, flexShrink: 0 }}>
              <ScoreRing
                score={completionScore}
                size={56}
                strokeWidth={4}
                hideLabel
                compact
                label="Profile completeness"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  lineHeight: "20px",
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                {isComplete ? "Profile complete" : `${completedCount} of ${totalCount} done`}
              </span>

              {!isComplete ? (
                <button
                  type="button"
                  onClick={() => setShowMissing((prev) => !prev)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    margin: "2px 0 0 0",
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    lineHeight: "18px",
                    color: "var(--ink-2)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  className="wb-ghost-link"
                  aria-expanded={showMissing}
                >
                  <span>What's missing</span>
                  <CopilotIcon
                    name="chevrondown"
                    size={12}
                    style={{
                      transform: showMissing ? "rotate(180deg)" : "none",
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>
              ) : null}
            </div>

            {/* 'What's missing' Disclosure Popover */}
            {showMissing && !isComplete && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 64,
                  zIndex: 30,
                  width: 280,
                  borderRadius: "var(--radius-lg, 12px)",
                  backgroundColor: "var(--surface-3)",
                  border: "1px solid var(--hairline-strong)",
                  padding: "var(--space-4, 16px)",
                }}
                role="dialog"
                aria-label="Profile completeness checklist"
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {`${completedCount} of ${totalCount} done`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMissing(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--ink-3)",
                      fontSize: 16,
                      cursor: "pointer",
                      padding: 0,
                      lineHeight: 1,
                    }}
                    aria-label="Close checklist"
                  >
                    ×
                  </button>
                </div>
                <ul
                  style={{
                    margin: "12px 0 0 0",
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {missingItems.map((item) => (
                    <li key={item.key}>
                      <a
                        href={item.href || "#about"}
                        onClick={() => setShowMissing(false)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          lineHeight: "18px",
                          color: "var(--ink-2)",
                          textDecoration: "none",
                        }}
                        className="wb-missing-item-link"
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          ○ {item.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--accent)",
                            marginLeft: 8,
                            flexShrink: 0,
                          }}
                        >
                          Fix →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action buttons: View public profile (secondary, 40px), Copy link (ghost, 40px) */}
          <div className="identity-strip-actions">
            {cleanUsername ? (
              <>
                <Link
                  href={publicUrl || `/u/${cleanUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="wb-button wb-button-secondary"
                  style={{ height: 40 }}
                >
                  <CopilotIcon name="external" size={16} />
                  <span>View public profile</span>
                </Link>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="wb-button wb-button-ghost"
                  style={{ height: 40 }}
                  title="Copy public profile link"
                >
                  <CopilotIcon
                    name={copied ? "check" : "link"}
                    size={16}
                    style={copied ? { color: "var(--ok)" } : undefined}
                  />
                  <span>{copied ? "Copied!" : "Copy link"}</span>
                </button>
              </>
            ) : (
              <a
                href="#about"
                className="wb-button wb-button-secondary"
                style={{ height: 40 }}
              >
                Set username to share
              </a>
            )}
          </div>
        </div>
      </div>
    </Surface>
  );
}

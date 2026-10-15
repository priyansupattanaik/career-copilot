import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Link } from "@/shared/ui/router-link";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { ScoreRing } from "@/shared/ui/workbench";
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

  return (
    <div className="relative w-full rounded-2xl bg-[#0A0A0A] border border-neutral-850 p-6 md:p-8 backdrop-blur-md transition-all shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Avatar + Identity Details */}
        <div className="flex items-start sm:items-center gap-5 min-w-0">
          {/* Round avatar 64px with 'Change photo' menu */}
          <div className="relative shrink-0" ref={photoMenuRef}>
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-neutral-700/80 bg-neutral-900 flex items-center justify-center shadow-inner">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={cleanName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-medium tracking-tight text-neutral-300">
                  {initials}
                </span>
              )}
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Choose profile photo"
            />

            {/* Menu trigger button */}
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => setShowPhotoMenu((prev) => !prev)}
              className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-300 hover:text-white hover:border-neutral-500 shadow-md transition-colors"
              title="Change photo"
            >
              {avatarBusy ? (
                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Edit"
              )}
            </button>

            {/* Change photo Dropdown Menu */}
            {showPhotoMenu && (
              <div
                className="absolute left-0 top-18 z-40 w-36 rounded-xl bg-[#111111] border border-neutral-800 p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                aria-label="Photo options"
              >
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-neutral-200 hover:bg-neutral-800 transition-colors"
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
                    className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-950/40 transition-colors"
                    role="menuitem"
                  >
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Identity details: Full name, @username, headline, metaLine */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1
                id="identity-strip-heading"
                tabIndex={-1}
                className="text-[28px] leading-[32px] text-white font-normal tracking-tight font-serif outline-none"
                style={{ fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }}
              >
                {cleanName}
              </h1>
              {cleanUsername && (
                <span className="text-sm text-neutral-400 font-mono tracking-normal">
                  @{cleanUsername}
                </span>
              )}
            </div>

            {headline?.trim() && (
              <p className="text-sm text-neutral-200 mt-1 leading-snug line-clamp-2">
                {headline.trim()}
              </p>
            )}

            {metaLine && (
              <p className="text-xs text-neutral-400 mt-1.5 truncate font-sans">
                {metaLine}
              </p>
            )}
          </div>
        </div>

        {/* Right: ScoreRing & Actions */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
          {/* Completeness meter 56px */}
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 shrink-0 flex items-center justify-center">
              <ScoreRing
                score={completionScore}
                size={56}
                strokeWidth={5}
                label="Profile completeness"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs text-neutral-300 font-medium tracking-tight">
                {completedCount === totalCount ? "Profile complete" : `${completedCount} of ${totalCount} done`}
              </span>
              <button
                type="button"
                onClick={() => setShowMissing((prev) => !prev)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium mt-0.5"
                aria-expanded={showMissing}
              >
                <span>What's missing</span>
                <CopilotIcon
                  name="chevron-down"
                  className={`w-3 h-3 transition-transform ${showMissing ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* 'What's missing' Disclosure Popover */}
            {showMissing && (
              <div
                className="absolute right-0 top-16 z-30 w-72 rounded-xl bg-[#111111] border border-neutral-800 p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                role="dialog"
                aria-label="Profile completeness checklist"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-xs font-semibold text-white tracking-wide">
                    {completedCount === totalCount ? "Profile complete" : `${completedCount} of ${totalCount} done`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMissing(false)}
                    className="text-neutral-500 hover:text-white text-xs"
                    aria-label="Close checklist"
                  >
                    ×
                  </button>
                </div>
                {missingItems.length === 0 ? (
                  <p className="text-xs text-emerald-400 mt-3 font-medium">
                    ✓ Profile complete
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2 text-xs">
                    {missingItems.map((item) => (
                      <li key={item.key}>
                        <a
                          href={item.href || "#about"}
                          onClick={() => setShowMissing(false)}
                          className="flex items-center justify-between text-neutral-300 hover:text-cyan-400 transition-colors group"
                        >
                          <span className="truncate pr-2">○ {item.label}</span>
                          <span className="text-[10px] text-neutral-500 group-hover:text-cyan-400 shrink-0 font-mono">
                            Fix →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {cleanUsername ? (
              <>
                <Link
                  href={publicUrl || `/u/${cleanUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 hover:border-neutral-700 transition-all"
                >
                  <CopilotIcon name="open" className="w-3.5 h-3.5" />
                  <span>View public profile</span>
                </Link>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-transparent hover:bg-neutral-900 text-neutral-300 hover:text-white border border-transparent hover:border-neutral-800 transition-all"
                  title="Copy public profile link"
                >
                  <CopilotIcon
                    name={copied ? "check" : "copy"}
                    className={`w-3.5 h-3.5 ${copied ? "text-emerald-400" : ""}`}
                  />
                  <span>{copied ? "Copied!" : "Copy link"}</span>
                </button>
              </>
            ) : (
              <a
                href="#about"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800"
              >
                Set username to share
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

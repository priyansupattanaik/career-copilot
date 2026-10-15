import { useState, useRef, type ChangeEvent } from "react";
import { Link } from "@/shared/ui/router-link";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { ScoreRing } from "@/shared/ui/workbench";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { normalizePublicProfileUsername } from "@/features/profile/model/public-profile-username";
import type { ProfileMissingItem } from "@/features/profile/model/profile-completion";

interface IdentityStripProps {
  fullName: string;
  avatarUrl?: string | null;
  currentRole?: string | null;
  location?: string | null;
  yearsExperience?: number | string | null;
  username?: string | null;
  completionScore: number;
  missingItems: ProfileMissingItem[];
  onUploadAvatar?: (file: File) => Promise<void>;
  avatarBusy?: boolean;
}

export function IdentityStrip({
  fullName,
  avatarUrl,
  currentRole,
  location,
  yearsExperience,
  username,
  completionScore,
  missingItems,
  onUploadAvatar,
  avatarBusy = false,
}: IdentityStripProps) {
  const [copied, setCopied] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanName = fullName?.trim() || "Your Name";
  const initials = cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  // Build meta parts joined by " · "
  const metaParts: string[] = [];
  if (currentRole?.trim()) metaParts.push(currentRole.trim());
  if (location?.trim()) metaParts.push(location.trim());
  if (yearsExperience !== null && yearsExperience !== undefined && yearsExperience !== "") {
    const yNum = Number(yearsExperience);
    if (!Number.isNaN(yNum)) {
      if (yNum === 0) {
        metaParts.push("Entry-level (0 yrs)");
      } else {
        metaParts.push(`${yNum} ${yNum === 1 ? "yr" : "yrs"} exp`);
      }
    }
  }

  const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : "Complete your profile details below";
  const cleanUsername = normalizePublicProfileUsername(username || "");
  const publicUrl = cleanUsername && typeof window !== "undefined"
    ? `${window.location.origin}/u/${cleanUsername}`
    : "";

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
  }

  return (
    <div className="relative w-full rounded-2xl bg-[#0A0A0A] border border-neutral-800/80 p-6 md:p-8 backdrop-blur-md transition-all shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left: Avatar + Identity */}
        <div className="flex items-center gap-5">
          {/* 64px Round Avatar */}
          <div className="relative group shrink-0">
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

            {/* Hidden File Input & Hover Overlay */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload profile avatar"
            />
            <button
              type="button"
              disabled={avatarBusy}
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium"
              title="Change avatar photo"
            >
              {avatarBusy ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CopilotIcon name="camera" className="w-5 h-5 text-neutral-200" />
              )}
            </button>
          </div>

          {/* Name & Meta */}
          <div className="min-w-0">
            <h1
              className="text-2xl sm:text-3xl text-white font-normal tracking-tight truncate font-serif"
              style={{ fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)' }}
            >
              {cleanName}
            </h1>
            <p className="text-sm text-neutral-400 mt-1 truncate font-sans">
              {metaLine}
            </p>
          </div>
        </div>

        {/* Right: ScoreRing & Actions */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0 flex-wrap sm:flex-nowrap">
          {/* ScoreRing 56px with "What's missing" toggle */}
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
              <span className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
                Profile
              </span>
              <button
                type="button"
                onClick={() => setShowMissing((prev) => !prev)}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 font-medium mt-0.5"
                aria-expanded={showMissing}
              >
                <span>{completionScore === 100 ? "Complete" : "What's missing"}</span>
                <CopilotIcon
                  name="chevron-down"
                  className={`w-3 h-3 transition-transform ${showMissing ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* "What's missing" Disclosure Popover */}
            {showMissing && (
              <div
                className="absolute right-0 top-16 z-30 w-72 rounded-xl bg-[#111111] border border-neutral-800 p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                role="dialog"
                aria-label="Profile completeness checklist"
              >
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-xs font-semibold text-white tracking-wide">
                    Profile Checklist ({completionScore}%)
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
                    ✓ All 8 profile sections are complete!
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
                  href={`/u/${cleanUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 hover:border-neutral-700 transition-all"
                >
                  <CopilotIcon name="open" className="w-3.5 h-3.5" />
                  <span>Public profile</span>
                </Link>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-750 hover:border-neutral-700 transition-all"
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

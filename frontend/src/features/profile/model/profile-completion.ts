

export type ProfileMissingItem = {
  key: string;
  label: string;
  points?: number;
  href?: string;
  group?: string;
};

export type ProfileCompletionDetails = {
  missing?: ProfileMissingItem[];
  completed?: ProfileMissingItem[];
  total?: number;
  missing_count?: number;
  completed_points?: number;
  missing_points?: number;
};

export const PROFILE_UPDATED_EVENT = "career-copilot:profile-updated";

export type ProfileUpdatedDetail = {
  profile_completion?: number;
  profile_missing?: ProfileMissingItem[];
  profile_completion_details?: ProfileCompletionDetails | null;
};

const RETIRED_MISSING_KEYS = new Set(["resume"]);

export function notifyProfileUpdated(detail?: ProfileUpdatedDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: detail || {} }));
  } catch {
    void 0;
  }
}

export function extractMissing(
  details?: ProfileCompletionDetails | null,
  fallback?: ProfileMissingItem[] | null,
): ProfileMissingItem[] {
  const fromDetails = Array.isArray(details?.missing) ? details!.missing! : [];
  const fromFallback = Array.isArray(fallback) ? fallback : [];
  const raw = fromDetails.length > 0 ? fromDetails : fromFallback;
  return raw.filter(
    (item): item is ProfileMissingItem =>
      Boolean(item && item.label && item.key) && !RETIRED_MISSING_KEYS.has(String(item.key)),
  );
}

export function clampCompletion(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function resolveCompletion(
  stored: unknown,
  details?: ProfileCompletionDetails | null,
  missing?: ProfileMissingItem[] | null,
): number {
  if (details && typeof details.total === "number" && Number.isFinite(details.total)) {
    return clampCompletion(details.total);
  }
  if (details && typeof details.completed_points === "number" && Number.isFinite(details.completed_points)) {
    return clampCompletion(details.completed_points);
  }

  const list = extractMissing(details, missing);
  if (list.length > 0 && list.every((m) => typeof m.points === "number")) {
    const missingPts = list.reduce((sum, m) => sum + (Number(m.points) || 0), 0);
    if (missingPts >= 0 && missingPts <= 100) {
      const derived = clampCompletion(100 - missingPts);
      const fromStored = clampCompletion(stored);

      if (fromStored === 0 && derived > 0) return derived;
      if (Math.abs(fromStored + missingPts - 100) <= 1) return fromStored;
      return derived;
    }
  }

  return clampCompletion(stored);
}

export function applyLiveCompletionDetail(detail: ProfileUpdatedDetail | undefined): {
  completion: number;
  missing: ProfileMissingItem[];
} | null {
  if (
    !detail ||
    (detail.profile_completion == null &&
      !detail.profile_missing &&
      !detail.profile_completion_details)
  ) {
    return null;
  }
  const details = detail.profile_completion_details;
  const missing = extractMissing(details, detail.profile_missing);
  const completion = resolveCompletion(detail.profile_completion, details, missing);
  return { completion, missing };
}

export function sectionForMissingKey(key: string): string {
  const k = String(key || "").toLowerCase();
  if (k.includes("skill")) return "skills";
  if (k.includes("experience") || k.includes("employment")) return "background";
  if (k.includes("education") || k.includes("degree") || k.includes("institution")) return "background";
  if (k.includes("link") || k.includes("linkedin") || k.includes("github") || k.includes("portfolio")) return "about";
  if (k.includes("prefer") || k.includes("target_role") || k.includes("salary") || k.includes("work_mode")) return "preferences";
  if (k.includes("resume")) return "resume";
  return "about";
}

export function computeProfileCompleteness8(context: {
  fullName?: string | null;
  location?: string | null;
  currentRole?: string | null;
  yearsExperience?: number | string | null;
  skillsCount?: number;
  experienceCount?: number;
  educationCount?: number;
  linksCount?: number;
}): { percentage: number; missing: ProfileMissingItem[] } {
  let done = 0;
  const missing: ProfileMissingItem[] = [];

  // 1. full_name
  if (context.fullName && context.fullName.trim().length > 0) {
    done += 1;
  } else {
    missing.push({ key: "full_name", label: "Add your full name", points: 12.5, href: "#about" });
  }

  // 2. location
  if (context.location && context.location.trim().length > 0) {
    done += 1;
  } else {
    missing.push({ key: "location", label: "Add your location", points: 12.5, href: "#about" });
  }

  // 3. current_role
  if (context.currentRole && context.currentRole.trim().length > 0) {
    done += 1;
  } else {
    missing.push({ key: "current_role", label: "Add your current or target role", points: 12.5, href: "#about" });
  }

  // 4. years_experience (valid when numeric, even if 0)
  const yVal = context.yearsExperience;
  const yNum = yVal !== null && yVal !== undefined && yVal !== "" ? Number(yVal) : NaN;
  if (!Number.isNaN(yNum) && yNum >= 0) {
    done += 1;
  } else {
    missing.push({ key: "years_experience", label: "Add years of experience (0 for entry-level)", points: 12.5, href: "#about" });
  }

  // 5. skills (at least 1)
  if ((context.skillsCount || 0) > 0) {
    done += 1;
  } else {
    missing.push({ key: "skills", label: "Add at least one skill", points: 12.5, href: "#skills" });
  }

  // 6. experience (at least 1 or 0 years declared)
  if ((context.experienceCount || 0) > 0 || yNum === 0) {
    done += 1;
  } else {
    missing.push({ key: "experience", label: "Add work experience (or set 0 years)", points: 12.5, href: "#background" });
  }

  // 7. education (at least 1)
  if ((context.educationCount || 0) > 0) {
    done += 1;
  } else {
    missing.push({ key: "education", label: "Add your education", points: 12.5, href: "#background" });
  }

  // 8. links (at least 1)
  if ((context.linksCount || 0) > 0) {
    done += 1;
  } else {
    missing.push({ key: "links", label: "Add at least one profile link", points: 12.5, href: "#about" });
  }

  const percentage = Math.round((done / 8) * 100);
  return { percentage, missing };
}


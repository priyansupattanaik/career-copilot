export type ProfileSectionId = "resume" | "about" | "background" | "skills" | "preferences";

export const PROFILE_SECTIONS: readonly {
  id: ProfileSectionId;
  label: string;
  hash: string;
}[] = [
  { id: "resume", label: "Resume", hash: "#resume" },
  { id: "about", label: "About you", hash: "#about" },
  { id: "background", label: "Background", hash: "#background" },
  { id: "skills", label: "Skills", hash: "#skills" },
  { id: "preferences", label: "Job preferences", hash: "#preferences" },
] as const;

export const LEGACY_HASH_MAP: Record<string, ProfileSectionId> = {
  "profile-details": "about",
  "profile-resume": "resume",
  "profile-preferences": "preferences",
  "profile-skills": "skills",
  "profile-experience": "background",
  "profile-education": "background",
  "profile-links": "about",
};

export function resolveProfileHash(rawHash: string): ProfileSectionId {
  const clean = (rawHash || "").replace(/^#/, "").trim();
  if (LEGACY_HASH_MAP[clean]) {
    return LEGACY_HASH_MAP[clean];
  }
  const match = PROFILE_SECTIONS.find((s) => s.id === clean);
  return match ? match.id : "resume";
}

export function getCanonicalHashFor(section: ProfileSectionId): string {
  return `#${section}`;
}

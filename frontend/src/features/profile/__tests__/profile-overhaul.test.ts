import { describe, it, expect } from "vitest";
import {
  resolveProfileHash,
  PROFILE_SECTIONS,
  LEGACY_HASH_MAP,
} from "../model/profile-hash-navigation";
import {
  computeProfileCompleteness8,
  sectionForMissingKey,
} from "../model/profile-completion";
import {
  LOCATION_OPTIONS,
  ROLE_OPTIONS,
  DEGREE_OPTIONS,
  FIELD_OF_STUDY_OPTIONS,
  POPULAR_SKILL_OPTIONS,
} from "../model/profile-options";

describe("profile-overhaul navigation & hash resolution", () => {
  it("defines the 5 core sections", () => {
    const ids = PROFILE_SECTIONS.map((s) => s.id);
    expect(ids).toEqual(["resume", "about", "background", "skills", "preferences"]);
    expect(PROFILE_SECTIONS).toHaveLength(5);
  });

  it("correctly redirects legacy hashes to the new information architecture", () => {
    expect(Object.keys(LEGACY_HASH_MAP).length).toBeGreaterThanOrEqual(7);
    expect(resolveProfileHash("#profile-details")).toBe("about");
    expect(resolveProfileHash("#profile-resume")).toBe("resume");
    expect(resolveProfileHash("#profile-preferences")).toBe("preferences");
    expect(resolveProfileHash("#profile-skills")).toBe("skills");
    expect(resolveProfileHash("#profile-experience")).toBe("background");
    expect(resolveProfileHash("#profile-education")).toBe("background");
    expect(resolveProfileHash("#profile-links")).toBe("about");
  });

  it("supports canonical hashes without leading #", () => {
    expect(resolveProfileHash("about")).toBe("about");
    expect(resolveProfileHash("resume")).toBe("resume");
    expect(resolveProfileHash("background")).toBe("background");
    expect(resolveProfileHash("skills")).toBe("skills");
    expect(resolveProfileHash("preferences")).toBe("preferences");
  });

  it("falls back to resume for unknown hashes", () => {
    expect(resolveProfileHash("#unknown-hash")).toBe("resume");
    expect(resolveProfileHash("")).toBe("resume");
  });
});

describe("profile-overhaul 8-item completeness", () => {
  it("calculates 0% for an empty profile", () => {
    const res = computeProfileCompleteness8({});
    expect(res.percentage).toBe(0);
    expect(res.missing).toHaveLength(8);
  });

  it("calculates 100% when all 8 items are satisfied", () => {
    const res = computeProfileCompleteness8({
      fullName: "Alex Rivera",
      location: "San Francisco, CA",
      currentRole: "Senior Engineer",
      yearsExperience: 6,
      skillsCount: 5,
      experienceCount: 2,
      educationCount: 1,
      linksCount: 1,
    });
    expect(res.percentage).toBe(100);
    expect(res.missing).toHaveLength(0);
  });

  it("satisfies experience requirement for freshers (yearsExperience = 0)", () => {
    const res = computeProfileCompleteness8({
      fullName: "Aria Nova",
      location: "Bengaluru, India",
      currentRole: "Junior Developer",
      yearsExperience: 0,
      skillsCount: 3,
      experienceCount: 0, // 0 work history rows
      educationCount: 1,
      linksCount: 1,
    });
    // With 0 years declared, item 6 (experience or 0 yrs) is satisfied!
    expect(res.percentage).toBe(100);
    expect(res.missing).toHaveLength(0);
  });

  it("maps missing items to appropriate canonical sections", () => {
    expect(sectionForMissingKey("skills")).toBe("skills");
    expect(sectionForMissingKey("experience")).toBe("background");
    expect(sectionForMissingKey("education")).toBe("background");
    expect(sectionForMissingKey("full_name")).toBe("about");
    expect(sectionForMissingKey("current_role")).toBe("about");
    expect(sectionForMissingKey("links")).toBe("about");
    expect(sectionForMissingKey("resume")).toBe("resume");
  });
});

describe("profile-overhaul catalog options", () => {
  it("has rich location options including Remote and major tech hubs", () => {
    expect(LOCATION_OPTIONS).toContain("Remote");
    expect(LOCATION_OPTIONS).toContain("Bengaluru, Karnataka, India");
    expect(LOCATION_OPTIONS).toContain("San Francisco, CA, USA");
    expect(LOCATION_OPTIONS.length).toBeGreaterThan(10);
  });

  it("has common software engineering roles in role options", () => {
    expect(ROLE_OPTIONS).toContain("Software Engineer");
    expect(ROLE_OPTIONS).toContain("Frontend Engineer");
    expect(ROLE_OPTIONS).toContain("Backend Engineer");
    expect(ROLE_OPTIONS.length).toBeGreaterThan(10);
  });

  it("has standard degree and field of study options", () => {
    expect(DEGREE_OPTIONS).toContain("B.Tech");
    expect(DEGREE_OPTIONS).toContain("M.S.");
    expect(FIELD_OF_STUDY_OPTIONS).toContain("Computer Science");
  });

  it("has popular engineering skills for autocomplete", () => {
    expect(POPULAR_SKILL_OPTIONS).toContain("Python");
    expect(POPULAR_SKILL_OPTIONS).toContain("TypeScript");
    expect(POPULAR_SKILL_OPTIONS).toContain("React");
    expect(POPULAR_SKILL_OPTIONS).toContain("Docker");
  });
});

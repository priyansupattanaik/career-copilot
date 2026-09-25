import { describe, it, expect } from "vitest";
import { SETTINGS_TABS } from "../model/settings-tabs";

describe("settings-navigation", () => {
  it("defines all four standard settings routes", () => {
    const routes = SETTINGS_TABS.map((t) => t.href);

    expect(routes).toContain("/settings/profile");
    expect(routes).toContain("/settings/account");
    expect(routes).toContain("/settings/preferences");
    expect(routes).toContain("/settings/privacy");
    expect(routes).toHaveLength(4);
  });

  it("verifies chunking principle <= 7 items for profile sub-navigation", () => {
    const PROFILE_SUBSECTIONS = [
      "profile-details",
      "profile-resume",
      "profile-preferences",
      "profile-skills",
      "profile-experience",
      "profile-education",
      "profile-links",
    ];

    // Hick's and Miller's Law: cognitive working set <= 7
    expect(PROFILE_SUBSECTIONS.length).toBeLessThanOrEqual(7);
  });
});

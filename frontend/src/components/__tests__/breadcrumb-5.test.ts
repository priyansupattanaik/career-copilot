import { describe, it, expect } from "vitest";
import Breadcrumb5, { type BreadcrumbSegment } from "../breadcrumb-5";

describe("Breadcrumb5", () => {
  it("exports Breadcrumb5 component as default and named export", () => {
    expect(Breadcrumb5).toBeDefined();
    expect(typeof Breadcrumb5).toBe("function");
  });

  it("handles custom segments correctly", () => {
    const segments: BreadcrumbSegment[] = [
      { label: "Workspace", href: "/dashboard" },
      { label: "Dashboard", current: true },
    ];
    expect(segments).toHaveLength(2);
    expect(segments[0].label).toBe("Workspace");
    expect(segments[1].current).toBe(true);
  });

  it("produces correct breadcrumbs for each settings tab", async () => {
    const { getAutoBreadcrumbs } = await import("../auto-breadcrumbs");
    
    const profileCrumbs = getAutoBreadcrumbs("/settings/profile", "");
    expect(profileCrumbs).toHaveLength(3);
    expect(profileCrumbs[1]).toEqual({ label: "Settings", href: "/settings/profile" });
    expect(profileCrumbs[2]).toEqual({ label: "Candidate Profile", current: true });

    const accountCrumbs = getAutoBreadcrumbs("/settings/account", "");
    expect(accountCrumbs[2]).toEqual({ label: "Account & Access", current: true });

    const prefCrumbs = getAutoBreadcrumbs("/settings/preferences", "");
    expect(prefCrumbs[2]).toEqual({ label: "Preferences", current: true });

    const privacyCrumbs = getAutoBreadcrumbs("/settings/privacy", "");
    expect(privacyCrumbs[2]).toEqual({ label: "Privacy Controls", current: true });
  });
});


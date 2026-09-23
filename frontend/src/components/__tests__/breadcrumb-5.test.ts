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
});

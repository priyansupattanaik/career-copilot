import { describe, it, expect } from "vitest";
import { routes } from "../routes";

describe("routes", () => {
  it("defines standard application routes", () => {
    expect(routes.home).toBe("/");
    expect(routes.dashboard).toBe("/dashboard");
    expect(routes.resume).toBe("/resume-analysis");
    expect(routes.interview).toBe("/mock-interview");
    expect(routes.learning).toBe("/learning");
    expect(routes.jobs).toBe("/jobs");
    expect(routes.settings).toBe("/settings/profile");
  });

  it("does not include resume-studio in routes", () => {
    expect((routes as Record<string, string>).resumeStudio).toBeUndefined();
    expect(Object.values(routes)).not.toContain("/resume-studio");
  });
});

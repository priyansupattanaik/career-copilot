import { describe, it, expect } from "vitest";
import {
  clampCompletion,
  extractMissing,
  resolveCompletion,
  applyLiveCompletionDetail,
  type ProfileCompletionDetails,
  type ProfileMissingItem,
} from "../model/profile-completion";

describe("profile-completion", () => {
  describe("clampCompletion", () => {
    it("clamps values between 0 and 100", () => {
      expect(clampCompletion(-10)).toBe(0);
      expect(clampCompletion(0)).toBe(0);
      expect(clampCompletion(45.6)).toBe(46);
      expect(clampCompletion(100)).toBe(100);
      expect(clampCompletion(120)).toBe(100);
    });

    it("handles non-finite values safely", () => {
      expect(clampCompletion(NaN)).toBe(0);
      expect(clampCompletion(null)).toBe(0);
      expect(clampCompletion(undefined)).toBe(0);
      expect(clampCompletion("invalid")).toBe(0);
    });
  });

  describe("extractMissing", () => {
    it("extracts valid missing items and filters out retired keys like resume", () => {
      const details: ProfileCompletionDetails = {
        missing: [
          { key: "headline", label: "Add headline", points: 10 },
          { key: "resume", label: "Upload resume", points: 15 },
          { key: "skills", label: "Add skills", points: 20 },
        ],
      };

      const extracted = extractMissing(details);
      expect(extracted).toHaveLength(2);
      expect(extracted.map((m) => m.key)).toEqual(["headline", "skills"]);
    });

    it("falls back to fallback list when details has no missing array", () => {
      const fallback: ProfileMissingItem[] = [
        { key: "education", label: "Add education", points: 15 },
      ];
      const extracted = extractMissing(null, fallback);
      expect(extracted).toHaveLength(1);
      expect(extracted[0].key).toBe("education");
    });
  });

  describe("resolveCompletion", () => {
    it("prefers details.total if present and finite", () => {
      expect(resolveCompletion(50, { total: 85 })).toBe(85);
    });

    it("prefers details.completed_points if total is absent", () => {
      expect(resolveCompletion(50, { completed_points: 90 })).toBe(90);
    });

    it("derives completion from missing items if points are available", () => {
      const details: ProfileCompletionDetails = {
        missing: [
          { key: "skills", label: "Skills", points: 20 },
          { key: "experience", label: "Experience", points: 10 },
        ],
      };
      // Stored is 0, derived is 100 - 30 = 70
      expect(resolveCompletion(0, details)).toBe(70);
    });

    it("falls back to stored completion if details are not provided", () => {
      expect(resolveCompletion(65)).toBe(65);
    });
  });

  describe("applyLiveCompletionDetail", () => {
    it("returns null when detail is empty or lacks fields", () => {
      expect(applyLiveCompletionDetail(undefined)).toBeNull();
      expect(applyLiveCompletionDetail({})).toBeNull();
    });

    it("returns calculated completion and filtered missing items", () => {
      const result = applyLiveCompletionDetail({
        profile_completion: 80,
        profile_completion_details: {
          missing: [
            { key: "links", label: "Add link", points: 10 },
            { key: "resume", label: "Resume", points: 10 },
          ],
        },
      });

      expect(result).not.toBeNull();
      expect(result?.completion).toBe(90); // 100 - 10 (resume filtered out)
      expect(result?.missing).toHaveLength(1);
      expect(result?.missing[0].key).toBe("links");
    });
  });
});

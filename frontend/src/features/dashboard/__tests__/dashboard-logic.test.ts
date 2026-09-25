import { describe, it, expect } from "vitest";
import {
  computeCareerReadiness,
  getReadinessTier,
  getReadinessHint,
  resolveNextAction,
} from "../model/dashboard-logic";

describe("Dashboard Psychological Decision Engine", () => {
  it("calculates readiness score as authentic milestone composite across pillars", () => {
    // Brand new user with 0% profile, no resume, no interview
    expect(computeCareerReadiness(0, null, null, false)).toBe(0);

    // Profile only (e.g. 60% completion = 12 pts)
    expect(computeCareerReadiness(60, null, null, false)).toBe(12);

    // Profile 100% completed, but no resume uploaded yet -> exactly 20 pts (Foundational)
    // NEVER falsely claims 100% Elite Ready for empty resumes!
    expect(computeCareerReadiness(100, null, null, false)).toBe(20);

    // Profile 100% + Confirmed Master Resume uploaded (awaiting ATS scan) -> 20 + 15 = 35 pts
    expect(computeCareerReadiness(100, null, null, true)).toBe(35);

    // Profile 100% + Confirmed Resume + ATS match scan of 70% -> 20 + 28 = 48 pts (Advancing)
    expect(computeCareerReadiness(100, 70, null, true)).toBe(48);

    // Completing mock interview with 80/100 -> 20 + 28 + 32 = 80 pts (Job Ready)
    // Progress strictly advances and never drops!
    expect(computeCareerReadiness(100, 70, 80, true)).toBe(80);

    // Strong candidate: 100% profile, 90% ATS, 90 interview -> 20 + 36 + 36 = 92 pts (Elite Ready)
    expect(computeCareerReadiness(100, 90, 90, true)).toBe(92);

    // Object parameter form
    expect(
      computeCareerReadiness({
        completion: 100,
        hasConfirmedResume: true,
        atsScore: 85,
        interviewLatest: 85,
      }),
    ).toBe(88);
  });

  it("maps readiness score to appropriate motivational tier boundaries", () => {
    expect(getReadinessTier(100).label).toBe("Elite Ready");
    expect(getReadinessTier(85).label).toBe("Elite Ready");
    expect(getReadinessTier(84).label).toBe("Job Ready");
    expect(getReadinessTier(70).label).toBe("Job Ready");
    expect(getReadinessTier(69).label).toBe("Advancing");
    expect(getReadinessTier(45).label).toBe("Advancing");
    expect(getReadinessTier(44).label).toBe("Foundational");
    expect(getReadinessTier(0).label).toBe("Foundational");
  });

  it("strictly enforces monotonicity: completing new milestones never decreases readiness score", () => {
    const s0 = computeCareerReadiness({ completion: 100, hasConfirmedResume: false, atsScore: null, interviewLatest: null });
    const s1 = computeCareerReadiness({ completion: 100, hasConfirmedResume: true, atsScore: null, interviewLatest: null });
    const s2 = computeCareerReadiness({ completion: 100, hasConfirmedResume: true, atsScore: 65, interviewLatest: null });
    const s3 = computeCareerReadiness({ completion: 100, hasConfirmedResume: true, atsScore: 65, interviewLatest: 70 });
    const s4 = computeCareerReadiness({ completion: 100, hasConfirmedResume: true, atsScore: 85, interviewLatest: 70 });
    const s5 = computeCareerReadiness({ completion: 100, hasConfirmedResume: true, atsScore: 85, interviewLatest: 90 });

    expect(s1).toBeGreaterThanOrEqual(s0);
    expect(s2).toBeGreaterThanOrEqual(s1);
    expect(s3).toBeGreaterThanOrEqual(s2);
    expect(s4).toBeGreaterThanOrEqual(s3);
    expect(s5).toBeGreaterThanOrEqual(s4);
  });

  it("returns honest readiness hints without fabricated percentiles or cohort claims", () => {
    expect(getReadinessHint(90)).toBe("Optimal readiness across tracked milestones");
    expect(getReadinessHint(75)).toBe("Competitive readiness across resume & interview");
    expect(getReadinessHint(55)).toBe("Advancing foundation; continue targeted practice");
    expect(getReadinessHint(30)).toBe("Follow the recommended step below to increase readiness");
  });

  it("prioritizes Step 1 (Upload Resume) when no confirmed resume exists (Hick's Law)", () => {
    const action = resolveNextAction({
      hasConfirmedResume: false,
      hasInterviewScores: false,
      interviewLatest: null,
      atsScore: null,
    });
    expect(action.step).toBe(1);
    expect(action.cta).toBe("Upload Resume");
  });

  it("prioritizes Step 2 (Run ATS Scan) when resume exists but no ATS scan performed", () => {
    const action = resolveNextAction({
      hasConfirmedResume: true,
      hasInterviewScores: false,
      interviewLatest: null,
      atsScore: null,
    });
    expect(action.step).toBe(2);
    expect(action.cta).toBe("Run ATS Scan");
  });

  it("prioritizes Step 3 (First Mock Interview) when resume & ATS scan exist but no interview completed", () => {
    const action = resolveNextAction({
      hasConfirmedResume: true,
      hasInterviewScores: false,
      interviewLatest: null,
      atsScore: 82,
    });
    expect(action.step).toBe(3);
    expect(action.cta).toBe("Start Mock Interview");
  });

  it("prioritizes Step 4 (ATS Calibration) when interview exists but ATS score < 75%", () => {
    const action = resolveNextAction({
      hasConfirmedResume: true,
      hasInterviewScores: true,
      interviewLatest: 82,
      atsScore: 68,
    });
    expect(action.step).toBe(4);
    expect(action.cta).toBe("Optimize ATS Score");
  });

  it("prioritizes Step 5 (Interview Calibration) when ATS is high but interview score < 75", () => {
    const action = resolveNextAction({
      hasConfirmedResume: true,
      hasInterviewScores: true,
      interviewLatest: 68,
      atsScore: 85,
    });
    expect(action.step).toBe(5);
    expect(action.cta).toBe("Practice Interview");
  });

  it("recommends Continuous Mastery when interview & ATS match are strong", () => {
    const action = resolveNextAction({
      hasConfirmedResume: true,
      hasInterviewScores: true,
      interviewLatest: 88,
      atsScore: 84,
    });
    expect(action.step).toBe(6);
    expect(action.cta).toBe("Launch Practice Drill");
  });
});

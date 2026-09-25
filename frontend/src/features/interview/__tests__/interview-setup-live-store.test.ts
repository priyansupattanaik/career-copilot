import { describe, it, expect, beforeEach } from "vitest";
import {
  createLiveInterview,
  saveLiveInterview,
  loadLiveInterview,
  clearLiveInterview,
  isLiveSessionId,
  LIVE_SESSION_PREFIX,
  type LiveSetup,
} from "../live-store";

describe("live-store integration for setup flow", () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  });

  it("creates a live interview matching user setup preferences", () => {
    const setup: LiveSetup = {
      mode: "behavioural",
      target_role: "Principal Engineer",
      difficulty: "challenging",
      question_count: 5,
      camera_enabled: true,
      microphone_enabled: true,
      job_description_text: "Lead high-scale distributed systems teams.",
      resume_version_id: "ver-999",
      job_description_id: "jd-123",
    };

    const session = createLiveInterview(setup);

    expect(isLiveSessionId(session.id)).toBe(true);
    expect(session.id.startsWith(LIVE_SESSION_PREFIX)).toBe(true);
    expect(session.setup).toEqual(setup);
    expect(session.questions.length).toBe(5);
    expect(session.responses).toEqual([]);
  });

  it("persists and reloads live interview through sessionStorage", () => {
    const setup: LiveSetup = {
      mode: "technical",
      target_role: "Staff Frontend Engineer",
      difficulty: "balanced",
      question_count: 3,
      camera_enabled: false,
      microphone_enabled: true,
      job_description_text: null,
      resume_version_id: null,
      job_description_id: null,
    };

    const session = createLiveInterview(setup);
    saveLiveInterview(session);

    const loaded = loadLiveInterview();
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(session.id);
    expect(loaded?.setup.camera_enabled).toBe(false);
    expect(loaded?.questions.length).toBe(3);

    clearLiveInterview();
    expect(loadLiveInterview()).toBeNull();
  });
});

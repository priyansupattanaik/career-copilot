import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LearningHome } from "../components/learning";

const apiRequest = vi.fn();

vi.mock("@/shared/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
  isAbortError: () => false,
}));

function renderHome() {
  return render(
    <MemoryRouter>
      <LearningHome />
    </MemoryRouter>,
  );
}

describe("LearningHome", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("asks for a completed ATS analysis before generating a path", async () => {
    apiRequest.mockImplementation(async (path: string) => {
      if (path === "/learning-paths") return [];
      if (path === "/ats-analyses") return [];
      throw new Error(`unexpected ${path}`);
    });
    renderHome();
    await waitFor(() => {
      expect(screen.getByText("No completed ATS analysis yet")).toBeTruthy();
    });
    expect(screen.getByText("Generate from ATS gaps")).toBeTruthy();
  });

  it("generates from the selected ATS analysis id", async () => {
    apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/learning-paths") return [];
      if (path === "/ats-analyses") {
        return [
          {
            id: "ats-1",
            status: "completed",
            overall_score: 61,
            created_at: "2026-01-01T00:00:00Z",
            summary: { missing: 2, missing_terms: ["Docker", "Kubernetes"] },
            job_description: { role_title: "Backend Engineer", company: "Northstar Labs" },
            resume: { title: "Priya resume" },
          },
        ];
      }
      if (path === "/learning-paths/generate") {
        const body = JSON.parse(String(init?.body || "{}"));
        expect(body.source_analysis_id).toBe("ats-1");
        return { id: "path-1", title: "Skill gap path", progress_percentage: 0, status: "active", items: [] };
      }
      throw new Error(`unexpected ${path}`);
    });
    renderHome();
    await waitFor(() => {
      expect(screen.getByText(/Backend Engineer/)).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate from ATS gaps" }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        "/learning-paths/generate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

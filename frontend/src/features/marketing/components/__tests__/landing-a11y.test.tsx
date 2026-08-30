import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "../landing";
import { ThemeProvider } from "@/shared/theme";

function renderLanding() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LandingPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Landing page a11y & labelling", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    });
  });

  it("opens mobile dialog with aria-modal and closes on Escape restoring focus", async () => {
    renderLanding();
    const openBtn = await screen.findByRole("button", { name: /Open navigation/i });
    await act(async () => {
      openBtn.focus();
      fireEvent.click(openBtn);
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("labels the practice workspace visual without unsupported values", async () => {
    renderLanding();
    const dashboard = screen.getByRole("img", { name: /video interview practice workspace/i });
    expect(dashboard.getAttribute("aria-label")?.toLowerCase()).not.toMatch(/undefined|null|\[object/i);
    expect(screen.getByLabelText(/Candidate giving an interview/i)).toBeTruthy();
  });
});

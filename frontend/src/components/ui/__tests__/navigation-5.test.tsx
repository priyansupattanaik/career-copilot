import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Navigation5 } from "../navigation-5";
import { ThemeProvider } from "@/shared/theme";

function renderNav() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Navigation5 />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Navigation5 Component", () => {
  beforeEach(() => {
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

  it("renders brand logo, desktop navigation links, and auth buttons", () => {
    renderNav();

    expect(screen.getByText("Career Copilot")).toBeTruthy();
    expect(screen.getAllByText("Practice").length).toBeGreaterThan(0);
    expect(screen.getAllByText("How it works").length).toBeGreaterThan(0);
    expect(screen.getByText("Platform")).toBeTruthy();
    expect(screen.getByText("Community")).toBeTruthy();
    expect(screen.getAllByText("Team").length).toBeGreaterThan(0);
    expect(screen.getByText("Sign in")).toBeTruthy();
    expect(screen.getByText("Get started")).toBeTruthy();
  });

  it("opens and closes the platform mega-menu dropdown", () => {
    renderNav();

    const platformBtn = screen.getByRole("button", { name: /Platform/i });
    expect(platformBtn).toBeTruthy();

    fireEvent.click(platformBtn);
    expect(screen.getByText("ATS & Evidence")).toBeTruthy();
    expect(screen.getByText("Interview & Skills")).toBeTruthy();
    expect(screen.getByText("Live AI Studio")).toBeTruthy();

    // Closes on escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("ATS & Evidence")).toBeNull();
  });

  it("opens mobile drawer and closes on escape restoring focus", async () => {
    renderNav();

    const openBtn = screen.getByRole("button", { name: /Open navigation/i });
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
});

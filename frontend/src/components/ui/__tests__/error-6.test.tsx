import type { ReactNode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemErrorPanel } from "../error-6";
import { ErrorBoundary } from "../error-boundary";

describe("SystemErrorPanel (Error-6)", () => {
  it("renders default 404 error code and content", () => {
    render(
      <MemoryRouter>
        <SystemErrorPanel />
      </MemoryRouter>,
    );

    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.getByText("Page Not Found")).toBeTruthy();
    expect(screen.getByText("This destination isn’t accessible.")).toBeTruthy();
    expect(screen.getByText("Return to Dashboard")).toBeTruthy();
    expect(screen.getByText("Go back")).toBeTruthy();
  });

  it("renders custom code, title, and action callback", () => {
    const handleAction = vi.fn();
    const handleSecondary = vi.fn();

    render(
      <MemoryRouter>
        <SystemErrorPanel
          code="500"
          eyebrow="Server Error"
          title="Custom Failure"
          description="Something went wrong internally."
          buttonLabel="Try Again"
          onAction={handleAction}
          secondaryLabel="Custom Secondary"
          onSecondaryAction={handleSecondary}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("500")).toBeTruthy();
    expect(screen.getByText("Server Error")).toBeTruthy();
    expect(screen.getByText("Custom Failure")).toBeTruthy();
    expect(screen.getByText("Something went wrong internally.")).toBeTruthy();

    const actionBtn = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(actionBtn);
    expect(handleAction).toHaveBeenCalledTimes(1);

    const secondaryBtn = screen.getByRole("button", {
      name: /custom secondary/i,
    });
    fireEvent.click(secondaryBtn);
    expect(handleSecondary).toHaveBeenCalledTimes(1);
  });

  it("renders interactive background grid cells", () => {
    const { container } = render(
      <MemoryRouter>
        <SystemErrorPanel />
      </MemoryRouter>,
    );

    const gridMask = container.querySelector(".error-6-grid-mask");
    expect(gridMask).toBeTruthy();

    const firstCell = gridMask?.querySelector(".border") as HTMLElement;
    expect(firstCell).toBeTruthy();

    fireEvent.mouseEnter(firstCell);
    fireEvent.mouseLeave(firstCell);
  });
});

describe("ErrorBoundary", () => {
  function CrashingComponent(): ReactNode {
    throw new Error("Crash simulation error");
  }

  it("catches render errors and renders SystemErrorPanel fallback", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <CrashingComponent />
        </ErrorBoundary>
      </MemoryRouter>,
    );

    expect(screen.getByText("500")).toBeTruthy();
    expect(screen.getByText("Something unexpected happened")).toBeTruthy();
    expect(screen.getByText("Crash simulation error")).toBeTruthy();
    expect(screen.getByText("Reload application")).toBeTruthy();

    spy.mockRestore();
  });
});

import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import LoadingState from "../loading-state";

describe("LoadingState", () => {
  it("renders nine grid cells with the wavefront animation", () => {
    const { container } = render(<LoadingState label="Churning" variant="Drive" />);
    const dots = container.querySelectorAll("span[aria-hidden] > span");
    expect(dots.length).toBe(9);
    const first = dots[0] as HTMLElement;
    expect(first.style.animation).toContain("pixel-on");
    expect(first.style.animation).toContain("650ms");
  });

  it("orbit variant parks the center cell and uses its duration", () => {
    const { container } = render(<LoadingState label="Searching" variant="Orbit" />);
    const dots = Array.from(container.querySelectorAll("span[aria-hidden] > span")) as HTMLElement[];
    expect(dots[4].style.animation).toBe("none");
    expect(dots[4].style.opacity).toBe("0.07");
    expect(dots[0].style.animation).toContain("950ms");
  });

  it("shimmers the label and shows a ticking tabular timer", () => {
    vi_useFakeTimers();
    const { container, unmount } = render(<LoadingState label="Thinking" variant="Dots" />);
    const root = container.firstElementChild as HTMLElement;
    const label = root.children[1] as HTMLElement;
    expect(label.style.animation).toContain("shimmer-text");
    expect(label.style.backgroundImage).toContain("var(--muted-foreground)");
    expect(screen.getByText("Thinking")).toBeTruthy();

    const timer = root.children[2] as HTMLElement;
    expect(timer.textContent).toBe("0.0s");
    act(() => {
      vi_advanceTimers(700);
    });
    expect(timer.textContent).toBe("0.7s");
    unmount();
    vi_restoreTimers();
  });
});

/* Minimal fake-timer helpers (vitest timers API without importing hooks twice). */
import { vi } from "vitest";
function vi_useFakeTimers() {
  vi.useFakeTimers();
}
function vi_advanceTimers(ms: number) {
  vi.advanceTimersByTime(ms);
}
function vi_restoreTimers() {
  vi.useRealTimers();
}

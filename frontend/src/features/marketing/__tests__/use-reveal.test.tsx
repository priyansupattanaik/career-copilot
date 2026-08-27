import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useReveal } from "../use-reveal";

type IoInstance = {
  callback: IntersectionObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

let lastIo: IoInstance | null = null;

function Probe() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div data-testid="probe" ref={ref}>
      content
    </div>
  );
}

describe("useReveal", () => {
  beforeEach(() => {
    lastIo = null;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 1400,
      top: 1400,
      bottom: 1700,
      left: 0,
      right: 320,
      width: 320,
      height: 300,
      toJSON() {
        return {};
      },
    } as DOMRect);
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
    class MockIO {
      callback: IntersectionObserverCallback;
      observe = vi.fn();
      disconnect = vi.fn();
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
        // The mock instance must be captured for the test callback below.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        lastIo = this;
      }
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", MockIO);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reveals when the observer reports an intersecting entry", () => {
    const { getByTestId } = render(<Probe />);
    const el = getByTestId("probe");
    expect(el.classList.contains("home-reveal")).toBe(true);

    act(() => {
      lastIo?.callback(
        [
          {
            isIntersecting: true,
            boundingClientRect: { top: 120, bottom: 400, left: 0, right: 100, width: 100, height: 280 } as DOMRectReadOnly,
            intersectionRatio: 0.4,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: el,
            time: 0,
          },
        ],
        lastIo as unknown as IntersectionObserver,
      );
    });

    expect(el.classList.contains("home-revealed")).toBe(true);
  });

  it("reveals when a fast scroll skips past the element without intersecting", () => {
    const { getByTestId } = render(<Probe />);
    const el = getByTestId("probe");

    act(() => {
      lastIo?.callback(
        [
          {
            isIntersecting: false,
            boundingClientRect: { top: -308, bottom: -40, left: 0, right: 100, width: 100, height: 268 } as DOMRectReadOnly,
            intersectionRatio: 0,
            intersectionRect: {} as DOMRectReadOnly,
            rootBounds: null,
            target: el,
            time: 0,
          },
        ],
        lastIo as unknown as IntersectionObserver,
      );
    });

    expect(el.classList.contains("home-revealed")).toBe(true);
  });
});

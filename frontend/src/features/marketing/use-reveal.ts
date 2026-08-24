import { useLayoutEffect, useRef } from "react";

export interface RevealOptions {
  /** Stagger delay in ms before the transition starts. */
  delay?: number;
  /** Resting translate offset in px while waiting to be revealed. */
  y?: number;
  /** Fraction of the element that must be visible to trigger (0..1). */
  threshold?: number;
}

/**
 * Adds `.home-reveal` pre-paint, then flips to `.home-revealed` when the
 * element enters the viewport. Elements are only hidden when this hook runs,
 * so a no-JS render or `prefers-reduced-motion` keeps everything visible.
 */
export function useReveal<T extends HTMLElement>(options: RevealOptions = {}) {
  const ref = useRef<T | null>(null);
  const { delay = 0, y = 22, threshold = 0.16 } = options;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") return;

    el.style.setProperty("--reveal-delay", `${delay}ms`);
    el.style.setProperty("--reveal-y", `${y}px`);
    el.classList.add("home-reveal");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("home-revealed");
            io.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options are static per call site
  }, []);

  return ref;
}

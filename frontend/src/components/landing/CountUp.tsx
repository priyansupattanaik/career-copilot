import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

export function CountUp({ end, duration = 1200, suffix = "", prefix = "", decimals = 0 }: {
  end: number; duration?: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(end); return; }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(end * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, end, inView]);
  return <span ref={ref}>{prefix}{value.toFixed(decimals)}{suffix}</span>;
}

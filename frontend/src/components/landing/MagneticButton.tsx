import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function MagneticButton({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });

  useEffect(() => {
    const query = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    const onMove = (event: PointerEvent) => {
      const bounds = ref.current?.getBoundingClientRect();
      if (!bounds) return;
      const dx = event.clientX - (bounds.left + bounds.width / 2);
      const dy = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(dx, dy);
      if (distance > 60) { x.set(0); y.set(0); return; }
      const amount = (1 - distance / 60) * 8;
      x.set((dx / Math.max(distance, 1)) * amount);
      y.set((dy / Math.max(distance, 1)) * amount);
    };
    const onLeave = () => { x.set(0); y.set(0); };
    const node = ref.current;
    if (query.matches) {
      window.addEventListener("pointermove", onMove, { passive: true });
      node?.addEventListener("pointerleave", onLeave);
    }
    return () => {
      window.removeEventListener("pointermove", onMove);
      node?.removeEventListener("pointerleave", onLeave);
    };
  }, [x, y]);

  return <motion.span ref={ref} style={{ x, y, display: "inline-block" }}>{children}</motion.span>;
}

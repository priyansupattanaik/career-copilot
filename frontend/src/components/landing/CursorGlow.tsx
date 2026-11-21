import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const x = useSpring(useMotionValue(-220), { stiffness: 50, damping: 20 });
  const y = useSpring(useMotionValue(-220), { stiffness: 50, damping: 20 });

  useEffect(() => {
    const query = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(query.matches);
    const move = (event: PointerEvent) => {
      x.set(event.clientX - 200);
      y.set(event.clientY - 200);
    };
    update();
    query.addEventListener("change", update);
    if (query.matches) window.addEventListener("pointermove", move, { passive: true });
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("pointermove", move);
    };
  }, [x, y]);

  if (!enabled) return null;
  return <motion.div className="landing-cursor-glow" style={{ x, y }} aria-hidden="true" />;
}

import { useEffect, useMemo, type CSSProperties, type HTMLAttributes } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

type StarsBackgroundProps = HTMLAttributes<HTMLDivElement> & {
  starColor?: string;
  paused?: boolean;
  quantity?: number;
};

type Star = { left: string; top: string; size: number; opacity: number; duration: number; delay: number };

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function StarsBackground({ starColor = "#fff", paused = false, quantity = 180, className = "", ...props }: StarsBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 50, damping: 20 });
  const springY = useSpring(pointerY, { stiffness: 50, damping: 20 });
  const stars = useMemo<Star[]>(
    () => Array.from({ length: quantity }, (_, index) => ({
      left: `${(seededRandom(index + 1) * 100).toFixed(3)}%`,
      top: `${(seededRandom(index + 101) * 100).toFixed(3)}%`,
      size: Number((seededRandom(index + 201) * 2.6 + 1.1).toFixed(2)),
      opacity: Number((seededRandom(index + 301) * 0.35 + 0.65).toFixed(2)),
      duration: Number((seededRandom(index + 401) * 4 + 3).toFixed(2)),
      delay: Number((seededRandom(index + 501) * -6).toFixed(2)),
    })),
    [quantity],
  );

  useEffect(() => {
    if (paused || reducedMotion) return;
    const handlePointerMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * -10);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * -10);
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [paused, pointerX, pointerY, reducedMotion]);

  return (
    <div
      {...props}
      className={`stars-background${className ? ` ${className}` : ""}`}
      style={{ ...props.style, ["--star-color" as string]: starColor } as CSSProperties}
      aria-hidden="true"
    >
      <motion.div
        className="stars-background-layer"
        style={{ x: reducedMotion || paused ? 0 : springX, y: reducedMotion || paused ? 0 : springY }}
        data-paused={paused || reducedMotion ? "true" : "false"}
      >
        {stars.map((star, index) => (
          <i key={index} className="stars-background-star" style={{ left: star.left, top: star.top, width: `${star.size}px`, height: `${star.size}px`, opacity: star.opacity, animationDuration: `${star.duration}s`, animationDelay: `${star.delay}s` }} />
        ))}
      </motion.div>
    </div>
  );
}

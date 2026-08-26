import { motion, useReducedMotion } from "motion/react";
import type { LucideProps } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

type LucideIcon = ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>;

export function AnimatedIcon({ icon: Icon, className, ...props }: LucideProps & { icon: LucideIcon }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.span
      className={className ? `animated-icon ${className}` : "animated-icon"}
      aria-hidden={props["aria-label"] ? undefined : true}
      whileHover={reducedMotion ? undefined : { scale: 1.12, y: -1 }}
      whileTap={reducedMotion ? undefined : { scale: 0.9, y: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 22, mass: 0.55 }}
    >
      <Icon {...props} />
    </motion.span>
  );
}

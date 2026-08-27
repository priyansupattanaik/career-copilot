import type { ReactNode, SVGProps } from "react";
import { motion, useReducedMotion } from "motion/react";

export type CareerIconName =
  | "dashboard"
  | "resume"
  | "interview"
  | "learning"
  | "opportunities"
  | "profile"
  | "evidence"
  | "signal"
  | "confidence";

type CareerIconProps = SVGProps<SVGSVGElement> & {
  name: CareerIconName;
  size?: number;
};

const paths: Record<CareerIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M7 15.5v-3M10.5 15.5V9M14 15.5v-5M17.5 15.5V7" />
      <path d="M7 8.5h2M14 5.8h3.5" opacity=".55" />
    </>
  ),
  resume: (
    <>
      <path d="M6.5 3.5h8l3 3v14h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="M14.5 3.8v3h3M8 11h6M8 14.5h6M8 18h4" />
      <path d="m15.7 13.8 1 1 2.1-2.2" />
    </>
  ),
  interview: (
    <>
      <rect x="3.5" y="5" width="17" height="13" rx="3.5" />
      <path d="m8 18 1.8 2.5L12 18M9 9.5h6M9 13h3" />
      <circle cx="17" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  learning: (
    <>
      <path d="M4 5.5a2 2 0 0 1 2-2h5v15H6a2 2 0 0 0-2 2V5.5ZM20 5.5a2 2 0 0 0-2-2h-5v15h5a2 2 0 0 1 2 2V5.5Z" />
      <path d="M7.5 7.5h1.8M7.5 10.5h1.8M15.2 7.5H17M15.2 10.5H17" />
    </>
  ),
  opportunities: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5v4M20.5 12h-4M12 20.5v-4M3.5 12h4" />
      <path d="m12 8.2 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.5-2.5 1.5.6-2.8-2.1-1.9 2.8-.3L12 8.2Z" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20c.6-3.2 2.7-5 6.5-5s5.9 1.8 6.5 5" />
      <path d="M4 4.5v3M4 4.5h3M20 19.5v-3M20 19.5h-3" />
    </>
  ),
  evidence: (
    <>
      <path d="M4 6.5h16M4 11.5h10M4 16.5h7" />
      <circle cx="18" cy="15.5" r="3.5" />
      <path d="m16.5 15.5 1 1 1.8-2" />
    </>
  ),
  signal: (
    <>
      <path d="M4 16.5c2.5 0 2.5-9 5-9s2.5 9 5 9 2.5-9 6-9" />
      <path d="M4 20h16" opacity=".45" />
      <circle cx="9" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  confidence: (
    <>
      <path d="M12 3.5 19 6v5.2c0 4.2-2.5 7.2-7 9.3-4.5-2.1-7-5.1-7-9.3V6l7-2.5Z" />
      <path d="m8.3 12 2.2 2.2 5-5" />
    </>
  ),
};

export function CareerIcon({ name, size = 22, className, ...props }: CareerIconProps) {
  const reducedMotion = useReducedMotion();
  // Avoid leaking motion-only props into the raw <svg>; cast to bypass
  // SVGProps vs SVGMotionProps incompatibility (onDrag / onAnimation*).
  const svgProps = props as unknown as SVGProps<SVGSVGElement>;

  return (
    <motion.span
      className="career-icon"
      initial={reducedMotion ? false : { opacity: 0.72, scale: 0.94 }}
      animate={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
      whileHover={reducedMotion ? undefined : { scale: 1.12, rotate: name === "opportunities" ? 8 : 0 }}
      whileTap={reducedMotion ? undefined : { scale: 0.9 }}
      transition={{ type: "spring", stiffness: 420, damping: 22, mass: 0.55 }}
    >
      <svg
        {...svgProps}
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={(svgProps as { "aria-label"?: string })["aria-label"] ? undefined : true}
      >
        {paths[name]}
      </svg>
    </motion.span>
  );
}

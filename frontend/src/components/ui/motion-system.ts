/**
 * Premium motion identity for the whole app.
 * Signature easing is cubic-bezier(0.4, 0, 0.2, 1). Overshoot is 0.
 * Entrances decelerate. Exits accelerate. Presses stay under 180ms.
 * Names that used to be springs are settled tweens so existing call sites stay quiet.
 */
import type { Transition, Variants } from "motion/react";

const easeStandard = [0.4, 0, 0.2, 1] as const;
const easeEnter = [0.16, 1, 0.3, 1] as const;
const easeExit = [0.4, 0, 1, 1] as const;

export const motionTokens = {
  duration: {
    instant: 0.12,
    fast: 0.18,
    normal: 0.38,
    slow: 0.52,
    cinematic: 1.05,
  },
  easing: {
    smooth: easeStandard,
    sharp: easeExit,
    out: easeEnter,
  },
  distance: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 12,
  },
  scale: {
    subtle: 0.985,
    press: 0.985,
    pop: 1,
  },
};

export const premiumTransition = {
  micro: { duration: 0.12, ease: easeStandard } satisfies Transition,
  quick: { duration: 0.18, ease: easeStandard } satisfies Transition,
  card: { duration: 0.32, ease: easeEnter } satisfies Transition,
  standard: { duration: 0.38, ease: easeEnter } satisfies Transition,
  slow: { duration: 0.52, ease: easeEnter } satisfies Transition,
  exit: { duration: 0.22, ease: easeExit } satisfies Transition,
};

export const springs = {
  snappy: premiumTransition.quick,
  fluid: premiumTransition.standard,
  gentle: premiumTransition.slow,
  instant: premiumTransition.micro,
};

export const FLUID_SPRING_TRANSITION: Transition = springs.fluid;
export const FAST_SPRING_TRANSITION: Transition = springs.snappy;
export const GENTLE_SPRING_TRANSITION: Transition = springs.gentle;
export const BOUNCE_SPRING_TRANSITION: Transition = springs.snappy;

export const pageTransitionVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: premiumTransition.standard,
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: premiumTransition.exit,
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.036,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: premiumTransition.card,
  },
};

export const dropdownMenuVariants: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: premiumTransition.card,
  },
  exit: {
    opacity: 0,
    scale: 0.992,
    y: 4,
    transition: premiumTransition.exit,
  },
};

export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.28, ease: easeStandard },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.18, ease: easeExit },
  },
};

export const modalPanelVariants: Variants = {
  initial: { opacity: 0, scale: 0.985, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeEnter },
  },
  exit: {
    opacity: 0,
    scale: 0.992,
    y: 4,
    transition: premiumTransition.exit,
  },
};

export const sheetVariants: Variants = {
  initial: { opacity: 0, x: 12 },
  animate: { opacity: 1, x: 0, transition: premiumTransition.standard },
  exit: {
    opacity: 0,
    x: 8,
    transition: premiumTransition.exit,
  },
};

export const buttonTapTransition = { scale: motionTokens.scale.press };
export const buttonHoverTransition = { y: -1 };
export const cardHoverTransition = {
  y: -2,
  transition: premiumTransition.quick,
};

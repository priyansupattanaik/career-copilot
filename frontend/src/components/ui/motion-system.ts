/**
 * Shared motion tokens, springs, and interaction presets.
 * Critically damped by default (Apple response ~0.3–0.4). Bounce only on release.
 */
import type { Transition, Variants } from "motion/react";

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.32,
    slow: 0.48,
    cinematic: 1.4,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as const,
    sharp: [0.4, 0, 0.2, 1] as const,
    out: [0.32, 0.72, 0, 1] as const,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 20,
  },
  scale: {
    subtle: 0.98,
    press: 0.97,
    pop: 1.02,
  },
};

export const springs = {
  snappy: { type: "spring" as const, stiffness: 440, damping: 38, mass: 0.8 },
  fluid: { type: "spring" as const, stiffness: 380, damping: 36, mass: 0.8 },
  gentle: { type: "spring" as const, stiffness: 280, damping: 32, mass: 0.9 },
  instant: { type: "spring" as const, stiffness: 600, damping: 42, mass: 0.6 },
};

export const FLUID_SPRING_TRANSITION: Transition = springs.fluid;
export const FAST_SPRING_TRANSITION: Transition = springs.snappy;
export const GENTLE_SPRING_TRANSITION: Transition = springs.gentle;
export const BOUNCE_SPRING_TRANSITION: Transition = springs.snappy;

export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.16,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.02,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.md },
  visible: {
    opacity: 1,
    y: 0,
    transition: springs.gentle,
  },
};

export const dropdownMenuVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: 8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.snappy,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: {
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.sharp,
    },
  },
};

export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.out },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: motionTokens.easing.sharp },
  },
};

export const modalPanelVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
    y: motionTokens.distance.md,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springs.gentle,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: motionTokens.distance.sm,
    transition: {
      duration: motionTokens.duration.fast,
      ease: motionTokens.easing.sharp,
    },
  },
};

export const sheetVariants: Variants = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: springs.fluid },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.sharp },
  },
};

export const buttonTapTransition = { scale: motionTokens.scale.press };
export const buttonHoverTransition = { scale: motionTokens.scale.pop };
export const cardHoverTransition = {
  y: -3,
  transition: springs.fluid,
};

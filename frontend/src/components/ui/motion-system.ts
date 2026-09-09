/**
 * Shared Motion & Interaction System
 * Standardized spring physics, shared layout transitions, and animation presets.
 */
import type { Transition, Variants } from "motion/react";

export const FLUID_SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 40,
};

export const FAST_SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 35,
};

export const GENTLE_SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 220,
  damping: 30,
};

export const BOUNCE_SPRING_TRANSITION: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};

/**
 * Silky page cross-fade and subtle upward rise for route navigation.
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.18,
      ease: [0.36, 0, 0.66, -0.56],
    },
  },
};

/**
 * Stagger container for lists, grids, and dashboards.
 */
export const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
};

/**
 * Child item for staggered animations.
 */
export const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 340,
      damping: 30,
    },
  },
};

/**
 * Dropdown menu entrance and exit with spring scale.
 */
export const dropdownMenuVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.94,
    y: 6,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 32,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 4,
    transition: {
      duration: 0.15,
      ease: "easeOut",
    },
  },
};

/**
 * Modal dialog backdrop and panel animations.
 */
export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.16, ease: "easeIn" },
  },
};

export const modalPanelVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 16,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 32,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    y: 10,
    transition: {
      duration: 0.16,
      ease: "easeIn",
    },
  },
};

/**
 * Interactive button and card physics.
 */
export const buttonTapTransition = { scale: 0.97 };
export const buttonHoverTransition = { scale: 1.02 };
export const cardHoverTransition = { y: -3, transition: FLUID_SPRING_TRANSITION };


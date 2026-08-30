import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "motion/react";
import type { LucideProps } from "lucide-react";
import {
  type CSSProperties,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
  cloneElement,
  isValidElement,
  useMemo,
  useState,
} from "react";

export type LucideIcon = ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>;

export type AnimateIconAnimation =
  | "default"
  | "pointing"
  | "pointing-left"
  | "pointing-down"
  | "pointing-up"
  | "draw"
  | "search"
  | "sparkle"
  | "trash-lid"
  | "bookmark"
  | "fly"
  | "blink"
  | "rotate"
  | "spin"
  | "external"
  | "drop"
  | "lift"
  | "people"
  | "play"
  | "video"
  | "flutter"
  | "thumb-up"
  | "thumb-down"
  | "shake"
  | "pulse"
  | "bounce";

export type AnimateIconProps = {
  children?: ReactNode;
  icon?: LucideIcon;
  animation?: AnimateIconAnimation;
  animateOnHover?: boolean;
  animateOnTap?: boolean;
  animateOnView?: boolean;
  loop?: boolean;
  loopDelay?: number;
  delay?: number;
  idle?: boolean; // deprecated compatibility flag
  className?: string;
  style?: CSSProperties;
  size?: number | string;
} & Omit<LucideProps, "icon">;

const springQuick: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 20,
  mass: 0.6,
};

const microVariants: Record<
  AnimateIconAnimation,
  {
    rest: TargetAndTransition;
    animate: TargetAndTransition;
    transition?: Transition;
  }
> = {
  default: {
    rest: { scale: 1, y: 0, rotate: 0 },
    animate: { scale: 1.14, y: -2 },
    transition: springQuick,
  },
  pointing: {
    rest: { x: 0, scale: 1 },
    animate: { x: [0, 4, 0], scale: [1, 1.06, 1] },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  "pointing-left": {
    rest: { x: 0, scale: 1 },
    animate: { x: [0, -4, 0], scale: [1, 1.06, 1] },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  "pointing-down": {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, 4, 0], scale: [1, 1.06, 1] },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  "pointing-up": {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, -4, 0], scale: [1, 1.06, 1] },
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  draw: {
    rest: { scale: 1, rotate: 0 },
    animate: { scale: [1, 1.25, 0.95, 1], rotate: [0, -8, 6, 0] },
    transition: { duration: 0.45, ease: "easeInOut" },
  },
  search: {
    rest: { scale: 1, rotate: 0 },
    animate: { scale: [1, 1.2, 1], rotate: [0, -14, 10, 0] },
    transition: { duration: 0.5, ease: "easeOut" },
  },
  sparkle: {
    rest: { scale: 1, rotate: 0 },
    animate: { scale: [1, 1.28, 0.95, 1], rotate: [0, 20, -16, 0] },
    transition: { duration: 0.52, ease: "easeInOut" },
  },
  "trash-lid": {
    rest: { y: 0, rotate: 0, scale: 1 },
    animate: { y: [0, -3.5, 0], rotate: [0, -14, 4, 0], scale: [1, 1.05, 1] },
    transition: { duration: 0.42, ease: "easeOut" },
  },
  bookmark: {
    rest: { y: 0, scaleY: 1 },
    animate: { y: [0, 3.5, -1, 0], scaleY: [1, 1.2, 0.95, 1] },
    transition: { duration: 0.45, ease: "easeInOut" },
  },
  fly: {
    rest: { x: 0, y: 0, rotate: 0, scale: 1 },
    animate: { x: [0, 4, 0], y: [0, -4, 0], rotate: [0, -12, 0], scale: [1, 1.08, 1] },
    transition: { duration: 0.48, ease: "easeOut" },
  },
  blink: {
    rest: { scaleY: 1 },
    animate: { scaleY: [1, 0.15, 1] },
    transition: { duration: 0.28, ease: "easeInOut" },
  },
  rotate: {
    rest: { rotate: 0 },
    animate: { rotate: 360 },
    transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
  },
  spin: {
    rest: { rotate: 0 },
    animate: { rotate: 360 },
    transition: { duration: 1, ease: "linear", repeat: Infinity },
  },
  external: {
    rest: { x: 0, y: 0 },
    animate: { x: [0, 3, 0], y: [0, -3, 0] },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  drop: {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, -5, 1, 0], scale: [1, 1.1, 0.96, 1] },
    transition: { duration: 0.45, ease: "easeOut" },
  },
  lift: {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, -3, 0], scale: [1, 1.08, 1] },
    transition: springQuick,
  },
  people: {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, -2.5, 0], scale: [1, 1.08, 1] },
    transition: { duration: 0.42, ease: "easeOut" },
  },
  play: {
    rest: { x: 0, scale: 1 },
    animate: { x: [0, 3.5, 0], scale: [1, 1.1, 1] },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  video: {
    rest: { scale: 1 },
    animate: { scale: [1, 1.2, 1] },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  flutter: {
    rest: { scaleX: 1 },
    animate: { scaleX: [1, 0.78, 1] },
    transition: { duration: 0.38, ease: "easeInOut" },
  },
  "thumb-up": {
    rest: { rotate: 0, scale: 1 },
    animate: { rotate: [0, 18, 0], scale: [1, 1.15, 1] },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  "thumb-down": {
    rest: { rotate: 0, scale: 1 },
    animate: { rotate: [0, -18, 0], scale: [1, 1.15, 1] },
    transition: { duration: 0.4, ease: "easeOut" },
  },
  shake: {
    rest: { rotate: 0, scale: 1 },
    animate: { rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.1, 1] },
    transition: { duration: 0.45, ease: "easeInOut" },
  },
  pulse: {
    rest: { scale: 1 },
    animate: { scale: [1, 1.22, 1] },
    transition: { duration: 0.4, ease: "easeInOut" },
  },
  bounce: {
    rest: { y: 0, scale: 1 },
    animate: { y: [0, -4, 0], scale: [1, 1.08, 1] },
    transition: springQuick,
  },
};

function inferAnimation(iconName?: string, className?: string): AnimateIconAnimation {
  if (className?.includes("spin")) return "spin";
  if (!iconName) return "default";

  const lower = iconName.toLowerCase();

  if (lower.includes("arrowright") || lower.includes("moveright") || lower.includes("chevronright")) return "pointing";
  if (lower.includes("arrowleft") || lower.includes("moveleft") || lower.includes("chevronleft")) return "pointing-left";
  if (lower.includes("chevrondown") || lower.includes("arrowdown")) return "pointing-down";
  if (lower.includes("chevronup") || lower.includes("arrowup")) return "pointing-up";
  if (lower.includes("check")) return "draw";
  if (lower.includes("search")) return "search";
  if (lower.includes("sparkle") || lower.includes("star")) return "sparkle";
  if (lower.includes("trash")) return "trash-lid";
  if (lower.includes("bookmark")) return "bookmark";
  if (lower.includes("send")) return "fly";
  if (lower.includes("eye")) return "blink";
  if (lower.includes("refresh") || lower.includes("rotate")) return "rotate";
  if (lower.includes("loader")) return "spin";
  if (lower.includes("external")) return "external";
  if (lower.includes("pin") || lower.includes("map")) return "drop";
  if (lower.includes("briefcase") || lower.includes("building")) return "lift";
  if (lower.includes("user") || lower.includes("people")) return "people";
  if (lower.includes("play")) return "play";
  if (lower.includes("video") || lower.includes("camera")) return "video";
  if (lower.includes("book")) return "flutter";
  if (lower.includes("thumbup")) return "thumb-up";
  if (lower.includes("thumbdown") || lower.includes("thumbsdown")) return "thumb-down";
  if (lower.includes("alert") || lower === "x") return "shake";

  return "default";
}

/**
 * AnimateIcon — Animate UI Icon component distribution.
 * Provides micro-interactions powered by Motion on hover/tap/trigger without continuous jitter.
 */
export function AnimateIcon({
  children,
  icon: IconProp,
  animation,
  animateOnHover = true,
  animateOnTap = true,
  animateOnView,
  loop = false,
  className,
  style,
  size,
  idle: _idle,
  ...props
}: AnimateIconProps) {
  const reducedMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);
  const [isTapped, setIsTapped] = useState(false);

  const iconName = useMemo(() => {
    if (IconProp) return IconProp.displayName || IconProp.name || "";
    if (isValidElement(children)) {
      const type = children.type as { displayName?: string; name?: string };
      return type.displayName || type.name || "";
    }
    return "";
  }, [IconProp, children]);

  const chosenAnimation = animation || inferAnimation(iconName, className);
  const isSpinning = chosenAnimation === "spin" || className?.includes("spin") || loop;

  const motionDefinition = microVariants[chosenAnimation] || microVariants.default;

  const isTriggered = !reducedMotion && !isSpinning && (isHovered || isTapped);

  const renderedContent = useMemo(() => {
    if (IconProp) {
      return <IconProp size={size} {...props} />;
    }
    if (isValidElement(children)) {
      return cloneElement(children as React.ReactElement<LucideProps>, {
        size: size ?? (children.props as LucideProps).size,
        ...props,
      });
    }
    return children;
  }, [IconProp, children, size, props]);

  return (
    <motion.span
      className={className ? `animate-ui-icon ${className}` : "animate-ui-icon"}
      aria-hidden={props["aria-label"] ? undefined : true}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        lineHeight: 0,
        ...style,
      }}
      onMouseEnter={animateOnHover ? () => setIsHovered(true) : undefined}
      onMouseLeave={animateOnHover ? () => setIsHovered(false) : undefined}
      onPointerDown={animateOnTap ? () => setIsTapped(true) : undefined}
      onPointerUp={animateOnTap ? () => setIsTapped(false) : undefined}
      animate={
        isSpinning
          ? motionDefinition.animate
          : isTriggered
          ? motionDefinition.animate
          : motionDefinition.rest
      }
      transition={motionDefinition.transition}
      whileInView={animateOnView ? motionDefinition.animate : undefined}
    >
      {renderedContent}
    </motion.span>
  );
}

/**
 * AnimatedIcon — Backward-compatible alias for existing codebase usages.
 */
export const AnimatedIcon = AnimateIcon;


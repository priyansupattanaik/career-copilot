import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { Link } from "@/shared/ui/router-link";
import { BrandMark } from "@/components/ui/brand-mark";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { prefetchRoute } from "@/shared/route-prefetch";
import { cn } from "@/shared/utils";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  type Variants,
} from "motion/react";

const megaMenuVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.97,
    y: 8,
    x: "-50%",
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    x: "-50%",
    transition: {
      type: "spring",
      stiffness: 420,
      damping: 30,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    x: "-50%",
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 1, 1],
    },
  },
};

interface LiquidNavLinkProps {
  href: string;
  isAnchor?: boolean;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  reduceMotion?: boolean | null;
  onMouseEnter?: () => void;
  onFocus?: () => void;
}

function LiquidNavLink({
  href,
  isAnchor,
  children,
  onClick,
  className,
  reduceMotion,
  onMouseEnter,
  onFocus,
}: LiquidNavLinkProps) {
  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    onMouseEnter?.();
  };

  const handleMouseLeave = () => {
    setHovered(false);
  };

  const handleFocus = () => {
    setHovered(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setHovered(false);
  };

  const innerContent = (
    <>
      {/* Liquid rising background */}
      <span
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        <motion.span
          className="nav5-liquid-surge absolute inset-0 rounded-full"
          initial={false}
          animate={
            hovered
              ? { y: "0%", opacity: 1, scaleY: 1 }
              : { y: "105%", opacity: 0.25, scaleY: 0.85 }
          }
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : {
                  type: "spring",
                  stiffness: 400,
                  damping: 26,
                  mass: 0.5,
                }
          }
          style={{ originY: 1 }}
        />
        {/* Liquid meniscus surface gleam */}
        <motion.span
          className="nav5-liquid-gleam absolute inset-x-2 top-0 h-[1.5px] rounded-full"
          initial={false}
          animate={
            hovered ? { opacity: 0.95, y: 0 } : { opacity: 0, y: 12 }
          }
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </span>

      {/* Foreground Label */}
      <span className="relative z-10 flex items-center gap-1.5 transition-colors duration-200">
        {children}
      </span>
    </>
  );

  const sharedClasses = cn(
    "nav5-liquid-link nav5-link group relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:text-[var(--text)] active:scale-95 select-none",
    className,
  );

  if (isAnchor) {
    return (
      <a
        href={href}
        className={sharedClasses}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        {innerContent}
      </a>
    );
  }

  return (
    <Link
      href={href}
      className={sharedClasses}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {innerContent}
    </Link>
  );
}

export function Navigation5({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const atHome = pathname === "/";
  const sectionHref = (id: string) => (atHome ? `#${id}` : `/#${id}`);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [solutionsBtnHovered, setSolutionsBtnHovered] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const solutionsRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    if (latest > 24) {
      setScrolled(true);
    } else if (latest < 8) {
      setScrolled(false);
    }
  });

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const closeMobileMenu = useCallback(() => {
    setMobileOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }, []);

  const closeAndFollowAnchor = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      const sectionId = event.currentTarget.hash.replace(/^#/, "");
      setMobileOpen(false);
      setSolutionsOpen(false);
      window.setTimeout(() => {
        const target = sectionId ? document.getElementById(sectionId) : null;
        target?.focus({ preventScroll: true });
      }, 0);
    },
    [],
  );

  // Close desktop dropdown on outside click or escape
  useEffect(() => {
    if (!solutionsOpen) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        solutionsRef.current &&
        !solutionsRef.current.contains(e.target as Node)
      ) {
        setSolutionsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSolutionsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [solutionsOpen]);

  // Trap focus and handle escape for mobile bottom sheet
  useEffect(() => {
    if (!mobileOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

    const initialFocus = window.setTimeout(
      () => getFocusable()[0]?.focus(),
      10,
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(initialFocus);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMobileMenu, mobileOpen]);

  return (
    <motion.header
      className={cn(
        "home-nav nav5-wrapper sticky top-0 z-50 w-full pointer-events-none",
        className,
      )}
      initial={reduceMotion ? { opacity: 0 } : { y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        reduceMotion
          ? { duration: 0.2 }
          : {
              type: "spring",
              stiffness: 240,
              damping: 22,
              mass: 0.85,
              delay: 0.05,
            }
      }
    >
      <nav
        className="w-full"
        aria-label="Primary"
      >
        <div className="mx-auto flex w-full items-center justify-center px-0">
          {/* Full-width bar morphing into floating pill */}
          <div
            className={cn(
              "nav5-pill nav5-morph-bar mx-auto flex items-center justify-between gap-2 sm:gap-4 pointer-events-auto",
              scrolled
                ? "nav5-bar-scrolled nav5-pill-scrolled max-w-5xl sm:max-w-6xl h-14 sm:h-15 rounded-full px-3.5 sm:px-5 border shadow-xl translate-y-2.5 sm:translate-y-3"
                : "nav5-bar-full w-full max-w-full h-18 sm:h-20 rounded-none px-6 sm:px-10 lg:px-14 border-b shadow-sm translate-y-0",
            )}
            style={{
              borderRadius: scrolled ? 9999 : 0,
            }}
          >
            {/* Logo Section - Preserved untouched & static */}
            <Link
              href="/"
              className="nav5-brand flex items-center gap-2.5 pr-3 pl-1 select-none"
              aria-label="Career Copilot home"
            >
              <BrandMark />
              <span className="text-base font-bold tracking-tight text-[var(--text)] sm:text-lg">
                Career Copilot
              </span>
            </Link>

            {/* Desktop Navigation Links with Liquid Fill */}
            <div className="hidden xl:flex xl:items-center xl:gap-1">
              <LiquidNavLink
                href={sectionHref("practice")}
                isAnchor={true}
                reduceMotion={reduceMotion}
              >
                Practice
              </LiquidNavLink>

              <LiquidNavLink
                href={sectionHref("system")}
                isAnchor={true}
                reduceMotion={reduceMotion}
              >
                How it works
              </LiquidNavLink>

              {/* Solutions Dropdown Menu with Liquid Trigger */}
              <div
                ref={solutionsRef}
                className="relative"
                onMouseEnter={() => setSolutionsOpen(true)}
                onMouseLeave={() => setSolutionsOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    "nav5-liquid-link nav5-link group relative inline-flex items-center justify-center rounded-full px-3.5 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-all duration-200 hover:text-[var(--text)] active:scale-95 select-none",
                    solutionsOpen && "text-[var(--text)]",
                  )}
                  aria-expanded={solutionsOpen}
                  onClick={() => setSolutionsOpen((v) => !v)}
                  onMouseEnter={() => setSolutionsBtnHovered(true)}
                  onMouseLeave={() => setSolutionsBtnHovered(false)}
                  onFocus={() => setSolutionsBtnHovered(true)}
                  onBlur={() => setSolutionsBtnHovered(false)}
                >
                  {/* Liquid background surge */}
                  <span
                    className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-full"
                    aria-hidden="true"
                  >
                    <motion.span
                      className="nav5-liquid-surge absolute inset-0 rounded-full"
                      initial={false}
                      animate={
                        solutionsOpen || solutionsBtnHovered
                          ? { y: "0%", opacity: 1, scaleY: 1 }
                          : { y: "105%", opacity: 0.25, scaleY: 0.85 }
                      }
                      transition={
                        reduceMotion
                          ? { duration: 0.15 }
                          : {
                              type: "spring",
                              stiffness: 400,
                              damping: 26,
                              mass: 0.5,
                            }
                      }
                      style={{ originY: 1 }}
                    />
                    <motion.span
                      className="nav5-liquid-gleam absolute inset-x-2 top-0 h-[1.5px] rounded-full"
                      initial={false}
                      animate={
                        solutionsOpen || solutionsBtnHovered
                          ? { opacity: 0.95, y: 0 }
                          : { opacity: 0, y: 12 }
                      }
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    />
                  </span>

                  <span className="relative z-10 flex items-center gap-1">
                    <span>Platform</span>
                    <CopilotIcon
                      name="expand"
                      size={14}
                      className={cn(
                        "transition-transform duration-200",
                        solutionsOpen && "rotate-180",
                      )}
                    />
                  </span>
                </button>

                {/* Mega Menu Dropdown Island */}
                <AnimatePresence>
                  {solutionsOpen && (
                    <motion.div
                      className="nav5-dropdown absolute top-full left-1/2 pt-3 w-[720px] max-w-[calc(100vw-48px)]"
                      role="menu"
                      aria-label="Platform solutions"
                      variants={megaMenuVariants}
                      initial={reduceMotion ? false : "initial"}
                      animate="animate"
                      exit="exit"
                    >
                      <div className="nav5-menu overflow-hidden rounded-3xl border p-6">
                        <div className="grid grid-cols-3 gap-6 divide-x divide-[var(--divider)]">
                          {/* Column 1: Resume & ATS */}
                          <div className="flex flex-col gap-3 pr-4">
                            <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--primary-strong)]">
                              <CopilotIcon name="resume" size={18} />
                            </div>
                            <h4 className="text-sm font-semibold text-[var(--text)]">
                              ATS & Evidence
                            </h4>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              Extract verified skills, score resume fit against real
                              job descriptions, and close gaps.
                            </p>
                            <div className="mt-1 flex flex-col gap-1">
                              <Link
                                href="/resume-analysis?tab=upload"
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary-strong)] transition-colors"
                                onClick={() => setSolutionsOpen(false)}
                              >
                                Analyze Resume
                              </Link>
                              <Link
                                href="/resume-analysis"
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary-strong)] transition-colors"
                                onClick={() => setSolutionsOpen(false)}
                              >
                                Score Breakdown
                              </Link>
                            </div>
                          </div>

                          {/* Column 2: Mock Interview & Learning */}
                          <div className="flex flex-col gap-3 px-4">
                            <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-muted)] text-[var(--primary-strong)]">
                              <CopilotIcon name="interview" size={18} />
                            </div>
                            <h4 className="text-sm font-semibold text-[var(--text)]">
                              Interview & Skills
                            </h4>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              Real-time AI video interviews with voice, turn-taking,
                              and tailored gap curriculum.
                            </p>
                            <div className="mt-1 flex flex-col gap-1">
                              <Link
                                href="/mock-interview/preparation"
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary-strong)] transition-colors"
                                onClick={() => setSolutionsOpen(false)}
                              >
                                Video Practice Room
                              </Link>
                              <Link
                                href="/learning"
                                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary-strong)] transition-colors"
                                onClick={() => setSolutionsOpen(false)}
                              >
                                Learning Path
                              </Link>
                            </div>
                          </div>

                          {/* Column 3: Featured Card */}
                          <div className="flex flex-col pl-4">
                            <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                              Featured
                            </span>
                            <Link
                              href="/mock-interview/preparation"
                              className="group relative flex flex-1 flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border)] p-4 transition-[border-color,box-shadow,transform] duration-200 hover:border-[var(--primary-strong)] hover:shadow-md"
                              style={{
                                backgroundColor: "var(--surface-muted)",
                              }}
                              onClick={() => setSolutionsOpen(false)}
                            >
                              <div>
                                <span className="badge badge-info mb-2 text-[10px] uppercase tracking-wider">
                                  Live AI Studio
                                </span>
                                <h5 className="text-xs font-bold text-[var(--text)]">
                                  Camera & Mic Readiness
                                </h5>
                                <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-normal">
                                  Test lighting, speech pace, and receive instant
                                  feedback.
                                </p>
                              </div>
                              <div className="mt-3 flex items-center text-xs font-semibold text-[var(--primary-strong)]">
                                <span>Try session</span>
                                <CopilotIcon name="external" size={13} className="ml-1" />
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <LiquidNavLink
                href="/community"
                reduceMotion={reduceMotion}
              >
                Community
              </LiquidNavLink>
              <LiquidNavLink
                href="/teams"
                reduceMotion={reduceMotion}
              >
                Team
              </LiquidNavLink>
            </div>

            {/* Action / Auth Section */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex sm:items-center sm:gap-2">
                <ThemeToggle compact />
                <LiquidNavLink
                  href="/sign-in"
                  reduceMotion={reduceMotion}
                  onMouseEnter={() => prefetchRoute("/sign-in")}
                  onFocus={() => prefetchRoute("/sign-in")}
                >
                  Sign in
                </LiquidNavLink>
              </div>

              <span
                className="hidden sm:inline-flex"
                onMouseEnter={() => prefetchRoute("/sign-up")}
                onFocus={() => prefetchRoute("/sign-up")}
              >
                <Link
                  href="/sign-up"
                  className="button button-primary inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold shadow-sm transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Get started</span>
                  <CopilotIcon name="go" size={15} />
                </Link>
              </span>

              {/* Mobile Menu Trigger Button */}
              <div className="xl:hidden">
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text)] hover:bg-[color-mix(in_srgb,var(--surface-muted)_65%,transparent)] transition-colors active:scale-95"
                  aria-label="Open navigation"
                  aria-expanded={mobileOpen}
                  onClick={() => setMobileOpen(true)}
                >
                  <CopilotIcon name="menu" size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Sheet Modal */}
      <AnimatePresence>
        {mobileOpen && (
          <div
            ref={dialogRef}
            className="fixed inset-0 z-50 flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            {/* Backdrop Scrim */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeMobileMenu}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
              className="nav5-bottom-sheet relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-[28px] border-t border-[var(--border)] p-6 shadow-2xl overflow-hidden"
              initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
              transition={
                reduceMotion
                  ? { duration: 0.15 }
                  : { type: "spring", stiffness: 380, damping: 34 }
              }
            >
              {/* Drag Handle Indicator */}
              <div
                className="mx-auto -mt-2 mb-4 h-1.5 w-12 rounded-full bg-[var(--text-muted)]/30 select-none"
                aria-hidden="true"
              />

              {/* Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-[var(--divider)]">
                <div className="flex items-center gap-2">
                  <BrandMark />
                  <span className="text-base font-bold text-[var(--text)]">
                    Career Copilot
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] transition-colors"
                  aria-label="Close menu"
                  onClick={closeMobileMenu}
                >
                  <CopilotIcon name="close" size={18} />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto py-4">
                <a
                  href={sectionHref("practice")}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  onClick={closeAndFollowAnchor}
                >
                  Practice
                </a>

                <a
                  href={sectionHref("system")}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  onClick={closeAndFollowAnchor}
                >
                  How it works
                </a>

                {/* Mobile Collapsible Platform section */}
                <div>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                    onClick={() => setMobileSolutionsOpen((v) => !v)}
                    aria-expanded={mobileSolutionsOpen}
                  >
                    <span>Platform Modules</span>
                    <CopilotIcon
                      name="expand"
                      size={16}
                      className={cn(
                        "text-[var(--text-muted)] transition-transform duration-200",
                        mobileSolutionsOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {mobileSolutionsOpen && (
                    <div className="mt-1 ml-3 flex flex-col gap-1 border-l-2 border-[var(--divider)] pl-3">
                      <Link
                        href="/resume-analysis?tab=upload"
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary-strong)]"
                        onClick={closeMobileMenu}
                      >
                        Resume Analysis
                      </Link>
                      <Link
                        href="/mock-interview/preparation"
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary-strong)]"
                        onClick={closeMobileMenu}
                      >
                        Mock Interview Studio
                      </Link>
                      <Link
                        href="/learning"
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary-strong)]"
                        onClick={closeMobileMenu}
                      >
                        Learning Path
                      </Link>
                      <Link
                        href="/jobs"
                        className="rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--primary-strong)]"
                        onClick={closeMobileMenu}
                      >
                        Recommended Jobs
                      </Link>
                    </div>
                  )}
                </div>

                <Link
                  href="/community"
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  onClick={closeMobileMenu}
                >
                  Community
                </Link>
                <Link
                  href="/teams"
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  onClick={closeMobileMenu}
                >
                  Team
                </Link>

                <div className="my-1.5 border-t border-[var(--divider)] pt-2">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-[var(--text-muted)]">
                      Theme
                    </span>
                    <ThemeToggle />
                  </div>
                </div>

                <Link
                  href="/sign-in"
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors"
                  onClick={closeMobileMenu}
                >
                  Sign in
                </Link>
              </div>

              {/* Bottom CTA Button */}
              <div className="pt-3 border-t border-[var(--divider)]">
                <Link
                  href="/sign-up"
                  className="button button-primary flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold shadow-sm"
                  onClick={closeMobileMenu}
                >
                  <span>Get started</span>
                  <CopilotIcon name="go" size={16} />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export default Navigation5;

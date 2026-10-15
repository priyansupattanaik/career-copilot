import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "@/shared/ui/router-link";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { CopilotIcon, type CopilotIconName } from "@/components/ui/copilot-icons";
import { BrandMark } from "@/components/ui/brand-mark";
import { routes } from "@/shared/routes";
import { createClient } from "@/features/auth/api/client";
import { isDemoSession } from "@/features/auth/demo-session";
import { DEMO_COOKIE_NAME } from "@/shared/config";
import { prefetchRoute, prefetchWorkspace } from "@/shared/route-prefetch";
import { useWorkspaceBootstrap } from "@/features/workspace/bootstrap-context";
import { motion, useReducedMotion } from "motion/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Sheet,
  SheetContent,
  SheetClose,
  ToastProvider,
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/ui/workbench";

/** Primary navigation for sidebar (desktop & tablet rail) */
const navigation = [
  {
    href: routes.dashboard,
    label: "Dashboard",
    icon: "dashboard" as CopilotIconName,
  },
  {
    href: routes.resume,
    label: "Resume Analysis",
    icon: "resume" as CopilotIconName,
  },
  {
    href: routes.interview,
    label: "Mock Interview",
    icon: "interview" as CopilotIconName,
  },
  {
    href: routes.learning,
    label: "Learning Path",
    icon: "learning" as CopilotIconName,
  },
  {
    href: routes.jobs,
    label: "Recommended Jobs",
    icon: "jobs" as CopilotIconName,
  },
  {
    href: routes.community,
    label: "Community",
    icon: "community" as CopilotIconName,
  },
];

/** Mobile bottom tab slots (5 slots: Dashboard, Resume, Interview, Jobs, More) */
const mobilePrimaryTabs = [
  {
    href: routes.dashboard,
    label: "Dashboard",
    icon: "dashboard" as CopilotIconName,
  },
  {
    href: routes.resume,
    label: "Resume",
    icon: "resume" as CopilotIconName,
  },
  {
    href: routes.interview,
    label: "Interview",
    icon: "interview" as CopilotIconName,
  },
  {
    href: routes.jobs,
    label: "Jobs",
    icon: "jobs" as CopilotIconName,
  },
];

export function WorkspaceLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={routes.dashboard}
      className="workbench-logo-link"
      onMouseEnter={() => prefetchRoute(routes.dashboard)}
      onFocus={() => prefetchRoute(routes.dashboard)}
      aria-label="Career Copilot dashboard"
    >
      <span className="workbench-logo-mark">
        <BrandMark compact />
      </span>
      {!compact && <span className="workbench-logo-text">Career Copilot</span>}
    </Link>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { data: bootstrap } = useWorkspaceBootstrap();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  useEffect(() => {
    prefetchWorkspace();
  }, []);

  // Topbar hairline appears after 8px scroll
  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close more sheet on route change
  useEffect(() => {
    setMoreSheetOpen(false);
  }, [pathname]);

  const fullName = bootstrap?.profile?.full_name || "Your account";
  const firstName = fullName.split(" ")[0] || "You";
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const avatarUrl = bootstrap?.profile?.avatar_url || null;

  const currentNav = navigation.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const currentNavLabel =
    currentNav?.label ||
    (pathname.startsWith("/settings") ? "Settings" : "Workspace");

  // Document title per route
  useEffect(() => {
    document.title = `${currentNavLabel} · Career Copilot`;
  }, [currentNavLabel]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await createClient()?.auth.signOut();
      document.cookie = `${DEMO_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
      navigate("/");
    } finally {
      setLoggingOut(false);
    }
  }

  // Page entrance motion: 240ms cubic-bezier(0.16, 1, 0.3, 1), opacity 0->1, y 8->0
  const pageVariants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.24,
            ease: [0.16, 1, 0.3, 1] as const,
          },
        },
      };

  const isMoreActive =
    pathname.startsWith("/learning") ||
    pathname.startsWith("/community") ||
    pathname.startsWith("/settings");

  return (
    <ToastProvider>
      <TooltipProvider delayDuration={200}>
        <div className="workspace workbench-shell">
          {/* Skip-to-content accessible landmark */}
          <a href="#main" className="wb-skip-link">
            Skip to content
          </a>

          {/* Desktop & Tablet Sidebar (>= 1024px: 232px; 768-1023px: 72px icon rail) */}
          <aside
            className="workbench-sidebar"
            aria-label="Workspace navigation"
          >
            <div className="workbench-sidebar-header">
              <WorkspaceLogo />
            </div>

            <nav className="workbench-sidebar-nav" aria-label="Primary">
              {navigation.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        onMouseEnter={() => prefetchRoute(item.href)}
                        onFocus={() => prefetchRoute(item.href)}
                        className={`workbench-nav-item ${active ? "is-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <span className="workbench-nav-icon" aria-hidden="true">
                          <CopilotIcon name={item.icon} size={18} />
                        </span>
                        <span className="workbench-nav-label">{item.label}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
          </aside>

          {/* Main Content Area */}
          <div className="workbench-main">
            {/* Top bar: 56px, sticky, transparent */}
            <header className={`workbench-topbar ${isScrolled ? "is-scrolled" : ""}`}>
              <div className="workbench-topbar-inner">
                {/* Desktop & Tablet: Breadcrumb Workspace / Page */}
                <div className="workbench-breadcrumb" aria-label="Breadcrumb">
                  {/* On mobile (< 768px) and phone landscape, logo shows on left */}
                  <span className="mobile-only">
                    <WorkspaceLogo compact={false} />
                  </span>
                  <span className="desktop-tablet-only">
                    <Link href={routes.dashboard}>Workspace</Link>
                    <span className="workbench-breadcrumb-separator">/</span>
                    <span style={{ color: "var(--ink)", fontWeight: 500 }}>
                      {currentNavLabel}
                    </span>
                  </span>
                </div>

                {/* Right: Demo status badge + Account Avatar Menu */}
                <div className="workbench-topbar-actions">
                  {isDemoSession() ? (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--ink-2)",
                        border: "1px solid var(--hairline)",
                        padding: "3px 8px",
                        borderRadius: 9999,
                      }}
                    >
                      Demo workspace
                    </span>
                  ) : null}

                  {/* Account Avatar button opening existing account menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="workbench-avatar-btn"
                        aria-label={`Account menu for ${firstName}`}
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" />
                        ) : (
                          initials
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="bottom">
                      <DropdownMenuItem asChild>
                        <Link href="/settings/profile">
                          <CopilotIcon name="account" size={16} />
                          <span>View profile</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings/account">
                          <CopilotIcon name="settings" size={16} />
                          <span>Settings</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        isDanger
                        onClick={() => void logout()}
                        disabled={loggingOut}
                      >
                        <CopilotIcon name="logout" size={16} />
                        <span>{loggingOut ? "Signing out…" : "Log out"}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </header>

            {/* Main content landmark */}
            <main id="main" className="workbench-content">
              <motion.div
                key={pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
              >
                {children}
              </motion.div>
            </main>
          </div>

          {/* Mobile Bottom Tab Bar (< 768px): 5 slots */}
          <nav className="workbench-bottom-bar" aria-label="Mobile Primary">
            {mobilePrimaryTabs.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`workbench-tab-slot ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <CopilotIcon name={item.icon} size={18} />
                  <span className="workbench-tab-label">{item.label}</span>
                </Link>
              );
            })}

            {/* 5th slot: More button */}
            <button
              type="button"
              className={`workbench-tab-slot ${isMoreActive ? "is-active" : ""}`}
              onClick={() => setMoreSheetOpen(true)}
              aria-label="More navigation options"
            >
              <CopilotIcon name="menu" size={18} />
              <span className="workbench-tab-label">More</span>
            </button>
          </nav>

          {/* Mobile "More" Bottom Sheet (< 768px) */}
          <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
            <SheetContent title="More workspace pages" showHandle>
              <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SheetClose asChild>
                  <Link
                    href={routes.learning}
                    className={`workbench-nav-item ${pathname.startsWith(routes.learning) ? "is-active" : ""}`}
                  >
                    <span className="workbench-nav-icon" aria-hidden="true">
                      <CopilotIcon name="learning" size={18} />
                    </span>
                    <span className="workbench-nav-label">Learning Path</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href={routes.community}
                    className={`workbench-nav-item ${pathname.startsWith(routes.community) ? "is-active" : ""}`}
                  >
                    <span className="workbench-nav-icon" aria-hidden="true">
                      <CopilotIcon name="community" size={18} />
                    </span>
                    <span className="workbench-nav-label">Community</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    href="/settings/profile"
                    className={`workbench-nav-item ${pathname.startsWith("/settings") ? "is-active" : ""}`}
                  >
                    <span className="workbench-nav-icon" aria-hidden="true">
                      <CopilotIcon name="settings" size={18} />
                    </span>
                    <span className="workbench-nav-label">Settings</span>
                  </Link>
                </SheetClose>
              </nav>

              <div style={{ paddingTop: 12, borderTop: "1px solid var(--hairline)" }}>
                <button
                  type="button"
                  className="wb-button wb-button-destructive"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  <CopilotIcon name="logout" size={16} />
                  <span>{loggingOut ? "Signing out…" : "Log out"}</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </TooltipProvider>
    </ToastProvider>
  );
}

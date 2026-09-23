import { useLocation } from "react-router-dom";
import { ArrowRightIcon } from "lucide-react";
import { Link } from "@/shared/ui/router-link";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { prefetchRoute } from "@/shared/route-prefetch";

export type BreadcrumbSegment =
  | {
      label: string;
      href: string;
      current?: false;
    }
  | {
      label: string;
      current: true;
      href?: string;
    };

export interface Breadcrumb5Props {
  segments?: readonly BreadcrumbSegment[];
  className?: string;
}

function getAutoBreadcrumbs(pathname: string, search: string): BreadcrumbSegment[] {
  const base: BreadcrumbSegment = { label: "Workspace", href: "/dashboard" };

  if (pathname === "/dashboard" || pathname === "/" || pathname === "") {
    return [base, { label: "Dashboard", current: true }];
  }

  if (pathname.startsWith("/resume-analysis")) {
    const parent: BreadcrumbSegment = { label: "Resume Analysis", href: "/resume-analysis" };
    if (pathname.includes("/report")) {
      return [base, parent, { label: "ATS Report", current: true }];
    }
    if (pathname.includes("/new") || search.includes("tab=upload")) {
      return [base, parent, { label: "Upload & Match", current: true }];
    }
    return [base, { label: "Resume Analysis", current: true }];
  }

  if (pathname.startsWith("/mock-interview")) {
    const parent: BreadcrumbSegment = { label: "Mock Interview", href: "/mock-interview" };
    if (pathname.includes("/session")) {
      return [base, parent, { label: "Live Session", current: true }];
    }
    if (pathname.includes("/report")) {
      return [base, parent, { label: "Feedback Report", current: true }];
    }
    return [base, { label: "Mock Interview", current: true }];
  }

  if (pathname.startsWith("/learning")) {
    return [base, { label: "Learning Path", current: true }];
  }

  if (pathname.startsWith("/jobs")) {
    return [base, { label: "Recommended Jobs", current: true }];
  }

  if (pathname.startsWith("/community")) {
    return [base, { label: "Community", current: true }];
  }

  if (pathname.startsWith("/teams")) {
    return [base, { label: "Teams", current: true }];
  }

  if (pathname.startsWith("/settings")) {
    const parent: BreadcrumbSegment = { label: "Settings", href: "/settings/profile" };
    if (pathname.includes("/account")) {
      return [base, parent, { label: "Account", current: true }];
    }
    return [base, parent, { label: "Profile", current: true }];
  }

  // Fallback for any other path
  const parts = pathname.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1] || "Current";
  const formatted = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, " ");
  return [base, { label: formatted, current: true }];
}

export const Breadcrumb5 = ({ segments, className }: Breadcrumb5Props) => {
  const location = useLocation();
  const activeSegments = segments ?? getAutoBreadcrumbs(location.pathname, location.search);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1.5 flex-wrap items-center">
        {activeSegments.map((segment, index) => {
          const isCurrent = Boolean(segment.current) || index === activeSegments.length - 1;
          const hasHref = Boolean("href" in segment && segment.href && !isCurrent);

          return (
            <BreadcrumbItem key={`${segment.label}-${index}`}>
              {hasHref && segment.href ? (
                <Link
                  href={segment.href}
                  className="inline-flex items-center text-inherit no-underline"
                  onMouseEnter={() => prefetchRoute(segment.href!)}
                  onFocus={() => prefetchRoute(segment.href!)}
                >
                  <Badge
                    variant="outline"
                    className="border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40 px-2.5 py-0.5 text-xs font-normal transition-all cursor-pointer shadow-2xs"
                  >
                    {segment.label}
                  </Badge>
                </Link>
              ) : (
                <BreadcrumbPage>
                  <Badge
                    variant="outline"
                    className="border-foreground/20 bg-muted/30 text-foreground px-2.5 py-0.5 text-xs font-medium shadow-2xs"
                  >
                    {segment.label}
                  </Badge>
                </BreadcrumbPage>
              )}
              {index < activeSegments.length - 1 ? (
                <BreadcrumbSeparator className="text-muted-foreground/60 inline-flex items-center">
                  <ArrowRightIcon className="size-3.5" />
                </BreadcrumbSeparator>
              ) : null}
            </BreadcrumbItem>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default Breadcrumb5;

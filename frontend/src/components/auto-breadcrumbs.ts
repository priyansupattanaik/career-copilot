export interface BreadcrumbSegment {
  label: string;
  href?: string;
  current?: boolean;
}

export function getAutoBreadcrumbs(
  pathname: string,
  search: string,
): BreadcrumbSegment[] {
  const base: BreadcrumbSegment = { label: "Workspace", href: "/dashboard" };

  if (pathname === "/dashboard" || pathname === "/" || pathname === "") {
    return [base, { label: "Dashboard", current: true }];
  }

  if (pathname.startsWith("/resume-analysis")) {
    const parent: BreadcrumbSegment = {
      label: "Resume Analysis",
      href: "/resume-analysis",
    };
    if (pathname.includes("/report")) {
      return [base, parent, { label: "ATS Report", current: true }];
    }
    if (pathname.includes("/new") || search.includes("tab=upload")) {
      return [base, parent, { label: "Upload & Match", current: true }];
    }
    return [base, { label: "Resume Analysis", current: true }];
  }

  if (pathname.startsWith("/mock-interview")) {
    const parent: BreadcrumbSegment = {
      label: "Mock Interview",
      href: "/mock-interview",
    };
    if (pathname.includes("/setup")) {
      return [base, parent, { label: "Setup & Flight Check", current: true }];
    }
    if (pathname.includes("/preparation")) {
      return [base, parent, { label: "Preparation", current: true }];
    }
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
    const parent: BreadcrumbSegment = {
      label: "Settings",
      href: "/settings/profile",
    };
    if (pathname.includes("/account")) {
      return [base, parent, { label: "Account & Access", current: true }];
    }
    if (pathname.includes("/preferences")) {
      return [base, parent, { label: "Preferences", current: true }];
    }
    if (pathname.includes("/privacy")) {
      return [base, parent, { label: "Privacy Controls", current: true }];
    }
    return [base, parent, { label: "Candidate Profile", current: true }];
  }

  // Fallback for any other path
  const parts = pathname.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1] || "Current";
  const formatted =
    lastPart.charAt(0).toUpperCase() + lastPart.slice(1).replace(/-/g, " ");
  return [base, { label: formatted, current: true }];
}

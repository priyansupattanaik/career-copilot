import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import { useReducedMotion } from "motion/react";

export type CopilotIconName =
  | "dashboard"
  | "resume"
  | "interview"
  | "learning"
  | "jobs"
  | "community"
  | "profile"
  | "settings"
  | "evidence"
  | "skills"
  | "confidence"
  | "projects"
  | "assist"
  | "scan"
  | "search"
  | "check"
  | "close"
  | "add"
  | "edit"
  | "trash"
  | "save"
  | "apply"
  | "reject"
  | "show"
  | "hide"
  | "upload"
  | "library"
  | "history"
  | "play"
  | "lesson"
  | "lesson-check"
  | "external"
  | "refresh"
  | "alert"
  | "empty"
  | "mail"
  | "pin"
  | "company"
  | "pay"
  | "applicants"
  | "loader"
  | "filters"
  | "link"
  | "menu"
  | "next"
  | "back"
  | "collapse"
  | "expand"
  | "go"
  | "account"
  | "logout"
  | "sun"
  | "moon"
  | "work"
  | "trend"
  | "compass"
  | "idle"
  | "linkedin"
  | "github"
  | "twitter"
  | "dribbble"
  | "website";

const ALIASES: Record<string, CopilotIconName> = {
  opportunities: "jobs",
  signal: "skills",
  sparkles: "assist",
  people: "applicants",
  users: "applicants",
  bookmark: "save",
  send: "apply",
  eye: "show",
  "eye-off": "hide",
  folder: "library",
  video: "lesson",
  inbox: "empty",
  plus: "add",
  pencil: "edit",
  "map-pin": "pin",
  building: "company",
  briefcase: "work",
  "thumbs-down": "reject",
  x: "close",
  chevronright: "next",
  chevronleft: "back",
  chevronup: "collapse",
  chevrondown: "expand",
  arrowright: "go",
  user: "account",
  "user-round": "account",
  "log-out": "logout",
  "shield-check": "scan",
  "file-text": "resume",
  "cloud-upload": "upload",
  "rotate-ccw": "refresh",
  "check-circle": "check",
  layers: "filters",
};

export function resolveCopilotIconName(name: string): CopilotIconName {
  if (name in ALIASES) return ALIASES[name];
  return name as CopilotIconName;
}

/**
 * Merge-safe 24px marks: strokes never share an edge, connectors stop
 * short of nodes, and filled accents are fill-only.
 */
const glyphs: Record<CopilotIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.2" />
      <path className="ci-a" d="M7.4 15.6v-3" />
      <path className="ci-b" d="M10.5 15.6V9.4" />
      <path className="ci-c" d="M13.6 15.6v-4.2" />
      <path className="ci-d" d="M16.7 15.6V8.2" />
    </>
  ),
  resume: (
    <>
      <path d="M7.2 4.4h6.1L16.8 8v10.6a1.6 1.6 0 0 1-1.6 1.6H7.2A1.6 1.6 0 0 1 5.6 18.6V6a1.6 1.6 0 0 1 1.6-1.6Z" />
      <path className="ci-a" d="M13.3 4.6v3.2h3.3" />
      <path d="M8.4 11.2h6.6M8.4 13.8h5" />
      <path className="ci-b" d="M8.4 16.4h3.4" />
    </>
  ),
  interview: (
    <>
      <path className="ci-a" d="M4.4 10.8h5.8a1.3 1.3 0 0 1 1.3 1.3v2.2a1.3 1.3 0 0 1-1.3 1.3H7L4.4 17.6V10.8Z" />
      <path className="ci-b" d="M19.6 6.2h-5.6a1.2 1.2 0 0 0-1.2 1.2v2a1.2 1.2 0 0 0 1.2 1.2h3.2L19.6 12.4V6.2Z" />
      <circle className="ci-c ci-fill" cx="17.6" cy="8" r="0.8" />
    </>
  ),
  learning: (
    <>
      <circle cx="5.4" cy="7.2" r="1.55" />
      <circle cx="12" cy="12" r="1.55" />
      <circle cx="18.6" cy="16.8" r="1.55" />
      <path d="M7.7 8.85 10.05 10.5M13.95 13.45 16.3 15.15" />
      <circle className="ci-a ci-fill" cx="5.4" cy="7.2" r="0.65" />
    </>
  ),
  jobs: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 4.4v1.7M19.6 12h-1.7M12 19.6v-1.7M4.4 12h1.7" />
      <path className="ci-a" d="M12 8.4A3.6 3.6 0 0 1 15.6 12" />
      <circle className="ci-b ci-fill" cx="16.6" cy="8.2" r="1" />
    </>
  ),
  community: (
    <>
      <circle className="ci-a" cx="7.2" cy="8" r="2" />
      <circle className="ci-b" cx="16.8" cy="8.8" r="2" />
      <circle className="ci-c" cx="12" cy="16.6" r="2" />
      <path d="M10.45 8.28h3.1M8.8 10.85 10.4 13.7M15.1 11.55 13.7 13.8" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8.2" r="2.7" />
      <path d="M6.6 18.6c.6-2.8 2.5-4.2 5.4-4.2s4.8 1.4 5.4 4.2" />
      <path className="ci-a" d="M18.6 12a6.6 6.6 0 1 0-2.2 5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.3" />
      <path className="ci-a" d="M12 9.7V6.4" />
      <circle className="ci-b ci-fill" cx="12" cy="5.5" r="0.7" />
    </>
  ),
  evidence: (
    <>
      <path d="M4.6 7.2h8.2M4.6 11.4h6.2M4.6 15.6h4.6" />
      <circle className="ci-a" cx="16.6" cy="15.2" r="3.1" />
      <path className="ci-a" d="m15.4 15.2.85.85 1.7-1.8" />
    </>
  ),
  skills: (
    <>
      <path d="M4.8 18.2h14.4" />
      <path className="ci-a" d="M7.4 18.2v-4.6" />
      <path className="ci-b" d="M12 18.2V6.8" />
      <path className="ci-c" d="M16.6 18.2v-7.4" />
    </>
  ),
  confidence: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path className="ci-a" d="M12 7.2 13.5 12 12 16.8 10.5 12Z" />
      <circle className="ci-fill" cx="12" cy="12" r="0.85" />
    </>
  ),
  projects: (
    <>
      <rect className="ci-a" x="4.6" y="4.8" width="11.4" height="8.4" rx="1.6" />
      <rect className="ci-b" x="8" y="10.8" width="11.4" height="8.4" rx="1.6" />
    </>
  ),
  assist: (
    <>
      <circle className="ci-a" cx="8.2" cy="12" r="2.1" />
      <path className="ci-b" d="M11.2 10.2c1.8-1.6 3.6-2.2 5.6-2.2" />
      <path className="ci-b" d="M11.2 13.8c1.8 1.6 3.6 2.2 5.6 2.2" />
      <circle className="ci-fill" cx="8.2" cy="12" r="0.7" />
    </>
  ),
  scan: (
    <>
      <rect x="5.4" y="4.6" width="13.2" height="14.8" rx="1.8" />
      <path d="M8 9h8M8 12h5.2M8 15h4" />
      <path className="ci-a" d="M6.8 8.2h10.4" />
    </>
  ),
  search: (
    <>
      <circle className="ci-a" cx="10.6" cy="10.6" r="5.6" />
      <path className="ci-b" d="m15 15 4.2 4.2" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path className="ci-a" d="m8.4 12.2 2.4 2.4 4.8-5" />
    </>
  ),
  close: (
    <>
      <g className="ci-a">
        <path d="m7.2 7.2 9.6 9.6M16.8 7.2 7.2 16.8" />
      </g>
    </>
  ),
  add: (
    <>
      <g className="ci-a">
        <path d="M12 6.4v11.2M6.4 12h11.2" />
      </g>
    </>
  ),
  edit: (
    <>
      <path className="ci-a" d="M14.4 5.8 18.2 9.6 9.2 18.6H5.4v-3.8Z" />
      <path className="ci-b" d="M13 7.2 16.8 11" />
    </>
  ),
  trash: (
    <>
      <path className="ci-a" d="M8.4 6.4h7.2M10.2 6.4V5.2h3.6v1.2" />
      <path className="ci-b" d="M7.4 6.6h9.2l-.7 11.6H8.1Z" />
      <path className="ci-b" d="M10.4 9.6v5.4M13.6 9.6v5.4" />
    </>
  ),
  save: (
    <>
      <path d="M7.2 4.6v15.2" />
      <path className="ci-a" d="M7.4 5.2h8.6l-1.7 3.2 1.7 3.2H7.4" />
    </>
  ),
  apply: (
    <>
      <g className="ci-a">
        <rect x="4.8" y="6.6" width="10.4" height="10.8" rx="1.6" />
        <path d="M7 10h5.6M7 13h3.8" />
        <path d="m14.2 14.4 3.4-3.4 1.5 1.5-3.4 3.4H14.2Z" />
      </g>
    </>
  ),
  reject: (
    <>
      <g className="ci-a">
        <rect x="5.4" y="5.6" width="13.2" height="12.8" rx="2" />
        <path d="m9.2 9.6 5.6 5.6M14.8 9.6l-5.6 5.6" />
      </g>
    </>
  ),
  show: (
    <>
      <path d="M3.8 12s3.5-5.8 8.2-5.8S20.2 12 20.2 12s-3.5 5.8-8.2 5.8S3.8 12 3.8 12Z" />
      <circle cx="12" cy="12" r="2.2" />
      <path className="ci-a" d="M7.2 9.2c1.4-1.2 3-1.8 4.8-1.8s3.4.6 4.8 1.8" />
    </>
  ),
  hide: (
    <>
      <path d="M3.8 12s3.5-5.8 8.2-5.8S20.2 12 20.2 12s-3.5 5.8-8.2 5.8S3.8 12 3.8 12Z" />
      <path className="ci-a" d="m5.2 5.2 13.6 13.6" />
    </>
  ),
  upload: (
    <>
      <path d="M6.4 16v2.2h11.2V16" />
      <g className="ci-a">
        <path d="M12 16.4V7.2" />
        <path d="m8.8 10.2 3.2-3.2 3.2 3.2" />
      </g>
    </>
  ),
  library: (
    <>
      <path className="ci-a" d="M4.8 8.4h5l1.5 1.7h8" />
      <path d="M4.8 10.4h14.4v8.2H4.8Z" />
    </>
  ),
  history: (
    <>
      <circle cx="12.4" cy="12.4" r="7.2" />
      <path className="ci-a" d="M12.4 8.6v4l2.8 1.6" />
      <path d="M7.2 5.6 5.4 8.2h3.2" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path className="ci-a ci-fill" d="M10.2 8.8v6.4l5.4-3.2Z" />
    </>
  ),
  lesson: (
    <>
      <rect className="ci-a" x="3.8" y="6.4" width="16.4" height="11.2" rx="2.2" />
      <circle className="ci-b ci-fill" cx="12" cy="12" r="1.15" />
    </>
  ),
  "lesson-check": (
    <>
      <path d="M5.2 6.2h5.2v11.6H6.4A1.2 1.2 0 0 0 5.2 19V6.2Z" />
      <path d="M18.8 6.2h-5.2v11.6h4A1.2 1.2 0 0 1 18.8 19V6.2Z" />
      <path className="ci-a" d="m13.4 11.4 1.3 1.3 2.4-2.5" />
    </>
  ),
  external: (
    <>
      <path d="M5.2 8.4h7.2V19H5.2Z" />
      <g className="ci-a">
        <path d="M12.8 5.6H19v6.2M18.8 5.8l-6.4 6.4" />
      </g>
    </>
  ),
  refresh: (
    <>
      <g className="ci-a">
        <path d="M6.4 10.4a6 6 0 1 1 .6 5.2" />
        <path d="M6.4 7v3.4H9.8" />
      </g>
    </>
  ),
  alert: (
    <>
      <g className="ci-a">
        <path d="M12 4.8 20 18.6H4Z" />
        <path d="M12 10v3.8" />
        <circle className="ci-fill" cx="12" cy="16.2" r="0.65" />
      </g>
    </>
  ),
  empty: (
    <>
      <path className="ci-a" d="M5.2 9.4h13.6L17.6 18H6.4Z" />
      <path d="M9.4 9.4 10.5 5.6h3l1.1 3.8" />
    </>
  ),
  mail: (
    <>
      <rect x="4" y="6.6" width="16" height="10.8" rx="1.8" />
      <path className="ci-a" d="m4.6 7.6 7.4 5 7.4-5" />
      <path className="ci-b" d="m14.6 13.6 1.2 1.2 2.3-2.4" />
    </>
  ),
  pin: (
    <>
      <g className="ci-a">
        <path d="M12 20.2s6.2-5.8 6.2-10A6.2 6.2 0 0 0 5.8 10.2c0 4.2 6.2 10 6.2 10Z" />
        <circle cx="12" cy="10" r="1.9" />
      </g>
    </>
  ),
  company: (
    <>
      <path d="M5.4 19.6V7.6h8v12" />
      <path d="M13.4 10.6h5.2v9" />
      <path className="ci-a" d="M7.4 10.4h1.5M7.4 13h1.5M7.4 15.6h1.5" />
      <path className="ci-b" d="M15.4 13.2h1.5M15.4 15.8h1.5" />
    </>
  ),
  pay: (
    <>
      <rect x="4.4" y="6.4" width="15.2" height="11.2" rx="1.8" />
      <path d="M7 9.4h4.2" />
      <path className="ci-a" d="M15.4 15.2V9.8" />
      <path d="m14.2 11.2 1.2-1.4 1.2 1.4" />
    </>
  ),
  applicants: (
    <>
      <circle cx="9" cy="8.4" r="2.4" />
      <path d="M5 18.2c.5-2.7 2-4.2 4-4.2" />
      <g className="ci-a">
        <circle cx="15.4" cy="9" r="2.1" />
        <path d="M12.4 18.2c.5-2.4 1.9-3.8 3.7-3.8 2 0 3.4 1.5 4 3.8" />
      </g>
    </>
  ),
  loader: (
    <>
      <g className="ci-a">
        <circle cx="12" cy="12" r="7.2" opacity=".28" />
        <circle className="ci-fill" cx="12" cy="4.8" r="1.4" />
      </g>
    </>
  ),
  filters: (
    <>
      <rect className="ci-a" x="4.8" y="5.2" width="10.6" height="7.6" rx="1.5" />
      <rect className="ci-b" x="8.6" y="11.2" width="10.6" height="7.6" rx="1.5" />
    </>
  ),
  link: (
    <>
      <path className="ci-a" d="M10.2 14.2 8.6 15.8A3 3 0 1 1 4.4 11.6l1.6-1.6" />
      <path className="ci-b" d="M13.8 9.8 15.4 8.2A3 3 0 1 1 19.6 12.4l-1.6 1.6" />
    </>
  ),
  menu: (
    <>
      <path className="ci-a" d="M5.2 7.4h13.6" />
      <path className="ci-b" d="M5.2 12h13.6" />
      <path className="ci-c" d="M5.2 16.6h13.6" />
    </>
  ),
  next: <path className="ci-a" d="m9 6.6 6 5.4-6 5.4" />,
  back: <path className="ci-a" d="M15 6.6 9 12l6 5.4" />,
  collapse: <path className="ci-a" d="m6.6 15 5.4-6 5.4 6" />,
  expand: <path className="ci-a" d="m6.6 9 5.4 6 5.4-6" />,
  go: (
    <g className="ci-a">
      <path d="M5 12h13.2M14.4 8 19 12l-4.6 4" />
    </g>
  ),
  account: (
    <>
      <rect x="6.6" y="10.6" width="10.8" height="8" rx="1.8" />
      <path className="ci-a" d="M8.8 10.6V8.6a3.2 3.2 0 0 1 6.4 0v2" />
    </>
  ),
  logout: (
    <>
      <path d="M5.2 6.4h7.6v11.2H5.2" />
      <path className="ci-a" d="M11 12h8.2M16.4 8.8 19.4 12l-3 3.2" />
    </>
  ),
  sun: (
    <>
      <circle className="ci-a" cx="12" cy="12" r="3.2" />
      <g className="ci-b">
        <path d="M12 4.8v1.6M12 17.6v1.6M4.8 12h1.6M17.6 12h1.6M6.8 6.8l1.1 1.1M16.1 16.1l1.1 1.1M6.8 17.2l1.1-1.1M16.1 7.9l1.1-1.1" />
      </g>
    </>
  ),
  moon: (
    <path className="ci-a" d="M14.4 5.6A7.2 7.2 0 1 0 18.4 15 5.6 5.6 0 0 1 14.4 5.6Z" />
  ),
  work: (
    <>
      <rect x="4.4" y="8.4" width="15.2" height="10.2" rx="1.8" />
      <path d="M9 8.4V6.8a1.4 1.4 0 0 1 1.4-1.4h3.2A1.4 1.4 0 0 1 15 6.8v1.6" />
      <path className="ci-a" d="M4.6 12.4h14.8" />
    </>
  ),
  trend: (
    <>
      <path d="M4.6 16.6h14.8" />
      <path className="ci-a" d="M5.4 13.2 9.6 9l3.2 3.2 6-6" />
      <path d="M15.4 6.2h3.4v3.4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path className="ci-a" d="M12 7.4 14.4 14.4 7.4 12Z" />
    </>
  ),
  idle: <circle cx="12" cy="12" r="7.2" />,
  linkedin: (
    <>
      <rect x="4.6" y="4.6" width="14.8" height="14.8" rx="2.2" />
      <path d="M8.2 10.6v5.6M8.2 8.2v.2" />
      <path d="M11.4 16.2v-3.4a1.8 1.8 0 0 1 3.6 0v3.4" />
    </>
  ),
  github: (
    <>
      <path d="M12 4.6a7.4 7.4 0 0 0-2.3 14.4c.4.08.5-.16.5-.36v-1.3c-2.2.48-2.6-1.06-2.6-1.06-.36-.9-.88-1.14-.88-1.14-.72-.5.06-.5.06-.5.8.06 1.22.82 1.22.82.72 1.22 1.88.86 2.34.66.08-.52.28-.86.5-1.06-1.74-.2-3.56-.88-3.56-3.9 0-.86.3-1.56.8-2.12-.08-.2-.36-1.02.08-2.12 0 0 .66-.22 2.16.82a7.4 7.4 0 0 1 3.94 0c1.5-1.04 2.16-.82 2.16-.82.44 1.1.16 1.92.08 2.12.5.56.8 1.26.8 2.12 0 3.04-1.84 3.7-3.58 3.9.28.24.54.72.54 1.46v2.16c0 .2.16.44.52.36A7.4 7.4 0 0 0 12 4.6Z" />
    </>
  ),
  twitter: (
    <path d="M6.2 6.4h3.2l3 4.2 3.6-4.2H18l-5.2 6 5.4 5.6h-3.2l-3.4-4.4-4 4.4H6.2l5.6-6.2Z" />
  ),
  dribbble: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M6.2 9.4c3.4 0 7.4.4 11.2 3.6M8.2 18.2c1.6-3.4 3.2-7.8 3-13.4M18.4 14.6c-2.6-1-6.8-1.2-11.6 1.8" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.4 12h15.2M12 4.4c2.4 2.6 3.6 5.2 3.6 7.6s-1.2 5-3.6 7.6M12 4.4C9.6 7 8.4 9.6 8.4 12s1.2 5 3.6 7.6" />
    </>
  ),
};

export type CopilotIconProps = {
  name: CopilotIconName | string;
  size?: number | string;
  className?: string;
  loop?: boolean;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name" | "ref">;

export function CopilotIcon({
  name,
  size = 20,
  className,
  loop,
  title,
  ...svgProps
}: CopilotIconProps) {
  const reducedMotion = useReducedMotion();
  const spanRef = useRef<HTMLSpanElement>(null);
  const [parentActive, setParentActive] = useState(false);
  const resolved = resolveCopilotIconName(String(name));
  const glyph = glyphs[resolved] ?? glyphs.search;
  const labelled = Boolean(
    title || (svgProps as { "aria-label"?: string })["aria-label"],
  );
  const spinning =
    !reducedMotion && (loop || resolved === "loader" || className?.includes("spin"));

  useEffect(() => {
    const node = spanRef.current;
    if (!node) return;
    const parent = node.closest(
      'button, a, [role="button"], [role="menuitem"], .job-card, .home-feature, .sidebar-account-menu-item, .home-actions, .theme-toggle, .lp-step, .lp-run, .btn',
    );
    if (!parent) return;
    const on = () => setParentActive(true);
    const off = () => setParentActive(false);
    parent.addEventListener("mouseenter", on);
    parent.addEventListener("mouseleave", off);
    parent.addEventListener("pointerdown", on);
    parent.addEventListener("pointerup", off);
    parent.addEventListener("focus", on);
    parent.addEventListener("blur", off);
    return () => {
      parent.removeEventListener("mouseenter", on);
      parent.removeEventListener("mouseleave", off);
      parent.removeEventListener("pointerdown", on);
      parent.removeEventListener("pointerup", off);
      parent.removeEventListener("focus", on);
      parent.removeEventListener("blur", off);
    };
  }, []);

  return (
    <span
      ref={spanRef}
      className={["copilot-icon", className].filter(Boolean).join(" ")}
      data-icon={resolved}
      data-active={parentActive ? "true" : undefined}
      data-spin={spinning ? "true" : undefined}
      data-reduced={reducedMotion ? "true" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        lineHeight: 0,
        width: size,
        height: size,
        color: "currentColor",
      }}
      aria-hidden={labelled ? undefined : true}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={labelled ? undefined : true}
        {...svgProps}
      >
        {title ? <title>{title}</title> : null}
        {glyph}
      </svg>
    </span>
  );
}

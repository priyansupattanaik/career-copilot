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
 * Mathematically balanced 24px marks:
 * - Uniform 1.75px stroke weight
 * - Sits strictly within [2, 2] to [22, 22] live canvas
 * - Zero stroke collisions, duplicate overlaps, or line crossing
 * - Authentic filled brand marks (GitHub, Twitter/X)
 */
const glyphs: Record<CopilotIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  resume: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline className="ci-a" points="14 2 14 8 20 8" />
      <line className="ci-b" x1="16" y1="13" x2="8" y2="13" />
      <line className="ci-b" x1="16" y1="17" x2="8" y2="17" />
      <line className="ci-b" x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  interview: (
    <>
      <path
        className="ci-a"
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      />
      <line className="ci-b" x1="8" y1="9" x2="16" y2="9" />
      <line className="ci-b" x1="8" y1="13" x2="14" y2="13" />
    </>
  ),
  learning: (
    <>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path className="ci-a" d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
    </>
  ),
  jobs: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line className="ci-a" x1="22" y1="12" x2="18" y2="12" />
      <line className="ci-a" x1="6" y1="12" x2="2" y2="12" />
      <line className="ci-a" x1="12" y1="6" x2="12" y2="2" />
      <line className="ci-a" x1="12" y1="22" x2="12" y2="18" />
      <circle className="ci-b" cx="12" cy="12" r="4" />
    </>
  ),
  community: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path className="ci-a" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path className="ci-b" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  profile: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle className="ci-a" cx="12" cy="7" r="4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        className="ci-a"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
      />
    </>
  ),
  evidence: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline className="ci-a" points="9 12 11 14 15 10" />
    </>
  ),
  skills: (
    <>
      <line className="ci-a" x1="6" y1="20" x2="6" y2="14" />
      <line className="ci-b" x1="12" y1="20" x2="12" y2="9" />
      <line className="ci-c" x1="18" y1="20" x2="18" y2="4" />
    </>
  ),
  confidence: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon
        className="ci-a"
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
      />
    </>
  ),
  projects: (
    <>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline className="ci-a" points="2 17 12 22 22 17" />
      <polyline className="ci-b" points="2 12 12 17 22 12" />
    </>
  ),
  assist: (
    <path
      className="ci-a"
      d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
    />
  ),
  scan: (
    <>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
      <line className="ci-a" x1="4" y1="12" x2="20" y2="12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line className="ci-a" x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  check: <polyline className="ci-a" points="20 6 9 17 4 12" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  add: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path
        className="ci-a"
        d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
      />
    </>
  ),
  trash: (
    <>
      <path
        className="ci-a"
        d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      />
      <path
        className="ci-b"
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"
      />
      <line className="ci-b" x1="10" y1="11" x2="10" y2="17" />
      <line className="ci-b" x1="14" y1="11" x2="14" y2="17" />
    </>
  ),
  save: (
    <path
      className="ci-a"
      d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
    />
  ),
  apply: (
    <>
      <line className="ci-a" x1="22" y1="2" x2="11" y2="13" />
      <polygon className="ci-a" points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  reject: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line className="ci-a" x1="15" y1="9" x2="9" y2="15" />
      <line className="ci-a" x1="9" y1="9" x2="15" y2="15" />
    </>
  ),
  show: (
    <>
      <path
        className="ci-a"
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      />
      <circle className="ci-b" cx="12" cy="12" r="3" />
    </>
  ),
  hide: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line className="ci-a" x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline className="ci-a" points="17 8 12 3 7 8" />
      <line className="ci-a" x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  library: (
    <path
      className="ci-a"
      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
    />
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline className="ci-a" points="12 6 12 12 16 14" />
    </>
  ),
  play: (
    <polygon className="ci-a ci-fill" points="5 3 19 12 5 21 5 3" />
  ),
  lesson: (
    <>
      <polygon className="ci-a" points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  "lesson-check": (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <polyline className="ci-a" points="9 10 11 12 15 8" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline className="ci-a" points="15 3 21 3 21 9" />
      <line className="ci-a" x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  refresh: (
    <g className="ci-a">
      <path d="M23 4v6h-6" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </g>
  ),
  alert: (
    <g className="ci-a">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </g>
  ),
  empty: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path
        className="ci-a"
        d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
      />
    </>
  ),
  mail: (
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline className="ci-a" points="22,6 12,13 2,6" />
    </>
  ),
  pin: (
    <g className="ci-a">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </g>
  ),
  company: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path
        className="ci-a"
        d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"
      />
    </>
  ),
  pay: (
    <>
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line className="ci-a" x1="1" y1="10" x2="23" y2="10" />
    </>
  ),
  applicants: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path className="ci-a" d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path className="ci-a" d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  loader: (
    <path className="ci-a" d="M21 12a9 9 0 1 1-6.219-8.56" />
  ),
  filters: (
    <polygon
      className="ci-a"
      points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
    />
  ),
  link: (
    <>
      <path
        className="ci-a"
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      />
      <path
        className="ci-b"
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      />
    </>
  ),
  menu: (
    <>
      <line className="ci-a" x1="3" y1="12" x2="21" y2="12" />
      <line className="ci-b" x1="3" y1="6" x2="21" y2="6" />
      <line className="ci-c" x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  next: <polyline className="ci-a" points="9 18 15 12 9 6" />,
  back: <polyline className="ci-a" points="15 18 9 12 15 6" />,
  collapse: <polyline className="ci-a" points="18 15 12 9 6 15" />,
  expand: <polyline className="ci-a" points="6 9 12 15 18 9" />,
  go: (
    <g className="ci-a">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </g>
  ),
  account: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle className="ci-a" cx="12" cy="7" r="4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline className="ci-a" points="16 17 21 12 16 7" />
      <line className="ci-a" x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  sun: (
    <>
      <circle className="ci-a" cx="12" cy="12" r="5" />
      <g className="ci-b">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </g>
    </>
  ),
  moon: (
    <path
      className="ci-a"
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    />
  ),
  work: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path
        className="ci-a"
        d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
      />
    </>
  ),
  trend: (
    <g className="ci-a">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </g>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon
        className="ci-a"
        points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
      />
    </>
  ),
  idle: <circle cx="12" cy="12" r="10" />,
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  github: (
    <path
      className="ci-fill"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  ),
  twitter: (
    <path
      className="ci-fill"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  ),
  dribbble: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94" />
      <path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" />
      <path d="M8.56 2.75c4.37 6 6 9.42 8 17.72" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
        flexShrink: 0,
      }}
      aria-hidden={labelled ? undefined : true}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
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

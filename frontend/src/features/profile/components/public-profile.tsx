import { useEffect, useMemo, useState } from "react";
import { Link } from "@/shared/ui/router-link";
import { ACCESS_TOKEN_STORAGE_KEY, resolveApiBase } from "@/shared/config";
import { demoApiRequest, isDemoSession } from "@/features/auth/demo-session";
import { isAbortError } from "@/shared/api/client";
import { BrandMark } from "@/components/ui/brand-mark";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { isProfileOwner } from "@/features/profile/model/public-profile-username";
import { motion, useReducedMotion } from "motion/react";
import {
  staggerContainerVariants,
  staggerItemVariants,
  FLUID_SPRING_TRANSITION,
  FAST_SPRING_TRANSITION,
} from "@/components/ui/motion-system";

type PublicProfilePayload = {
  profile: Record<string, unknown>;
  sections: {
    links?: Array<{ id?: string; url?: string; link_type?: string; label?: string; display_order?: number }>;
    projects?: Array<{ id?: string; title?: string; role?: string; description?: string; github_url?: string; github?: string; live_url?: string; live?: string; url?: string }>;
    skills?: Array<{ id?: string; name?: string }>;
    experiences?: Array<{ id?: string; role_title?: string; company_name?: string; location?: string; start_date?: string; end_date?: string; is_current?: boolean; summary?: string }>;
    education?: Array<{ id?: string; institution?: string; degree?: string; field_of_study?: string }>;
    certifications?: Array<{ id?: string; name?: string; issuer?: string }>;
    languages?: Array<{ id?: string; language?: string; proficiency?: string }>;
  };
};

function isValidHttpUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function ExternalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 5h5v5M10 14 19 5M19 11v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h8" />
    </svg>
  );
}

function LinkTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const t = String(type).toLowerCase();
  if (t === "github") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.4a9.6 9.6 0 0 0-3.03 18.72c.48.09.66-.2.66-.45v-1.62c-2.68.59-3.25-1.13-3.25-1.13-.44-1.12-1.08-1.42-1.08-1.42-.88-.6.07-.59.07-.59 1 .07 1.52 1.03 1.52 1.03.87 1.5 2.29 1.07 2.84.82.09-.63.34-1.07.61-1.31-2.14-.25-4.39-1.07-4.39-4.78 0-1.05.38-1.92 1-2.59-.1-.25-.43-1.24.1-2.58 0 0 .81-.26 2.65.99A9.2 9.2 0 0 1 12 7.1a9.2 9.2 0 0 1 2.42.33c1.84-1.25 2.65-.99 2.65-.99.54 1.34.2 2.33.1 2.58.62.67 1 1.54 1 2.59 0 3.72-2.25 4.52-4.4 4.77.35.3.66.9.66 1.81v2.69c0 .25.18.55.66.45A9.6 9.6 0 0 0 12 2.4Z" />
      </svg>
    );
  }
  if (t === "linkedin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5.8 8.2h3.1v9.4H5.8zM7.35 6.6a1.8 1.8 0 1 1 0-3.6 1.8 1.8 0 0 1 0 3.6Z" />
        <path d="M11.2 8.2h3v1.3h.04c.42-.8 1.45-1.64 2.99-1.64 3.2 0 3.79 2.1 3.79 4.83v4.91h-3.1v-4.36c0-1.04-.02-2.38-1.45-2.38-1.45 0-1.67 1.14-1.67 2.31v4.43h-3.1V8.2Z" />
      </svg>
    );
  }
  if (t === "portfolio" || t === "website") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 4 9 14 14 0 0 1-4 9 14 14 0 0 1-4-9 14 14 0 0 1 4-9Z" />
      </svg>
    );
  }
  return <ExternalIcon size={size} />;
}

function getInitialSession(): { isLoggedIn: boolean; initialHandle: string | null } {
  if (typeof window === "undefined") return { isLoggedIn: false, initialHandle: null };
  if (isDemoSession()) return { isLoggedIn: true, initialHandle: "demo" };
  const hasToken = Boolean(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY));
  if (!hasToken) return { isLoggedIn: false, initialHandle: null };
  try {
    const raw = window.sessionStorage.getItem("career_copilot_bootstrap_cache");
    if (raw) {
      const parsed = JSON.parse(raw);
      const handle = parsed?.profile?.username || parsed?.workspace?.profile?.username;
      if (handle) return { isLoggedIn: true, initialHandle: String(handle) };
    }
  } catch {
    // storage errors ignored
  }
  return { isLoggedIn: true, initialHandle: null };
}

export function PublicProfile({ username }: { username: string }) {
  const shouldReduceMotion = useReducedMotion();
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [initialSession] = useState(getInitialSession);
  const isLoggedIn = initialSession.isLoggedIn;
  const [sessionUsername, setSessionUsername] = useState<string | null>(initialSession.initialHandle);

  useEffect(() => {
    if (isLoggedIn && sessionUsername === null) {
      let active = true;
      const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
      if (token) {
        fetch(`${resolveApiBase()}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((res) => {
            if (active && res?.profile?.username) {
              setSessionUsername(res.profile.username);
            }
          })
          .catch(() => undefined);
      }
      return () => {
        active = false;
      };
    }
  }, [isLoggedIn, sessionUsername]);

  const isOwner = useMemo(() => {
    return isProfileOwner(sessionUsername, username);
  }, [sessionUsername, username]);

  function handleShare() {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    void copyTextToClipboard(url).then((success) => {
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    });
  }

  const displayLinks = useMemo(() => {
    const links = data?.sections.links ?? [];
    const priority: Record<string, number> = { linkedin: 0, github: 1, portfolio: 2, website: 3, other: 4 };
    return [...links]
      .filter((row) => isValidHttpUrl(row.url))
      .sort((a, b) => {
        const pa = priority[String(a.link_type || "other").toLowerCase()] ?? 4;
        const pb = priority[String(b.link_type || "other").toLowerCase()] ?? 4;
        if (pa !== pb) return pa - pb;
        return (a.display_order as number || 0) - (b.display_order as number || 0);
      });
  }, [data]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setError("");
    setData(null);
    const path = `/public/profiles/${encodeURIComponent(username)}`;
    const load = isDemoSession()
      ? demoApiRequest<PublicProfilePayload>(path, { signal: controller.signal })
      : fetch(`${resolveApiBase()}${path}`, { signal: controller.signal }).then(async (response) => {
          if (!response.ok) throw new Error(response.status === 404 ? "Profile not found." : "Could not load this profile.");
          return response.json() as Promise<PublicProfilePayload>;
        });
    load
      .then((payload) => {
        if (active && !controller.signal.aborted) setData(payload);
      })
      .catch((reason: Error) => {
        if (!active || isAbortError(reason) || controller.signal.aborted) return;
        setError(reason.message || "Could not load this profile.");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [username]);

  if (error) {
    return (
      <main className="public-profile-page">
        <div className="public-profile-container">
          <header className="public-profile-navbar" aria-label="Page navigation">
            <Link href={isLoggedIn ? "/dashboard" : "/"} className="public-profile-navbar-brand">
              <BrandMark compact />
              <span>Career Copilot</span>
            </Link>
            <div className="public-profile-navbar-actions">
              <ThemeToggle compact />
              {isLoggedIn ? (
                <Link className="button button-secondary public-profile-nav-secondary" href="/dashboard">
                  Dashboard
                </Link>
              ) : (
                <Link className="button button-primary public-profile-nav-cta" href="/sign-in">
                  Sign in
                </Link>
              )}
            </div>
          </header>
          <section className="public-profile-error-card" role="alert">
            <div className="public-profile-error-icon" aria-hidden="true">
              <CopilotIcon name="alert" size={28} />
            </div>
            <h1>Candidate profile not found</h1>
            <p>
              The candidate profile <strong>@{username}</strong> could not be found or is set to private.
            </p>
            <div className="public-profile-error-actions">
              <Link className="button button-primary" href="/community">
                Explore community
              </Link>
              {isLoggedIn ? (
                <Link className="button button-secondary" href="/dashboard">
                  Go to dashboard
                </Link>
              ) : null}
              <Link className="button button-secondary" href="/">
                Return home
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="public-profile-page">
        <div className="public-profile-container">
          <header className="public-profile-navbar" aria-label="Page navigation">
            <Link href={isLoggedIn ? "/dashboard" : "/"} className="public-profile-navbar-brand">
              <BrandMark compact />
              <span>Career Copilot</span>
            </Link>
            <div className="public-profile-navbar-actions">
              <ThemeToggle compact />
              {isLoggedIn ? (
                <Link className="button button-secondary public-profile-nav-secondary" href="/dashboard">
                  Dashboard
                </Link>
              ) : (
                <Link className="button button-primary public-profile-nav-cta" href="/sign-in">
                  Sign in
                </Link>
              )}
            </div>
          </header>
          <div className="public-profile-skeleton-card" role="status" aria-live="polite">
            <div className="public-profile-skeleton-row">
              <div className="public-profile-skeleton-avatar" />
              <div className="public-profile-skeleton-lines">
                <div className="public-profile-skeleton-line" style={{ width: "45%", height: 28 }} />
                <div className="public-profile-skeleton-line" style={{ width: "70%", height: 16 }} />
                <div className="public-profile-skeleton-line" style={{ width: "30%", height: 14 }} />
              </div>
            </div>
            <p className="sr-only">Loading candidate profile…</p>
          </div>
        </div>
      </main>
    );
  }

  const profile = data.profile;
  const avatarUrl = typeof profile.avatar_url === "string" ? (profile.avatar_url as string) : null;
  const initials = String(profile.full_name || profile.username || "?")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

  const projects = data.sections.projects || [];
  const skills = data.sections.skills || [];
  const experiences = data.sections.experiences || [];
  const education = data.sections.education || [];
  const certifications = data.sections.certifications || [];
  const languages = data.sections.languages || [];

  const hasHeaderFacts = Boolean(profile.current_role || profile.location || profile.years_experience != null || profile.career_level);
  const handle = String(profile.username || username);

  return (
    <main className="public-profile-page">
      <div className="public-profile-container">
        <header className="public-profile-navbar" aria-label="Page navigation">
          <Link href={isLoggedIn ? "/dashboard" : "/"} className="public-profile-navbar-brand">
            <BrandMark compact />
            <span>Career Copilot</span>
          </Link>
          <div className="public-profile-navbar-actions">
            <ThemeToggle compact />
            <button
              type="button"
              className="public-profile-share-btn"
              onClick={handleShare}
              aria-label="Copy candidate profile link"
              title="Copy candidate profile link"
            >
              <CopilotIcon name={copied ? "check" : "link"} size={14} />
              <span>{copied ? "Link copied!" : "Share profile"}</span>
            </button>
            {isOwner ? (
              <>
                <Link className="button button-primary public-profile-nav-cta" href="/settings/profile">
                  <CopilotIcon name="edit" size={14} />
                  <span>Edit profile</span>
                </Link>
                <Link className="button button-secondary public-profile-nav-secondary" href="/dashboard">
                  Dashboard
                </Link>
              </>
            ) : isLoggedIn ? (
              <>
                <Link className="button button-secondary public-profile-nav-secondary" href="/settings/profile">
                  My profile
                </Link>
                <Link className="button button-primary public-profile-nav-cta" href="/dashboard">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link className="button button-secondary public-profile-nav-secondary" href="/jobs">
                  Explore jobs
                </Link>
                <Link className="button button-primary public-profile-nav-cta" href="/sign-up">
                  Build your own
                </Link>
              </>
            )}
          </div>
        </header>

        <motion.div
          className="public-profile-body"
          variants={staggerContainerVariants}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
        >
          <motion.header
            className="public-profile-hero"
            variants={staggerItemVariants}
            transition={FLUID_SPRING_TRANSITION}
          >
            <div className="public-profile-hero-main">
              <div className="public-profile-avatar" aria-hidden={avatarUrl ? undefined : true}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={`${String(profile.full_name || profile.username || "Profile")} avatar`}
                    width={112}
                    height={112}
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "grid";
                    }}
                  />
                ) : null}
                <span
                  className="public-profile-avatar-fallback"
                  style={avatarUrl ? { display: "none" } : undefined}
                  aria-label={avatarUrl ? undefined : `${String(profile.full_name || profile.username || "Profile")} initials`}
                >
                  {initials}
                </span>
              </div>
              <div className="public-profile-hero-copy">
                <h1>{String(profile.full_name || profile.username || "Career profile")}</h1>
                {profile.headline ? <p className="public-profile-headline">{String(profile.headline)}</p> : null}
                <p className="public-profile-handle">/{handle}</p>
                {hasHeaderFacts ? (
                  <div className="public-profile-facts">
                    {[profile.current_role, profile.location, profile.career_level, profile.years_experience != null ? `${profile.years_experience} years` : null]
                      .filter(Boolean)
                      .map((fact) => (
                        <span key={String(fact)}>{String(fact)}</span>
                      ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="public-profile-hero-actions">
              {isOwner ? (
                <Link className="public-profile-cta" href="/settings/profile">
                  <CopilotIcon name="edit" size={14} />
                  <span>Edit profile</span>
                </Link>
              ) : isLoggedIn ? (
                <Link className="public-profile-cta" href="/community">
                  <CopilotIcon name="community" size={14} />
                  <span>Explore community</span>
                </Link>
              ) : (
                <Link className="public-profile-cta" href="/sign-up">
                  Build your own
                </Link>
              )}
            </div>
          </motion.header>


        {profile.bio ? (
          <motion.section
            className="public-profile-card public-profile-bio-card"
            variants={staggerItemVariants}
          >
            <h2>About</h2>
            <p className="public-profile-bio">{String(profile.bio)}</p>
          </motion.section>
        ) : null}

        {displayLinks.length > 0 ? (
          <motion.section
            className="public-profile-card"
            variants={staggerItemVariants}
          >
            <div className="public-profile-card-head">
              <h2>Connect</h2>
              <span className="public-profile-card-count">{displayLinks.length}</span>
            </div>
            <div className="public-profile-links">
              {displayLinks.map((row) => {
                const url = String(row.url || "");
                const type = String(row.link_type || "other");
                const label = String(row.label || (type.charAt(0).toUpperCase() + type.slice(1)));
                return (
                  <motion.a
                    key={String(row.id || url)}
                    className="public-profile-link"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    transition={FAST_SPRING_TRANSITION}
                  >
                    <span className="public-profile-link-icon">
                      <LinkTypeIcon type={type} size={16} />
                    </span>
                    <span className="public-profile-link-text">
                      <span className="public-profile-link-label">{label}</span>
                      <span className="public-profile-link-url">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    </span>
                    <ExternalIcon size={14} />
                  </motion.a>
                );
              })}
            </div>
          </motion.section>
        ) : null}

        {projects.length > 0 ? (
          <motion.section
            className="public-profile-card"
            variants={staggerItemVariants}
          >
            <div className="public-profile-card-head">
              <h2>Projects</h2>
              <span className="public-profile-card-count">{projects.length}</span>
            </div>
            <div className="public-profile-projects">
              {projects.map((row) => {
                const title = String(row.title || "Untitled project");
                const role = String(row.role || "").trim();
                const desc = String(row.description || "").trim();
                const github = String(row.github_url || row.github || "").trim();
                const live = String(row.live_url || row.live || row.url || "").trim();
                const hasGithub = isValidHttpUrl(github);
                const hasLive = isValidHttpUrl(live);
                return (
                  <motion.article
                    key={String(row.id || title)}
                    className="public-profile-project"
                    whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                    transition={FLUID_SPRING_TRANSITION}
                  >
                    <div className="public-profile-project-head">
                      <h3>{title}</h3>
                      {role ? <span className="public-profile-project-role">{role}</span> : null}
                    </div>
                    {desc ? <p className="public-profile-project-desc">{desc}</p> : null}
                    {(hasGithub || hasLive) ? (
                      <div className="public-profile-project-links">
                        {hasGithub ? (
                          <a className="public-profile-project-link is-github" href={github} target="_blank" rel="noreferrer">
                            <LinkTypeIcon type="github" size={14} /> GitHub <ExternalIcon size={12} />
                          </a>
                        ) : null}
                        {hasLive ? (
                          <a className="public-profile-project-link is-live" href={live} target="_blank" rel="noreferrer">
                            <LinkTypeIcon type="portfolio" size={14} /> Live demo <ExternalIcon size={12} />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </motion.article>
                );
              })}
            </div>
          </motion.section>
        ) : null}

        <div className="public-profile-grid">
          {skills.length > 0 ? (
            <motion.section
              className="public-profile-card"
              variants={staggerItemVariants}
            >
              <div className="public-profile-card-head">
                <h2>Skills</h2>
                <span className="public-profile-card-count">{skills.length}</span>
              </div>
              <div className="public-profile-tags">
                {skills.map((row) => (
                  <span key={String(row.id || row.name)}>{String(row.name)}</span>
                ))}
              </div>
            </motion.section>
          ) : null}

          {experiences.length > 0 ? (
            <motion.section
              className="public-profile-card"
              variants={staggerItemVariants}
            >
              <div className="public-profile-card-head">
                <h2>Experience</h2>
                <span className="public-profile-card-count">{experiences.length}</span>
              </div>
              <div className="public-profile-records">
                {experiences.map((row, index) => (
                  <article key={String(row.id || index)}>
                    <strong>{String(row.role_title || "Experience")}</strong>
                    <span className="public-profile-record-meta">{[row.company_name, row.location].filter(Boolean).join(" · ")}</span>
                    {(row.start_date || row.end_date || row.is_current) ? (
                      <span className="public-profile-record-dates">
                        {String(row.start_date || "").slice(0, 10) || "—"} –{" "}
                        {row.is_current ? "Present" : String(row.end_date || "").slice(0, 10) || "—"}
                      </span>
                    ) : null}
                    {row.summary ? <span>{String(row.summary)}</span> : null}
                  </article>
                ))}
              </div>
            </motion.section>
          ) : null}

          {education.length > 0 ? (
            <motion.section
              className="public-profile-card"
              variants={staggerItemVariants}
            >
              <div className="public-profile-card-head">
                <h2>Education</h2>
                <span className="public-profile-card-count">{education.length}</span>
              </div>
              <div className="public-profile-records">
                {education.map((row, index) => (
                  <article key={String(row.id || index)}>
                    <strong>{String(row.institution || "Education")}</strong>
                    <span>{[row.degree, row.field_of_study].filter(Boolean).join(" · ")}</span>
                  </article>
                ))}
              </div>
            </motion.section>
          ) : null}

          {certifications.length > 0 ? (
            <motion.section
              className="public-profile-card"
              variants={staggerItemVariants}
            >
              <div className="public-profile-card-head">
                <h2>Certifications</h2>
                <span className="public-profile-card-count">{certifications.length}</span>
              </div>
              <div className="public-profile-records">
                {certifications.map((row, index) => (
                  <article key={String(row.id || index)}>
                    <strong>{String(row.name || "Certification")}</strong>
                    <span>{String(row.issuer || "")}</span>
                  </article>
                ))}
              </div>
            </motion.section>
          ) : null}

          {languages.length > 0 ? (
            <motion.section
              className="public-profile-card"
              variants={staggerItemVariants}
            >
              <div className="public-profile-card-head">
                <h2>Languages</h2>
                <span className="public-profile-card-count">{languages.length}</span>
              </div>
              <div className="public-profile-tags">
                {languages.map((row, index) => (
                  <span key={String(row.id || index)}>
                    {String(row.language || "")}
                    {row.proficiency ? ` · ${String(row.proficiency)}` : ""}
                  </span>
                ))}
              </div>
            </motion.section>
          ) : null}
        </div>

        {skills.length === 0 && experiences.length === 0 && education.length === 0 && projects.length === 0 && certifications.length === 0 && languages.length === 0 ? (
          <motion.section
            className="public-profile-card public-profile-empty-card"
            variants={staggerItemVariants}
          >
            <p className="muted">This profile hasn’t added public sections yet.</p>
          </motion.section>
        ) : null}
      </motion.div>
      </div>
    </main>
  );
}

import { useEffect, useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button, Card, Badge } from "@/shared/ui/primitives";
import { Link } from "@/shared/ui/router-link";
import { resolveApiBase } from "@/shared/config";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "@/components/ui/motion-system";
import { isDemoSession, demoApiRequest } from "@/features/auth/demo-session";
import { isAbortError } from "@/shared/api/client";

type PublicProfileResult = {
  username: string;
  full_name?: string | null;
  headline?: string | null;
  current_role?: string | null;
  career_level?: string | null;
  location?: string | null;
};

const SUGGESTION_CHIPS = [
  "AI engineer",
  "fresher",
  "designer",
  "data scientist",
  "backend",
] as const;

function normalizeSearchQuery(raw: string) {
  let value = raw.trim();
  if (value.startsWith("@")) value = value.slice(1).trim();
  return value.replace(/\s+/g, " ");
}

function searchPath(query: string) {
  const params = new URLSearchParams({
    q: normalizeSearchQuery(query),
    limit: "20",
  });
  return `/public/profiles/search?${params.toString()}`;
}

async function fetchPublicProfiles(
  query: string,
  signal: AbortSignal,
): Promise<PublicProfileResult[]> {
  if (isDemoSession()) {
    const rows = await demoApiRequest<PublicProfileResult[]>(
      searchPath(query),
      { signal },
    );
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return Array.isArray(rows) ? rows : [];
  }
  const response = await fetch(`${resolveApiBase()}${searchPath(query)}`, {
    signal,
  });
  if (!response.ok) throw new Error("Could not search public profiles.");
  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
}

export function CommunityProfiles() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfileResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reduceMotion = useReducedMotion();

  const needle = normalizeSearchQuery(query);
  const searching = needle.length >= 2;

  useEffect(() => {
    if (!searching) {
      setResults([]);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const timer = window.setTimeout(() => {
      fetchPublicProfiles(needle, controller.signal)
        .then((rows) => {
          if (controller.signal.aborted) return;
          setError("");
          setResults(rows);
        })
        .catch((reason: Error) => {
          if (isAbortError(reason) || controller.signal.aborted) return;
          setResults([]);
          setError(reason.message || "Could not search public profiles.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [needle, searching]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (needle.length >= 2) return;
    setResults([]);
    setError("Enter at least 2 characters.");
  }

  const containerVariants = reduceMotion
    ? { hidden: {}, visible: {} }
    : staggerContainerVariants;
  const itemVariants = reduceMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : staggerItemVariants;

  return (
    <motion.main
      className="feature-page community-page"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Hero masthead */}
      <motion.header className="community-hero" variants={itemVariants}>
        <div className="community-hero-icon">
          <CopilotIcon name="community" size={22} />
        </div>
        <div className="community-hero-copy">
          <h1>Find people worth learning from</h1>
          <p>
            Search public profiles by name, username, profession, career level,
            goal, or location. Use real journeys as inspiration without exposing
            resumes.
          </p>
        </div>
      </motion.header>

      {/* Search card */}
      <motion.div variants={itemVariants}>
        <Card className="community-search-card">
          <div className="community-search-heading">
            <span className="community-search-mark">
              <CopilotIcon name="search" size={18} />
            </span>
            <div>
              <h2>Explore the community</h2>
              <p className="muted">
                Matches appear as you type. Nothing is listed until you search.
              </p>
            </div>
          </div>
          <form
            className="community-search-form"
            role="search"
            onSubmit={onSubmit}
          >
            <input
              aria-label="Search community profiles"
              value={query}
              onChange={(event) => {
                setError("");
                setQuery(event.target.value);
              }}
              placeholder="Name, @username, AI engineer, fresher..."
            />
            <Button type="submit" disabled={busy}>
              <CopilotIcon name="search" size={16} />
              {busy ? "Searching..." : "Search"}
            </Button>
          </form>

          {/* Suggestion chips */}
          <div className="community-chips" aria-label="Quick searches">
            <span className="community-chips-label">Try:</span>
            {SUGGESTION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="community-chip"
                onClick={() => {
                  setError("");
                  setQuery(chip);
                }}
              >
                {chip}
              </button>
            ))}
          </div>

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}

          {results.length ? (
            <div
              className="community-results"
              aria-label="Community profile results"
              aria-busy={busy}
            >
              {results.map((person, index) => (
                <motion.div
                  key={person.username}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.36,
                    delay: reduceMotion ? 0 : index * 0.04,
                  }}
                >
                  <Link
                    className="community-result"
                    href={`/${encodeURIComponent(person.username)}`}
                  >
                    <span className="community-avatar">
                      {String(person.full_name || person.username)
                        .slice(0, 1)
                        .toUpperCase()}
                    </span>
                    <span className="community-result-copy">
                      <strong>
                        {person.full_name || `@${person.username}`}
                      </strong>
                      <small>
                        @{person.username}
                        {person.current_role
                          ? ` · ${person.current_role}`
                          : person.headline
                            ? ` · ${person.headline}`
                            : ""}
                      </small>
                      {person.location || person.career_level ? (
                        <span className="community-result-meta">
                          {person.career_level ? (
                            <Badge
                              tone="info"
                              className="community-level-badge"
                            >
                              <CopilotIcon name="filters" size={11} />
                              {person.career_level}
                            </Badge>
                          ) : null}
                          {person.location ? (
                            <span className="community-location">
                              <CopilotIcon name="pin" size={12} />
                              {person.location}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : busy ? (
            <div className="community-idle">
              <div className="community-idle-spinner" />
              <p>Searching profiles...</p>
            </div>
          ) : error ? null : (
            <div className="community-idle">
              <CopilotIcon name="compass" size={28} />
              <p>
                {searching
                  ? "No public profiles matched that search."
                  : "Search by a real username or career term to discover public profiles."}
              </p>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.main>
  );
}

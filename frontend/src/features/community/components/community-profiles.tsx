import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@/shared/ui/router-link";
import { resolveApiBase } from "@/shared/config";
import { isDemoSession, demoApiRequest } from "@/features/auth/demo-session";
import { isAbortError } from "@/shared/api/client";
import { PageHeader, Button, Chip } from "@/shared/ui/workbench";

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

  return (
    <div className="feature-page community-page">
      <PageHeader
        title="Search public *profiles*"
        description="Search by name, username, profession, career level, goal, or location. Resumes stay private."
      />

      <div className="wb-community-search-section">
        <label
          htmlFor="community-search-input"
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--ink-2)",
            marginBottom: 8,
          }}
        >
          Search profiles
        </label>
        <form
          className="wb-community-search-bar"
          role="search"
          onSubmit={onSubmit}
        >
          <input
            id="community-search-input"
            aria-label="Search community profiles"
            value={query}
            onChange={(event) => {
              setError("");
              setQuery(event.target.value);
            }}
            placeholder="Name, @username, AI engineer, fresher..."
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Searching..." : "Search"}
          </Button>
        </form>

        {/* Suggestion chips */}
        <div className="wb-community-chips" aria-label="Quick searches">
          <span className="wb-community-chips-label">Try:</span>
          {SUGGESTION_CHIPS.map((chip) => (
            <Chip
              key={chip}
              onClick={() => {
                setError("");
                setQuery(chip);
              }}
            >
              {chip}
            </Chip>
          ))}
        </div>

        {error ? (
          <p className="field-error" role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        ) : null}
      </div>

      {results.length ? (
        <div
          className="wb-community-results"
          aria-label="Community profile results"
          aria-busy={busy}
        >
          {results.map((person) => (
            <Link
              key={person.username}
              className="wb-community-row"
              href={`/${encodeURIComponent(person.username)}`}
            >
              <div className="wb-community-avatar">
                {String(person.full_name || person.username)
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div className="wb-community-info">
                <div className="wb-community-name-row">
                  <span className="wb-community-name">
                    {person.full_name || `@${person.username}`}
                  </span>
                  <span className="wb-community-handle">
                    @{person.username}
                  </span>
                </div>
                {person.current_role || person.headline ? (
                  <div className="wb-community-role">
                    {person.current_role || person.headline}
                  </div>
                ) : null}
                {person.location || person.career_level ? (
                  <div className="wb-community-tags">
                    {person.career_level ? (
                      <Chip asButton={false}>{person.career_level}</Chip>
                    ) : null}
                    {person.location ? (
                      <span className="wb-community-location">
                        {person.location}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : busy ? (
        <div className="wb-community-idle">
          <p>Searching profiles...</p>
        </div>
      ) : (
        <div className="wb-community-idle">
          <p>
            {searching
              ? "No public profiles matched that search."
              : "Matches appear as you type. Nothing is listed until you search."}
          </p>
        </div>
      )}
    </div>
  );
}

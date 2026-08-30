import { useState } from "react";
import { Search, Users } from "lucide-react";
import { PageHeader, Button, Card } from "@/shared/ui/primitives";
import { Link } from "@/shared/ui/router-link";
import { resolveApiBase } from "@/shared/config";
import { AnimatedIcon } from "@/components/ui/animated-icon";

type PublicProfileResult = { username: string; full_name?: string | null; headline?: string | null; current_role?: string | null; career_level?: string | null; location?: string | null };

export function CommunityProfiles() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfileResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return setError("Enter at least 2 characters.");
    setBusy(true); setError("");
    try {
      const response = await fetch(`${resolveApiBase()}/public/profiles/search?q=${encodeURIComponent(value)}`);
      if (!response.ok) throw new Error("Could not search public profiles.");
      setResults(await response.json() as PublicProfileResult[]);
    } catch (reason) { setResults([]); setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <main className="feature-page community-page">
    <PageHeader eyebrow="Community" title="Find people worth learning from" description="Search public profiles by name, username, profession, career level, goal, or location. Use real journeys as inspiration without exposing resumes." />
    <Card className="community-search-card">
      <div className="community-search-heading"><span className="community-search-mark"><AnimatedIcon icon={Users} size={18} aria-hidden /></span><div><h2>Explore the community</h2><p className="muted">Try “AI engineer”, “fresher”, or a username.</p></div></div>
      <form className="community-search-form" role="search" onSubmit={(event) => void search(event)}>
        <input aria-label="Search community profiles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, @username, AI engineer, fresher…" />
        <Button type="submit" disabled={busy}><AnimatedIcon icon={Search} size={16} aria-hidden /> {busy ? "Searching…" : "Search profiles"}</Button>
      </form>
      {error ? <p className="field-error" role="alert">{error}</p> : null}
      {results.length ? <div className="community-results" aria-label="Community profile results">{results.map((person) => <Link className="community-result" key={person.username} href={`/${encodeURIComponent(person.username)}`}><span className="community-avatar">{String(person.full_name || person.username).slice(0, 1).toUpperCase()}</span><span className="community-result-copy"><strong>{person.full_name || `@${person.username}`}</strong><small>@{person.username}{person.current_role ? ` · ${person.current_role}` : person.headline ? ` · ${person.headline}` : ""}</small>{person.location || person.career_level ? <small>{[person.career_level, person.location].filter(Boolean).join(" · ")}</small> : null}</span></Link>)}</div> : query.trim().length >= 2 && !busy && !error ? <p className="muted">No public profiles matched that search.</p> : <p className="community-empty">Search by a real username or career term to discover public profiles.</p>}
    </Card>
  </main>;
}

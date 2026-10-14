import { apiRequest } from "@/shared/lib/client";

export type PublicProfileResult = {
  username: string;
  full_name?: string | null;
  headline?: string | null;
  current_role?: string | null;
  career_level?: string | null;
  location?: string | null;
};

export function normalizeSearchQuery(raw: string): string {
  let value = raw.trim();
  if (value.startsWith("@")) value = value.slice(1).trim();
  return value.replace(/\s+/g, " ");
}

export function searchPath(query: string): string {
  const params = new URLSearchParams({
    q: normalizeSearchQuery(query),
    limit: "20",
  });
  return `/public/profiles/search?${params.toString()}`;
}

export async function fetchPublicProfiles(
  query: string,
  signal?: AbortSignal,
): Promise<PublicProfileResult[]> {
  const rows = await apiRequest<PublicProfileResult[]>(searchPath(query), { signal });
  return Array.isArray(rows) ? rows : [];
}

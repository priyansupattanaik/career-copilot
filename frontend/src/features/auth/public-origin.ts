import { vitePublicAppOrigin } from "@/shared/config";

/**
 * Canonical public origin for auth emails and OAuth continue URLs.
 * Loopback hosts must never be written into verification emails — those links
 * are opened on another device/network and 127.0.0.1 is unreachable there.
 */

export const CANONICAL_APP_ORIGIN = "https://careercopilotai.vercel.app";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
/** Retired deploy host. It must never be used for public profile or auth links. */
const RETIRED_PUBLIC_HOSTS = new Set(["career-copilot-neon.vercel.app"]);

export function isLoopbackOrigin(origin: string | null | undefined): boolean {
  const raw = String(origin || "").trim();
  if (!raw) return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return LOOPBACK_HOSTS.has(host);
  } catch {
    return false;
  }
}

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Drop loopback and the retired Neon host. An empty string means "keep looking". */
function usablePublicOrigin(origin: string | null | undefined): string {
  const trimmed = String(origin || "").trim().replace(/\/$/, "");
  if (!trimmed || isLoopbackOrigin(trimmed)) return "";
  if (RETIRED_PUBLIC_HOSTS.has(hostnameOf(trimmed))) return "";
  return trimmed;
}

/** Canonical public profile URL: https://careercopilotai.vercel.app/{username}. */
export function publicProfileUrl(username: string): string {
  const clean = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^\/+|\/+$/g, "");
  return `${CANONICAL_APP_ORIGIN}/${encodeURIComponent(clean)}`;
}

export function publicAppOrigin(options?: {
  envOrigin?: string | null;
  currentOrigin?: string | null;
}): string {
  const envOrigin = usablePublicOrigin(options?.envOrigin ?? vitePublicAppOrigin());
  if (envOrigin) return envOrigin;

  const current = usablePublicOrigin(
    options?.currentOrigin ??
      (typeof window !== "undefined" ? window.location.origin : ""),
  );
  if (current) return current;

  return CANONICAL_APP_ORIGIN;
}

export function authCallbackUrl(
  next = "/sign-in",
  options?: { envOrigin?: string | null; currentOrigin?: string | null },
): string {
  const dest = next.startsWith("/") ? next : `/${next}`;
  return `${publicAppOrigin(options)}/auth/callback?next=${encodeURIComponent(dest)}`;
}

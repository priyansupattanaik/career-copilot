import {
  isProductionBuild,
  VITE_API_BASE_URL,
  VITE_API_V1_PREFIX,
  VITE_PUBLIC_APP_ORIGIN,
  VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_URL,
} from "./config/env";

export { isProductionBuild };
export * from "./config/env";

export const BROWSER_API_PROXY_PREFIX = "/api/backend";

export const API_V1_PREFIX = VITE_API_V1_PREFIX;

export const ACCESS_TOKEN_STORAGE_KEY = "career_copilot_access_token";

export const DEMO_COOKIE_NAME = "career_copilot_demo";
export const DEMO_COOKIE_VALUE = "1";
export const DEMO_COOKIE_PAIR = `${DEMO_COOKIE_NAME}=${DEMO_COOKIE_VALUE}`;

/** Browser Supabase project URL. Empty when the build was not given VITE_SUPABASE_URL. */
export const supabaseUrl = VITE_SUPABASE_URL;

/** Browser Supabase publishable key. Empty when the build was not given one. */
export const supabasePublishableKey = VITE_SUPABASE_PUBLISHABLE_KEY;

/** Public site origin from VITE_PUBLIC_APP_ORIGIN, without a trailing slash. */
export function vitePublicAppOrigin(): string {
  return VITE_PUBLIC_APP_ORIGIN;
}

/**
 * Browser API base for fetch().
 * - Prefer VITE_API_BASE_URL (absolute origin) for static production hosting without a proxy.
 * - Fall back to same-origin /api/backend for Vite dev + vite preview proxy.
 * Production static hosts (nginx, CDN) must either set VITE_API_BASE_URL at build time
 * or reverse-proxy /api/backend and /api/files to the FastAPI service.
 */
export function resolveApiBase(): string {
  if (VITE_API_BASE_URL) return `${VITE_API_BASE_URL}${API_V1_PREFIX}`;
  return BROWSER_API_PROXY_PREFIX;
}

export function resolveUpstreamApiOrigin(): string {
  if (!VITE_API_BASE_URL) throw new Error("API base URL is not configured.");
  return VITE_API_BASE_URL;
}

export function isDemoCookiePresent(cookieSource?: string): boolean {
  // Production builds never treat demo cookie as active (fail closed).
  if (isProductionBuild) return false;
  if (typeof document === "undefined" && cookieSource === undefined) return false;
  const raw = cookieSource ?? document.cookie;
  return raw.split("; ").includes(DEMO_COOKIE_PAIR);
}

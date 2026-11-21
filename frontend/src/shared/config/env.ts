/**
 * Single source of truth for browser environment configuration.
 * This is the ONLY module in frontend/src that reads import.meta.env directly.
 */

// Safety check: ensure service role or backend secret keys never leak to frontend
// In Vitest (Node runtime), process.env is attached to import.meta.env; safety check runs in browser/builds.
if (import.meta.env.MODE !== "test") {
  for (const key of Object.keys(import.meta.env)) {
    if (
      key.toLowerCase().includes("service_role") ||
      key.toLowerCase().includes("secret_key") ||
      key.toLowerCase().includes("auth_secret")
    ) {
      throw new Error(
        `[Security Violation] Secret key detected in client environment: ${key}. Private keys must never be exposed to the browser.`,
      );
    }
  }
}

function readEnv(key: string, defaultValue = ""): string {
  const value = import.meta.env[key];
  if (typeof value === "string") {
    return value.trim();
  }
  return defaultValue;
}

export const isProductionBuild: boolean = Boolean(import.meta.env.PROD);
export const isDevBuild: boolean = Boolean(import.meta.env.DEV);
export const appMode: string = String(import.meta.env.MODE || (isProductionBuild ? "production" : "development"));

export const VITE_API_V1_PREFIX: string = readEnv("VITE_API_V1_PREFIX", "/api/v1");

// Support both publishable key and anon key naming for Supabase
export const VITE_SUPABASE_URL: string = readEnv("VITE_SUPABASE_URL");
export const VITE_SUPABASE_PUBLISHABLE_KEY: string =
  readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") || readEnv("VITE_SUPABASE_ANON_KEY");

export const VITE_PUBLIC_APP_ORIGIN: string = readEnv(
  "VITE_PUBLIC_APP_ORIGIN",
  "https://careercopilotai.vercel.app",
).replace(/\/$/, "");

export const VITE_API_BASE_URL: string = readEnv("VITE_API_BASE_URL").replace(/\/$/, "");

/**
 * Validate required client environment variables.
 * In production builds, missing essential variables throws a clear developer-friendly error.
 */
export function validateClientEnv(): void {
  // In demo or test mode, allow running with empty Supabase keys
  if (!isProductionBuild) return;

  const missing: string[] = [];
  if (!VITE_SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!VITE_SUPABASE_PUBLISHABLE_KEY) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY)");

  if (missing.length > 0) {
    console.error(
      `[Environment Config Error] Missing required browser environment variables:\n` +
        missing.map((v) => `  - ${v}`).join("\n") +
        `\nPlease configure these in your deployment dashboard (e.g. Vercel) or .env file.`,
    );
  }
}

// Run initial validation
validateClientEnv();

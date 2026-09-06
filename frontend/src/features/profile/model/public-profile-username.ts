/** Must stay aligned with backend `app.features.auth.username`. */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_]{1,28}[a-z0-9])?$/;

const RESERVED_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "careers",
  "community",
  "dashboard",
  "demo",
  "docs",
  "files",
  "health",
  "help",
  "home",
  "jobs",
  "learning",
  "login",
  "logout",
  "me",
  "onboarding",
  "privacy",
  "profile",
  "profiles",
  "public",
  "register",
  "root",
  "search",
  "settings",
  "signin",
  "signout",
  "signup",
  "static",
  "status",
  "support",
  "teams",
  "terms",
  "username",
  "users",
  "www",
]);

export function normalizePublicProfileUsername(value: string | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/\s+/g, "_");
}

/** True when /:username should load a public profile instead of the app 404 page. */
export function isPublicProfileUsername(value: string | undefined): boolean {
  const username = normalizePublicProfileUsername(value);
  return USERNAME_PATTERN.test(username) && !RESERVED_USERNAMES.has(username);
}

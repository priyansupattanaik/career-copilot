/**
 * Sign-in → workspace cinematic handoff.
 * Arms once on successful auth, then the overlay consumes the arm so a
 * refresh of /dashboard does not replay it.
 */
export const SIGN_IN_LIGHT_BEND_EVENT = "career-copilot:signin-light-bend";
export const SIGN_IN_LIGHT_BEND_STORAGE_KEY = "career_copilot_signin_light_bend";
export const SIGN_IN_LIGHT_BEND_DURATION_MS = 1400;
export const SIGN_IN_LIGHT_BEND_STALE_MS = SIGN_IN_LIGHT_BEND_DURATION_MS + 4000;

export type SignInLightBendPayload = {
  nextPath: string;
  armedAt: number;
};

export function readReducedMotionPreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function shouldPlaySignInLightBend(options: {
  prefersReducedMotion: boolean;
  nextPath: string;
}): boolean {
  if (options.prefersReducedMotion) return false;
  const nextPath = options.nextPath.trim();
  return nextPath.startsWith("/") && !nextPath.startsWith("//");
}

function writeArm(payload: SignInLightBendPayload): void {
  window.sessionStorage.setItem(
    SIGN_IN_LIGHT_BEND_STORAGE_KEY,
    JSON.stringify(payload),
  );
}

export function armSignInLightBend(nextPath: string): boolean {
  if (typeof window === "undefined") return false;
  if (
    !shouldPlaySignInLightBend({
      prefersReducedMotion: readReducedMotionPreference(),
      nextPath,
    })
  ) {
    return false;
  }
  const payload: SignInLightBendPayload = {
    nextPath,
    armedAt: Date.now(),
  };
  try {
    writeArm(payload);
  } catch {
    // Overlay can still play from the in-memory event.
  }
  window.dispatchEvent(
    new CustomEvent(SIGN_IN_LIGHT_BEND_EVENT, { detail: payload }),
  );
  return true;
}

function parseArm(raw: string | null): { nextPath: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SignInLightBendPayload>;
    if (typeof parsed.nextPath !== "string" || typeof parsed.armedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.armedAt > SIGN_IN_LIGHT_BEND_STALE_MS) {
      return null;
    }
    if (
      !shouldPlaySignInLightBend({
        prefersReducedMotion: false,
        nextPath: parsed.nextPath,
      })
    ) {
      return null;
    }
    return { nextPath: parsed.nextPath };
  } catch {
    return null;
  }
}

export function peekSignInLightBend(): { nextPath: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SIGN_IN_LIGHT_BEND_STORAGE_KEY);
    const parsed = parseArm(raw);
    if (raw && !parsed) {
      window.sessionStorage.removeItem(SIGN_IN_LIGHT_BEND_STORAGE_KEY);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeSignInLightBend(): { nextPath: string } | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(SIGN_IN_LIGHT_BEND_STORAGE_KEY);
    window.sessionStorage.removeItem(SIGN_IN_LIGHT_BEND_STORAGE_KEY);
  } catch {
    return null;
  }
  return parseArm(raw);
}

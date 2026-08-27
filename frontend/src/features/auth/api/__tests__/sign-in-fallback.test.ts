import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../client";
import { AUTH_PROVIDER_TIMEOUT_MS } from "../timeout";

const { supabaseAuthClientMock, signInWithEmailPasswordMock, SupabaseWebConfigError } = vi.hoisted(() => {
  class SupabaseWebConfigError extends Error {
    code = "supabase/web-config-missing";
    constructor(public missing: string[]) {
      super(`missing ${missing.join(", ")}`);
    }
  }
  return {
    supabaseAuthClientMock: vi.fn(),
    signInWithEmailPasswordMock: vi.fn(),
    SupabaseWebConfigError,
  };
});

vi.mock("@/features/auth/supabase", () => ({
  supabaseAuthClient: supabaseAuthClientMock,
  SupabaseWebConfigError,
  getSupabaseWebConfigStatus: () => ({ configured: true, missing: [] }),
}));

vi.mock("@/features/auth/firebase", () => ({
  signInWithEmailPassword: signInWithEmailPasswordMock,
  signInWithGoogle: vi.fn(),
  signOutFromFirebase: vi.fn(),
  completeGoogleRedirectSignIn: vi.fn(),
  emailPasswordAuthErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "firebase"),
  googleAuthErrorMessage: () => "google",
}));

const TOKEN_KEY = "career_copilot_access_token";

beforeEach(() => {
  window.localStorage.clear();
  supabaseAuthClientMock.mockReset();
  signInWithEmailPasswordMock.mockReset();
});

describe("signInWithPassword fallbacks", () => {
  it("falls through to the app password when Firebase hangs after Supabase rejects", async () => {
    supabaseAuthClientMock.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          data: { session: null, user: null },
          error: { message: "Invalid login credentials" },
        })),
      },
    });
    signInWithEmailPasswordMock.mockImplementation(() => new Promise(() => undefined));
    const fetchMock = vi.fn(async (url: string) => {
      expect(String(url)).toContain("/auth/sign-in");
      return new Response(
        JSON.stringify({ access_token: "app-jwt", user: { id: "u1", email: "a@test.dev" } }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const started = Date.now();
    const result = await createClient().auth.signInWithPassword({
      email: "a@test.dev",
      password: "Passw0rd!",
    });
    const elapsed = Date.now() - started;

    expect(result.error).toBeNull();
    expect(result.data.session?.access_token).toBe("app-jwt");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("app-jwt");
    expect(fetchMock).toHaveBeenCalled();
    expect(elapsed).toBeGreaterThanOrEqual(AUTH_PROVIDER_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(AUTH_PROVIDER_TIMEOUT_MS + 1500);
  }, 10000);
});

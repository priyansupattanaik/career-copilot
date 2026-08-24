import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../client";

const { supabaseAuthClientMock, SupabaseWebConfigError } = vi.hoisted(() => {
  class SupabaseWebConfigError extends Error {
    code = "supabase/web-config-missing";
    constructor(public missing: string[]) {
      super(`missing ${missing.join(", ")}`);
    }
  }
  return { supabaseAuthClientMock: vi.fn(), SupabaseWebConfigError };
});

vi.mock("@/features/auth/supabase", () => ({
  supabaseAuthClient: supabaseAuthClientMock,
  SupabaseWebConfigError,
  getSupabaseWebConfigStatus: () => ({ configured: true, missing: [] }),
}));

const TOKEN_KEY = "career_copilot_access_token";

function supabaseWith(signUpResult: Record<string, unknown>) {
  return {
    auth: {
      signUp: vi.fn(async () => signUpResult),
      signInWithPassword: vi.fn(),
      resend: vi.fn(),
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  supabaseAuthClientMock.mockReset();
});

describe("auth facade signUp", () => {
  it("logs the user in immediately when Supabase returns a session (confirmations off)", async () => {
    supabaseAuthClientMock.mockReturnValue(
      supabaseWith({
        data: { session: { access_token: "sb-token" }, user: { id: "u1" } },
        error: null,
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        expect(String(_url)).toContain("/auth/supabase");
        expect(JSON.parse(String(init?.body)).access_token).toBe("sb-token");
        return new Response(
          JSON.stringify({ access_token: "app-jwt", user: { id: "u1" } }),
          { status: 200 },
        );
      }),
    );

    const result = await createClient().auth.signUp({ email: "a@test.dev", password: "Passw0rd!" });

    expect(result.error).toBeNull();
    expect(result.emailConfirmationSent).toBe(false);
    expect(result.data.session?.access_token).toBe("app-jwt");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("app-jwt");
  });

  it("reports confirmation pending without a session (Supabase emails the link)", async () => {
    const fake = supabaseWith({ data: { session: null, user: { id: "u2" } }, error: null });
    supabaseAuthClientMock.mockReturnValue(fake);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().auth.signUp({ email: "b@test.dev", password: "Passw0rd!" });

    expect(result.error).toBeNull();
    expect(result.emailConfirmationSent).toBe(true);
    expect(result.data.session).toBeNull();
    expect(fake.auth.signUp).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to the legacy backend signup when Supabase is not configured", async () => {
    supabaseAuthClientMock.mockImplementation(() => {
      throw new SupabaseWebConfigError(["VITE_SUPABASE_URL"]);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(String(url)).toContain("/auth/sign-up");
        return new Response(
          JSON.stringify({ access_token: "legacy-jwt", user: { id: "u3" } }),
          { status: 201 },
        );
      }),
    );

    const result = await createClient().auth.signUp({
      email: "c@test.dev",
      password: "Passw0rd!",
      options: { data: { full_name: "C" } },
    });

    expect(result.error).toBeNull();
    expect(result.emailConfirmationSent).toBe(false);
    expect(result.data.session?.access_token).toBe("legacy-jwt");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("legacy-jwt");
  });

  it("surfaces Supabase signup errors without a legacy fallback", async () => {
    supabaseAuthClientMock.mockReturnValue(
      supabaseWith({
        data: { session: null, user: null },
        error: { message: "User already registered", status: 422 },
        status: 422,
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await createClient().auth.signUp({ email: "d@test.dev", password: "Passw0rd!" });

    expect(result.error?.message).toBe("User already registered");
    expect(result.error?.status).toBe(422);
    expect(result.emailConfirmationSent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

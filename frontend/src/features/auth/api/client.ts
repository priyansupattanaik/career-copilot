import {
  ACCESS_TOKEN_STORAGE_KEY,
  resolveApiBase,
  isDemoCookiePresent,
} from "@/shared/config";
import { supabaseAuthClient, SupabaseWebConfigError } from "@/features/auth/supabase";
import { authCallbackUrl } from "@/features/auth/public-origin";
import { APP_AUTH_TIMEOUT_MS, isTimeoutError, withTimeout } from "@/features/auth/api/timeout";

type AuthError = { message: string; status?: number } | null;
type AuthUser = {
  id: string;
  email: string;
  auth_provider?: "email" | "google" | "unknown";
  user_metadata?: { full_name?: string };
};

function token() {
  return typeof window === "undefined" ? "" : window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

function saveToken(value: string) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
  // Real sign-in must never stay trapped in demo mode (empty in-memory API).
  document.cookie = `career_copilot_demo=; Max-Age=0; Path=/; SameSite=Lax`;
}

function clearAccountClientState() {
  if (typeof window === "undefined") return;
  const keep = new Set(["career-copilot-theme", "career-copilot-motion-paused"]);
  for (const store of [window.localStorage, window.sessionStorage]) {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (!key || keep.has(key)) continue;
      if (key.startsWith("career_copilot") || key.startsWith("career-copilot")) {
        keys.push(key);
      }
    }
    keys.forEach((key) => store.removeItem(key));
  }
  document.cookie = `career_copilot_session=; Max-Age=0; Path=/; SameSite=Lax`;
}

async function request(path: string, body?: unknown) {
  const accessToken = token();
  const endpoint = `${resolveApiBase()}${path}`;
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    throw new Error(
      `Authentication server is unavailable at ${endpoint}. If this is the deployed site, set Render FRONTEND_ORIGINS to ${origin || "your Vercel origin"} and redeploy the API.`,
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.detail || `Authentication request failed (${response.status}).`;
    const code = payload?.error?.code ? ` [${payload.error.code}]` : "";
    const error = new Error(`${message}${code}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  if (
    path !== "/auth/resend" &&
    path !== "/auth/reset-password" &&
    path !== "/auth/sign-out" &&
    path !== "/auth/sign-up" &&
    path !== "/auth/confirm-email" &&
    path !== "/auth/session" &&
    !payload?.access_token
  ) {
    throw new Error("Authentication server returned an incomplete session. Please try again.");
  }
  return payload;
}

export function createClient() {
  async function signInWithSupabaseAccessToken(accessToken: string) {
    try {
      const payload = await request("/auth/supabase", { access_token: accessToken });
      saveToken(payload.access_token);
      return {
        data: { session: { access_token: payload.access_token }, user: payload.user },
        error: null as AuthError,
        emailConfirmed: false,
      };
    } catch (error) {
      return {
        data: { session: null, user: null },
        error: { message: (error as Error).message, status: (error as { status?: number }).status },
        emailConfirmed: false,
      };
    }
  }

  return {
    auth: {
      async signInWithPassword({ identifier, email, password }: { identifier?: string; email?: string; password: string }) {
        const trimmed = (identifier ?? email ?? "").trim();
        const isEmail = trimmed.includes("@");
        let lastMessage = "The email or password is incorrect.";

        // The application endpoint is the canonical identifier login path.
        try {
          const payload = await withTimeout(
            request("/auth/sign-in", { identifier: trimmed, password }),
            "App sign-in",
            APP_AUTH_TIMEOUT_MS,
          );
          saveToken(payload.access_token);
          return {
            data: { session: { access_token: payload.access_token }, user: payload.user },
            error: null as AuthError,
          };
        } catch (error) {
          if (!isTimeoutError(error) && error instanceof Error && error.message) lastMessage = error.message;
          const status = (error as Error & { status?: number }).status;
          if (status === 403 || lastMessage.toLowerCase().includes("not verified")) {
            return {
              data: { session: null, user: null },
              error: { message: lastMessage, status },
            };
          }
        }

        if (isEmail) {
          try {
            const result = await withTimeout(
              supabaseAuthClient().auth.signInWithPassword({ email: trimmed, password }),
              "Supabase sign-in",
              APP_AUTH_TIMEOUT_MS,
            );
            if (!result.error && result.data.session?.access_token) {
              return await withTimeout(
                signInWithSupabaseAccessToken(result.data.session.access_token),
                "Supabase session exchange",
                APP_AUTH_TIMEOUT_MS,
              );
            }
            if (result.error?.message) lastMessage = result.error.message;
          } catch (error) {
            if (!(error instanceof SupabaseWebConfigError) && !isTimeoutError(error)) {
              lastMessage = (error as Error).message || lastMessage;
            }
          }
        }

        try {
          const payload = await withTimeout(
            request("/auth/sign-in", { identifier: trimmed, password }),
            "App sign-in",
            APP_AUTH_TIMEOUT_MS,
          );
          saveToken(payload.access_token);
          return {
            data: { session: { access_token: payload.access_token }, user: payload.user },
            error: null as AuthError,
          };
        } catch (error) {
          if (isTimeoutError(error)) {
            return {
              data: { session: null, user: null },
              error: { message: "Authentication server is taking too long. Please check your connection and try again." },
            };
          }
          return {
            data: { session: null, user: null },
            error: { message: error instanceof Error && error.message ? error.message : lastMessage },
          };
        }
      },
      async signUp({
        email,
        password,
        options,
      }: {
        email: string;
        password: string;
        options?: { data?: Record<string, unknown>; emailRedirectTo?: string; phone?: string };
      }) {
        const trimmed = email.trim();
        const phone = String(options?.phone || "").trim();
        const appBody = {
          email: trimmed,
          password,
          full_name: String(options?.data?.full_name || ""),
          ...(options?.data?.username ? { username: String(options.data.username) } : {}),
          ...(phone ? { phone } : {}),
        };

        const confirmationRedirect = options?.emailRedirectTo || authCallbackUrl("/sign-in");
        const inboxResult = {
          data: { session: null, user: null },
          error: null as AuthError,
          emailConfirmationSent: true,
        };

        try {
          const result = await withTimeout(
            supabaseAuthClient().auth.signUp({
              email: trimmed,
              password,
              options: {
                data: {
                  full_name: String(options?.data?.full_name || ""),
                  ...(options?.data?.username ? { username: String(options.data.username) } : {}),
                  ...(phone ? { phone } : {}),
                },
                emailRedirectTo: confirmationRedirect,
              },
            }),
            "Supabase sign-up",
            APP_AUTH_TIMEOUT_MS,
          );
          if (result.error) {
            const message = result.error.message || "Sign-up failed.";
            const already = /already registered|already exists|already been registered/i.test(message);
            if (!already) {
              return {
                data: { session: null, user: null },
                error: { message, status: result.error.status },
                emailConfirmationSent: false,
              };
            }
          }
          const supabaseUser = result.data.user;
          const identities = (supabaseUser as { identities?: unknown[] } | null)?.identities;
          if (Array.isArray(identities) && identities.length === 0) {
            return {
              data: { session: null, user: null },
              error: {
                message: "An account with this email already exists. Sign in instead.",
                status: 409,
              },
              emailConfirmationSent: false,
            };
          }
          try {
            await withTimeout(
              request("/auth/sign-up", {
                ...appBody,
                ...(supabaseUser?.id ? { supabase_uid: supabaseUser.id } : {}),
              }),
              "App sign-up",
              APP_AUTH_TIMEOUT_MS,
            );
          } catch (error) {
            const status = (error as Error & { status?: number }).status;
            const message = error instanceof Error ? error.message : "Sign-up failed.";
            if (message.includes("[username_taken]") || /username is already taken/i.test(message)) {
              return {
                data: { session: null, user: null },
                error: { message: "That username is already taken.", status: 409 },
                emailConfirmationSent: false,
              };
            }
            if (status !== 409) {
              return {
                data: { session: null, user: null },
                error: { message, status },
                emailConfirmationSent: false,
              };
            }
          }
          if (result.data.session?.access_token) {
            try {
              await supabaseAuthClient().auth.signOut();
            } catch {
              // Confirmation is still required before sign-in.
            }
          }
          return inboxResult;
        } catch (error) {
          return {
            data: { session: null, user: null },
            error: {
              message: error instanceof Error ? error.message : "Sign-up failed.",
              status: (error as Error & { status?: number }).status,
            },
            emailConfirmationSent: false,
          };
        }
      },
      async resend({
        email,
        options,
      }: {
        type: string;
        email: string;
        options?: { emailRedirectTo?: string };
      }) {
        try {
          const result = await supabaseAuthClient().auth.resend({
            type: "signup",
            email,
            options: options?.emailRedirectTo ? { emailRedirectTo: options.emailRedirectTo } : undefined,
          });
          return result.error ? { error: { message: result.error.message } } : { error: null as AuthError };
        } catch (error) {
          return { error: { message: error instanceof SupabaseWebConfigError ? error.message : (error as Error).message } };
        }
      },
      async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
        if (provider !== "google") {
          return { error: { message: "Only Google sign-in is configured for authentication." } };
        }
        try {
          const redirectTo = options?.redirectTo
            ? new URL(options.redirectTo, window.location.origin).toString()
            : authCallbackUrl("/onboarding");
          const { error } = await supabaseAuthClient().auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
            },
          });
          if (error) throw error;
          return { data: { session: null, user: null }, error: null as AuthError };
        } catch (error) {
          return { data: { session: null, user: null }, error: { message: (error as Error).message } };
        }
      },
      async getSession() {
        const value = token();
        return {
          data: { session: value ? { access_token: value } : null },
          error: null as AuthError,
        };
      },
      async getUser() {
        if (isDemoCookiePresent()) {
          return {
            data: { user: { id: "demo-user", email: "demo@example.com", user_metadata: { full_name: "Demo Candidate" } } as AuthUser },
            error: null as AuthError,
          };
        }
        try {
          const payload = await request("/auth/session");
          return { data: { user: payload.user as AuthUser }, error: null as AuthError };
        } catch (error) {
          const status = (error as { status?: number }).status;
          return { data: { user: null }, error: { message: (error as Error).message, status } };
        }
      },
      async updateUser({
        password,
        current_password,
      }: {
        password: string;
        current_password?: string;
      }) {
        return request("/auth/update-password", {
          password,
          ...(current_password ? { current_password } : {}),
        })
          .then((payload) => {
            if (payload?.access_token) saveToken(String(payload.access_token));
            return { error: null as AuthError };
          })
          .catch((error) => ({ error: { message: (error as Error).message } }));
      },
      async resetPasswordForEmail(email: string, options?: unknown) {
        void options;
        return request("/auth/reset-password", { email })
          .then(() => ({ error: null as AuthError }))
          .catch((error) => ({ error: { message: (error as Error).message } }));
      },
      async completeAuthRedirect() {
        try {
          const client = supabaseAuthClient();
          const url = new URL(window.location.href);
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const type = (hashParams.get("type") || url.searchParams.get("type") || "").toLowerCase();
          const next = url.searchParams.get("next") || "";
          const code = url.searchParams.get("code");
          let { data } = await client.auth.getSession();
          if (!data.session?.access_token && code) {
            const exchanged = await client.auth.exchangeCodeForSession(code);
            if (!exchanged.error) {
              data = (await client.auth.getSession()).data;
            }
          }
          if (!data.session?.access_token) {
            const accessToken = hashParams.get("access_token") || "";
            const refreshToken = hashParams.get("refresh_token") || "";
            if (accessToken && refreshToken) {
              const applied = await client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (!applied.error) {
                data = (await client.auth.getSession()).data;
              }
            }
          }
          const emailConfirm =
            type === "signup" ||
            type === "email" ||
            type === "email_change" ||
            next === "/sign-in";
          if (emailConfirm) {
            const accessToken = data.session?.access_token;
            if (accessToken) {
              await request("/auth/confirm-email", { access_token: accessToken }).catch(() => undefined);
            }
            await client.auth.signOut().catch(() => undefined);
            window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
            return {
              data: { session: null, user: null },
              error: null as AuthError,
              emailConfirmed: Boolean(accessToken || type === "signup" || type === "email"),
            };
          }
          if (data.session?.access_token) return signInWithSupabaseAccessToken(data.session.access_token);
        } catch (error) {
          return {
            data: { session: null, user: null },
            error: { message: (error as Error).message },
            emailConfirmed: false,
          };
        }
        return { data: { session: null, user: null }, error: null as AuthError, emailConfirmed: false };
      },
      async signOut() {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        clearAccountClientState();
        try {
          await supabaseAuthClient().auth.signOut();
        } catch {
          // Supabase sign-out is best-effort if offline
        }
        if (isDemoCookiePresent()) return { error: null as AuthError };
        await request("/auth/sign-out").catch(() => undefined);
        return { error: null as AuthError };
      },
    },
  };
}

export function isDefinitiveSessionRejection(error: { status?: number } | null | undefined): boolean {
  return error?.status === 401 || error?.status === 403;
}

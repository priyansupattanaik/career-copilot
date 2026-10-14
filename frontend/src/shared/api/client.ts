import { createClient as createAuthClient } from "@/features/auth/api/client";
import { demoApiRequest, isDemoSession } from "@/features/auth/demo-session";
import { apiRequestErrorFromBody, ApiRequestError, type ApiErrorBody } from "@/shared/api/errors";
import { ACCESS_TOKEN_STORAGE_KEY, resolveApiBase } from "@/shared/config";

export { ApiRequestError, type ApiErrorBody };
const inFlightGets = new Map<string, Promise<unknown>>();

/** True when fetch was cancelled via AbortController (not a connectivity failure). */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  if (name === "AbortError") return true;
  // Some runtimes surface aborted fetches as DOMException without a stable subclass.
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return false;
}

function networkUnreachableMessage(base: string): string {
  const hint = base.startsWith("http") ? ` base=${base.slice(0, 80)}` : ` proxy=${base}`;
  return `Could not reach the API.${hint}. Start the backend (npm run dev) and confirm the Vite proxy (/api/backend → backend) or VITE_API_BASE_URL.`;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (isDemoSession()) return demoApiRequest<T>(path, init);
  // The backend accepts the application token returned by the auth exchange.
  // Prefer it over the provider session token so Supabase refresh
  // state cannot make an otherwise valid app session look unauthorized.
  let accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
  if (!accessToken) {
    const authClient = createAuthClient();
    const {
      data: { session },
    } = await authClient.auth.getSession();
    accessToken = session?.access_token || "";
  }
  if (!accessToken) {
    throw new ApiRequestError("Your session has expired. Sign in again.", {
      status: 401,
      code: "session_expired",
    });
  }
  const method = (init.method || "GET").toUpperCase();
  const hasAbortSignal = Boolean(init.signal);
  // Never share in-flight GETs that carry AbortSignal: React Strict Mode (and
  // route unmount) aborts the first caller's signal, and a second caller that
  // reuses that promise would get AbortError rewritten as "API unreachable".
  const requestKey = `${method}:${path}:${accessToken}`;
  if (method === "GET" && !hasAbortSignal) {
    const existing = inFlightGets.get(requestKey);
    if (existing) return existing as Promise<T>;
  }
  const base = resolveApiBase();
  const request = (async () => {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(init.body != null && !(init.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...init.headers,
        },
      });
    } catch (error) {
      if (isAbortError(error) || init.signal?.aborted) {
        // Preserve abort semantics so callers can ignore cancelled work.
        throw error instanceof Error ? error : new DOMException("Aborted", "AbortError");
      }
      throw new ApiRequestError(networkUnreachableMessage(base), {
        status: 0,
        code: "network_unreachable",
        cause: error,
      });
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      if (response.status === 401) {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("career-copilot:auth-expired"));
      }
      throw apiRequestErrorFromBody(response.status, body);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  })();
  if (method === "GET" && !hasAbortSignal) {
    inFlightGets.set(requestKey, request);
    request.finally(() => inFlightGets.delete(requestKey)).catch(() => undefined);
  }
  return request;
}

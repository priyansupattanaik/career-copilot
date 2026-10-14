import { createClient as createAuthClient } from "@/features/auth/api/client";
import { demoApiRequest, isDemoSession } from "@/features/auth/demo-session";
import { ACCESS_TOKEN_STORAGE_KEY, resolveApiBase } from "@/shared/config";
import {
  COLD_START_NOTICE_DELAY_MS,
  INITIAL_REQUEST_TIMEOUT_MS,
  MAX_IDEMPOTENT_RETRIES,
  RETRY_BASE_DELAY_MS,
  SUBSEQUENT_REQUEST_TIMEOUT_MS,
} from "@/shared/config/constants";
import {
  ApiError,
  ApiErrorBody,
  ApiRequestError,
  apiRequestErrorFromBody,
  createNetworkError,
  createTimeoutError,
} from "./errors";

export { ApiError, ApiRequestError, type ApiErrorBody };

const inFlightGets = new Map<string, Promise<unknown>>();
let hasMadeInitialRequest = false;

/** True when fetch was cancelled via AbortController (not a connectivity failure). */
export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name;
  if (name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
    return true;
  }
  return false;
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipRetry?: boolean;
  onColdStartPending?: () => void;
}

/**
 * Perform an HTTP request to the API with authentication, timeout,
 * and user-safe error normalization.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (isDemoSession()) return demoApiRequest<T>(path, options);

  // Retrieve access token
  let accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
  if (!accessToken) {
    try {
      const authClient = createAuthClient();
      const {
        data: { session },
      } = await authClient.auth.getSession();
      accessToken = session?.access_token || "";
    } catch {
      // Ignore auth client failure, handled below
    }
  }

  if (!accessToken) {
    throw new ApiError("Your session has expired. Please sign in again.", {
      status: 401,
      code: "session_expired",
    });
  }

  const method = (options.method || "GET").toUpperCase();
  const hasExternalAbortSignal = Boolean(options.signal);
  const requestKey = `${method}:${path}:${accessToken}`;

  // De-duplicate non-aborted in-flight GET requests
  if (method === "GET" && !hasExternalAbortSignal) {
    const existing = inFlightGets.get(requestKey);
    if (existing) return existing as Promise<T>;
  }

  const timeoutDuration =
    options.timeoutMs || (hasMadeInitialRequest ? SUBSEQUENT_REQUEST_TIMEOUT_MS : INITIAL_REQUEST_TIMEOUT_MS);
  hasMadeInitialRequest = true;

  const performFetch = async (retryCount = 0): Promise<T> => {
    const internalAbortController = new AbortController();
    let coldStartTimer: ReturnType<typeof setTimeout> | null = null;
    let requestTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    // Link caller's abort signal if present
    const onCallerAbort = () => internalAbortController.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    // Cold-start notification timer
    if (options.onColdStartPending) {
      coldStartTimer = setTimeout(options.onColdStartPending, COLD_START_NOTICE_DELAY_MS);
    }

    // Overall request timeout timer
    let didTimeout = false;
    requestTimeoutTimer = setTimeout(() => {
      didTimeout = true;
      internalAbortController.abort();
    }, timeoutDuration);

    const base = resolveApiBase();
    let response: Response;

    try {
      response = await fetch(`${base}${path}`, {
        ...options,
        signal: internalAbortController.signal,
        credentials: "include",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(options.body != null && !(options.body instanceof FormData)
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
      });
    } catch (error) {
      if (didTimeout) {
        throw createTimeoutError(timeoutDuration);
      }
      if (options.signal?.aborted || (isAbortError(error) && !didTimeout)) {
        throw error instanceof Error ? error : new DOMException("Aborted", "AbortError");
      }

      // Retry idempotent GET requests on network failures
      if (method === "GET" && !options.skipRetry && retryCount < MAX_IDEMPOTENT_RETRIES) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        await new Promise((res) => setTimeout(res, backoff));
        return performFetch(retryCount + 1);
      }

      const technicalHint = `base=${base} path=${path}`;
      throw createNetworkError(error, technicalHint);
    } finally {
      if (coldStartTimer) clearTimeout(coldStartTimer);
      if (requestTimeoutTimer) clearTimeout(requestTimeoutTimer);
      if (options.signal) {
        options.signal.removeEventListener("abort", onCallerAbort);
      }
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
      if (response.status === 401) {
        window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent("career-copilot:auth-expired"));
      }

      // Retry idempotent GET requests on 502/503/504 gateway cold-starts
      if (
        method === "GET" &&
        !options.skipRetry &&
        retryCount < MAX_IDEMPOTENT_RETRIES &&
        (response.status === 502 || response.status === 503 || response.status === 504)
      ) {
        const backoff = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        await new Promise((res) => setTimeout(res, backoff));
        return performFetch(retryCount + 1);
      }

      throw apiRequestErrorFromBody(response.status, body);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  };

  const execute = performFetch();
  if (method === "GET" && !hasExternalAbortSignal) {
    inFlightGets.set(requestKey, execute);
    execute.finally(() => inFlightGets.delete(requestKey)).catch(() => undefined);
  }

  return execute;
}

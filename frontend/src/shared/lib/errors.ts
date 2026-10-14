import { isDevBuild } from "@/shared/config/env";

export type ApiErrorBody = {
  error?: { code?: string; message?: string; request_id?: string; details?: unknown };
  message?: string;
  detail?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly userMessage: string;
  readonly technicalDetails?: string;
  readonly isNetworkError: boolean;
  readonly isTimeout: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      requestId?: string;
      technicalDetails?: string;
      isNetworkError?: boolean;
      isTimeout?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.userMessage = message;
    this.technicalDetails = options.technicalDetails;
    this.isNetworkError = Boolean(options.isNetworkError);
    this.isTimeout = Boolean(options.isTimeout);
  }
}

// Backward-compatible alias
export const ApiRequestError = ApiError;

export function createNetworkError(cause?: unknown, technicalHint?: string): ApiError {
  const userMessage = "Unable to reach the server. Please check your internet connection or try again shortly.";
  return new ApiError(userMessage, {
    status: 0,
    code: "network_unreachable",
    isNetworkError: true,
    technicalDetails: isDevBuild ? technicalHint : undefined,
    cause,
  });
}

export function createTimeoutError(timeoutMs: number): ApiError {
  const userMessage = "The request took longer than expected to complete. Please try again.";
  return new ApiError(userMessage, {
    status: 408,
    code: "request_timeout",
    isTimeout: true,
    technicalDetails: isDevBuild ? `Aborted after timeout of ${timeoutMs}ms.` : undefined,
  });
}

export function apiRequestErrorFromBody(status: number, body: ApiErrorBody): ApiError {
  const code =
    body.error?.code ||
    (status === 401
      ? "session_expired"
      : status === 503
        ? "service_unavailable"
        : "request_failed");

  const message =
    status === 401
      ? body.error?.message || "Your session has expired. Sign in again."
      : status === 503
        ? body.error?.message || "The service is temporarily unavailable. Please try again in a moment."
        : body.error?.message || body.message || body.detail || `Request failed (${status}).`;

  return new ApiError(message, {
    status,
    code,
    requestId: body.error?.request_id,
    technicalDetails: isDevBuild && body.error?.details ? String(body.error.details) : undefined,
  });
}

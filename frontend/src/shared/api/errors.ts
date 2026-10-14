export type ApiErrorBody = {
  error?: { code?: string; message?: string; request_id?: string };
  message?: string;
  detail?: string;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(
    message: string,
    options: { status: number; code: string; requestId?: string; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export function apiRequestErrorFromBody(status: number, body: ApiErrorBody): ApiRequestError {
  const code = body.error?.code || (status === 401 ? "session_expired" : status === 503 ? "service_unavailable" : "request_failed");
  const message =
    status === 401
      ? body.error?.message || "Your session has expired. Sign in again."
      : status === 503
        ? body.error?.message || "The service is temporarily unavailable. Please try again in a moment."
        : body.error?.message || body.message || body.detail || `Request failed (${status}).`;
  return new ApiRequestError(message, {
    status,
    code,
    requestId: body.error?.request_id,
  });
}

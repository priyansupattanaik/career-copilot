/**
 * Shared application and network constants.
 */

// Cold start and network timeouts for free-tier deployments (e.g. Render spin-up)
export const COLD_START_NOTICE_DELAY_MS = 4000;
export const INITIAL_REQUEST_TIMEOUT_MS = 75000;
export const SUBSEQUENT_REQUEST_TIMEOUT_MS = 30000;

// Retry limits for idempotent requests
export const MAX_IDEMPOTENT_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 1000;

// Query caching stale times (TanStack Query)
export const STALE_TIME_DEFAULT_MS = 60 * 1000; // 60 seconds (dashboard, jobs)
export const STALE_TIME_STATIC_MS = 5 * 60 * 1000; // 5 minutes (rarely changing lists)
export const STALE_TIME_PROFILE_MS = 2 * 60 * 1000; // 2 minutes

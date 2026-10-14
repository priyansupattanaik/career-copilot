import { QueryClient } from "@tanstack/react-query";
import { STALE_TIME_DEFAULT_MS } from "@/shared/config/constants";
import { ApiError } from "./errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_DEFAULT_MS,
      gcTime: 10 * 60 * 1000, // 10 minutes cache retention
      refetchOnWindowFocus: false, // Prevent wasteful wakeups on tab toggle
      retry: (failureCount, error) => {
        // Do not retry 401/403/404 client errors
        if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false, // Never auto-retry mutations (POST/PUT/DELETE)
    },
  },
});

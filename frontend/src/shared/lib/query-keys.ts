/**
 * Canonical Query Key Factories for TanStack Query.
 * Organised per domain feature to guarantee consistent caching and invalidation.
 */

export const dashboardKeys = {
  all: ["dashboard"] as const,
  bootstrap: (scope: string) => [...dashboardKeys.all, "bootstrap", scope] as const,
  activity: () => [...dashboardKeys.all, "activity"] as const,
};

export const jobsKeys = {
  all: ["jobs"] as const,
  lists: () => [...jobsKeys.all, "list"] as const,
  list: (filters: Record<string, unknown> = {}) => [...jobsKeys.lists(), filters] as const,
  detail: (id: string) => [...jobsKeys.all, "detail", id] as const,
  saved: () => [...jobsKeys.all, "saved"] as const,
  recommendations: () => [...jobsKeys.all, "recommendations"] as const,
};

export const interviewKeys = {
  all: ["interviews"] as const,
  sessions: () => [...interviewKeys.all, "sessions"] as const,
  session: (id: string) => [...interviewKeys.all, "session", id] as const,
  report: (id: string) => [...interviewKeys.all, "report", id] as const,
};

export const resumeKeys = {
  all: ["resumes"] as const,
  list: () => [...resumeKeys.all, "list"] as const,
  detail: (id: string) => [...resumeKeys.all, "detail", id] as const,
  analyses: () => [...resumeKeys.all, "analyses"] as const,
  analysis: (id: string) => [...resumeKeys.analyses(), id] as const,
};

export const learningKeys = {
  all: ["learning"] as const,
  paths: () => [...learningKeys.all, "paths"] as const,
  path: (id: string) => [...learningKeys.all, "path", id] as const,
};

export const profileKeys = {
  all: ["profile"] as const,
  me: () => [...profileKeys.all, "me"] as const,
  publicProfile: (username: string) => [...profileKeys.all, "public", username] as const,
  communitySearch: (query: string) => [...profileKeys.all, "community", query] as const,
};

export const settingsKeys = {
  all: ["settings"] as const,
  overview: () => [...settingsKeys.all, "overview"] as const,
  preferences: () => [...settingsKeys.all, "preferences"] as const,
  notifications: () => [...settingsKeys.all, "notifications"] as const,
  privacy: () => [...settingsKeys.all, "privacy"] as const,
};

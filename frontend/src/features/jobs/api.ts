import { apiRequest } from "@/shared/api/client";
import type { Job, Recommendation, SavedJobRow, SavedJobStatus } from "./model/job-types";

export type ResumeSummary = {
  id: string;
  is_active?: boolean;
  latest_version?: {
    id?: string;
    extraction_status?: string | null;
  } | null;
};

export type JobAgentStatus = {
  mode: "agent" | "evidence" | "evidence_fallback";
  provider?: string | null;
  error?: string;
};

export function listSavedJobs() {
  return apiRequest<SavedJobRow[]>("/saved-jobs");
}

export function listResumeRows() {
  return apiRequest<ResumeSummary[]>("/resumes");
}

export function generateJobRecommendations(body: Record<string, string | number>) {
  return apiRequest<{ recommendations: Recommendation[]; agent?: JobAgentStatus }>(
    "/job-recommendations/generate",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function syncExternalJobs() {
  return apiRequest<unknown>("/jobs/external/sync", { method: "POST" });
}

export function unsaveJob(jobId: string) {
  return apiRequest<void>(`/saved-jobs/${jobId}`, { method: "DELETE" });
}

export function saveJob(jobId: string) {
  return apiRequest<{ status?: string }>(`/saved-jobs/${jobId}`, { method: "POST" });
}

export function updateSavedJobStatus(jobId: string, status: SavedJobStatus) {
  return apiRequest<unknown>(`/saved-jobs/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getJob(jobId: string) {
  return apiRequest<Job>(`/jobs/${jobId}`);
}

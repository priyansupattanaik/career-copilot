import { apiRequest } from "@/shared/api/client";

export function deleteResume(resumeId: string) {
  return apiRequest<void>(`/resumes/${resumeId}`, { method: "DELETE" });
}

export function deleteAtsAnalysis(analysisId: string) {
  return apiRequest<void>(`/ats-analyses/${analysisId}`, { method: "DELETE" });
}

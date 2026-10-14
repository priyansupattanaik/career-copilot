import { apiRequest } from "@/shared/api/client";

export function listLearningPaths<T>() {
  return apiRequest<T[]>("/learning-paths");
}

export function getLearningPath<T>(pathId: string) {
  return apiRequest<T>(`/learning-paths/${pathId}`);
}

export function generateLearningPath<T>(sourceAnalysisId: string) {
  return apiRequest<T>("/learning-paths/generate", {
    method: "POST",
    body: JSON.stringify({ source_analysis_id: sourceAnalysisId }),
  });
}

export function deleteLearningPath(pathId: string) {
  return apiRequest<void>(`/learning-paths/${pathId}`, { method: "DELETE" });
}

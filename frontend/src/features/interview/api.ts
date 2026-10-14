import { apiRequest } from "@/shared/api/client";

export function deleteInterview(sessionId: string) {
  return apiRequest<void>(`/interviews/${sessionId}`, { method: "DELETE" });
}

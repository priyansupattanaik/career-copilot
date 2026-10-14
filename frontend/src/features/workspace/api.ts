import { apiRequest } from "@/shared/api/client";

export function loadWorkspaceBootstrap<T>(scope: "full" | "shell") {
  return apiRequest<T>(`/me/bootstrap?scope=${scope}`);
}

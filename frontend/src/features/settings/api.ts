import { apiRequest } from "@/shared/api/client";

export function deleteAccount(body: { confirmation: string; email: string | null }) {
  return apiRequest<void>("/account", {
    method: "DELETE",
    body: JSON.stringify(body),
  });
}

export function saveSettingsRecord(kind: "notifications" | "privacy", payload: unknown) {
  return apiRequest<unknown>(`/settings/${kind}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

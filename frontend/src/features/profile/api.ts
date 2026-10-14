import { apiRequest } from "@/shared/api/client";

export function getProfile<T>() {
  return apiRequest<T>("/profile");
}

export function patchProfile(body: Record<string, unknown>) {
  return apiRequest<unknown>("/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

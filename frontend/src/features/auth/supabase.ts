import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabasePublishableKey, supabaseUrl } from "@/shared/config";

export class SupabaseWebConfigError extends Error {
  public readonly code = "supabase/web-config-missing";

  public constructor(public readonly missing: string[]) {
    super(`Supabase authentication is not configured in the browser. Missing: ${missing.join(", ")}.`);
    this.name = "SupabaseWebConfigError";
  }
}
export function getSupabaseWebConfigStatus() {
  const missing = [
    !supabaseUrl ? "VITE_SUPABASE_URL" : "",
    !supabasePublishableKey ? "VITE_SUPABASE_PUBLISHABLE_KEY" : "",
  ].filter(Boolean);
  return { configured: missing.length === 0, missing };
}

let client: SupabaseClient | null = null;

export function supabaseAuthClient(): SupabaseClient {
  const status = getSupabaseWebConfigStatus();
  if (!status.configured) throw new SupabaseWebConfigError(status.missing);
  client ??= createClient(supabaseUrl!, supabasePublishableKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

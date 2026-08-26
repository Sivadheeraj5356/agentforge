import { createClient } from "@supabase/supabase-js";
import type { Database } from "@agentforge/contracts";

import { getSupabasePublicEnv } from "./env";

/** Server-only. Never import from client components. Never NEXT_PUBLIC_*. */
export function createSupabaseServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

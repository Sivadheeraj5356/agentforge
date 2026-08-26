import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@agentforge/contracts";

import { getSupabasePublicEnv } from "./env";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}

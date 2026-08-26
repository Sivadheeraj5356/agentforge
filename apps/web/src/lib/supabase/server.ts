import { createServerClient } from "@supabase/ssr";
import type { Database } from "@agentforge/contracts";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "./env";

/** Request-scoped, anon-key client. Never the service role. */
export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Middleware/proxy refresh keeps the session fresh.
        }
      },
    },
  });
}

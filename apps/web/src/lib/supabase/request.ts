import { createServerClient } from "@supabase/ssr";
import type { Database } from "@agentforge/contracts";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "./env";
import { createSupabaseServerClient } from "./server";

/** Anon-key client. Uses Bearer JWT when present, otherwise cookies. Never service role. */
export async function createSupabaseRequestClient(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization && authorization.toLowerCase().startsWith("bearer ")) {
    const { url, anonKey } = getSupabasePublicEnv();
    return createServerClient<Database>(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          return;
        },
      },
    });
  }
  void cookies;
  return createSupabaseServerClient();
}

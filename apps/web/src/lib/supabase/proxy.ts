import { createServerClient } from "@supabase/ssr";
import type { Database } from "@agentforge/contracts";
import { type NextRequest, NextResponse } from "next/server";

import { getSupabasePublicEnv } from "./env";

/** Refresh the Auth session cookies on each matched request. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request,
  });

  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: do not add logic between createServerClient and getUser().
  await supabase.auth.getUser();

  return response;
}

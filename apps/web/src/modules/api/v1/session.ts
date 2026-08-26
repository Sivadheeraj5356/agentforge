import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { createSupabaseRequestClient } from "@/lib/supabase/request";

export type ApiSupabase = Awaited<ReturnType<typeof createSupabaseRequestClient>>;

export async function requireApiSession(
  request: Request,
): Promise<{ user: User; supabase: ApiSupabase } | NextResponse> {
  const supabase = await createSupabaseRequestClient(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user, supabase };
}

export function isApiError(
  value: { user: User; supabase: ApiSupabase } | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}

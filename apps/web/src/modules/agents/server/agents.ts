import type { Database } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Agent = Database["public"]["Tables"]["agents"]["Row"];

export async function listAgents(): Promise<Agent[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Unable to load agents.");
  }
  return data ?? [];
}

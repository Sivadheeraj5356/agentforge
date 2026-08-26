import type { Database } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type Finding = Database["public"]["Tables"]["findings"]["Row"];

export async function listReviewsForOrganization(organizationId: string): Promise<Review[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Unable to load reviews.");
  }
  return data ?? [];
}

export async function listFindingsForReview(reviewId: string): Promise<Finding[]> {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .select("*")
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error("Unable to load findings.");
  }
  return data ?? [];
}

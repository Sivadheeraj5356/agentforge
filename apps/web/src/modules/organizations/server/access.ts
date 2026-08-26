import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { OrganizationSlugSchema, type Database } from "@agentforge/contracts";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export type AccessibleOrganization = Organization & {
  role: Database["public"]["Enums"]["organization_role"];
};

export const getAccessibleOrganizations = cache(async (): Promise<AccessibleOrganization[]> => {
  const user = await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id, role, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error("Unable to load organizations.");
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const ids = memberships.map((row) => row.organization_id);
  const { data: organizations, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .in("id", ids);

  if (orgError || !organizations) {
    throw new Error("Unable to load organizations.");
  }

  const byId = new Map(organizations.map((org) => [org.id, org]));
  const result: AccessibleOrganization[] = [];

  for (const membership of memberships) {
    const organization = byId.get(membership.organization_id);
    if (organization) {
      result.push({ ...organization, role: membership.role });
    }
  }

  return result;
});

export const ensurePersonalOrganization = cache(async (): Promise<Organization> => {
  await requireAuthenticatedUser();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("ensure_personal_organization");

  if (error || !data) {
    throw new Error("Unable to prepare your workspace.");
  }

  return data;
});

export const requireOrganizationBySlug = cache(
  async (rawSlug: string): Promise<AccessibleOrganization> => {
    const user = await requireAuthenticatedUser();

    const parsed = OrganizationSlugSchema.safeParse(rawSlug);
    if (!parsed.success) {
      notFound();
    }

    const supabase = await createSupabaseServerClient();
    const { data: organization, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", parsed.data)
      .maybeSingle();

    if (error || !organization) {
      notFound();
    }

    const { data: membership } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      notFound();
    }

    return {
      ...organization,
      role: membership.role,
    };
  },
);

export async function resolveDefaultOrganizationPath(): Promise<string> {
  await requireAuthenticatedUser();

  const orgs = await getAccessibleOrganizations();
  if (orgs.length === 0) {
    const personal = await ensurePersonalOrganization();
    return `/app/${personal.slug}`;
  }

  const first = orgs[0];
  if (!first) {
    redirect("/login");
  }
  return `/app/${first.slug}`;
}

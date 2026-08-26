import type { ReactElement, ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import {
  getAccessibleOrganizations,
  requireOrganizationBySlug,
} from "@/modules/organizations/server/access";

export default async function OrganizationLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ organizationSlug: string }>;
}>): Promise<ReactElement> {
  const { organizationSlug } = await params;
  const [user, organization, organizations] = await Promise.all([
    requireAuthenticatedUser(),
    requireOrganizationBySlug(organizationSlug),
    getAccessibleOrganizations(),
  ]);

  return (
    <AppShell
      organizationSlug={organization.slug}
      organizations={organizations.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      }))}
      userEmail={user.email}
    >
      {children}
    </AppShell>
  );
}

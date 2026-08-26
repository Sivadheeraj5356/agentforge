import { redirect } from "next/navigation";

import { resolveDefaultOrganizationPath } from "@/modules/organizations/server/access";

export default async function AppIndexPage(): Promise<never> {
  redirect(await resolveDefaultOrganizationPath());
}

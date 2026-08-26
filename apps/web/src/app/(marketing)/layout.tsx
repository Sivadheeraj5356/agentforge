import type { ReactElement, ReactNode } from "react";

import { SiteChrome } from "@/components/marketing/site-chrome";
import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function MarketingLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const user = await getOptionalAuthenticatedUser();
  return <SiteChrome signedIn={Boolean(user)}>{children}</SiteChrome>;
}

import type { ReactElement, ReactNode } from "react";

import { requireAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function AppRootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  await requireAuthenticatedUser();
  return <>{children}</>;
}

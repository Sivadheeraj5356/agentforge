import type { Metadata } from "next";
import type { ReactElement } from "react";

import { LandingExperience } from "@/components/marketing/landing-experience";
import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";
import { LANDING_SUBHEAD } from "@/modules/marketing/copy";

export const metadata: Metadata = {
  title: {
    absolute: "AgentForge",
  },
  description: LANDING_SUBHEAD,
};

export default async function LandingPage(): Promise<ReactElement> {
  const user = await getOptionalAuthenticatedUser();
  const primaryHref = user ? "/app" : "/signup";
  const primaryLabel = user ? "Open workspace" : "Create account";

  return <LandingExperience primaryHref={primaryHref} primaryLabel={primaryLabel} />;
}

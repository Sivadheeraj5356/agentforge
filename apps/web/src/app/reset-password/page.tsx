import type { ReactElement } from "react";
import { redirect } from "next/navigation";

import { AuthFormShell } from "@/modules/auth/components/auth-form-shell";
import { ResetPasswordForm } from "@/modules/auth/components/auth-forms";
import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function ResetPasswordPage(): Promise<ReactElement> {
  const user = await getOptionalAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <AuthFormShell
      title="Choose a new password"
      description="Set a new password for your AgentForge account."
    >
      <ResetPasswordForm />
    </AuthFormShell>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { AuthFormShell } from "@/modules/auth/components/auth-form-shell";
import { SignUpForm } from "@/modules/auth/components/auth-forms";
import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function SignUpPage(): Promise<ReactElement> {
  const user = await getOptionalAuthenticatedUser();
  if (user) {
    redirect("/app");
  }

  return (
    <AuthFormShell
      title="Create account"
      description="Start with a personal workspace. Team administration arrives later."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthFormShell>
  );
}

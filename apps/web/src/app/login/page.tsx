import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { getSafeRedirectPath } from "@agentforge/security";

import { AuthFormShell } from "@/modules/auth/components/auth-form-shell";
import { SignInForm } from "@/modules/auth/components/auth-forms";
import { getOptionalAuthenticatedUser } from "@/modules/auth/server/require-authenticated-user";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}): Promise<ReactElement> {
  const user = await getOptionalAuthenticatedUser();
  if (user) {
    redirect("/app");
  }

  const params = await searchParams;
  const next = getSafeRedirectPath(params.next, "/app");

  return (
    <AuthFormShell
      title="Sign in"
      description="Access your organization workspaces and evaluation infrastructure."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {params.error ? (
        <p role="alert" className="text-danger mb-4 text-sm">
          Authentication failed. Please try again.
        </p>
      ) : null}
      <SignInForm next={next} />
    </AuthFormShell>
  );
}

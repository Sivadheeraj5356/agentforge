import Link from "next/link";
import type { ReactElement } from "react";

import { AuthFormShell } from "@/modules/auth/components/auth-form-shell";
import { ForgotPasswordForm } from "@/modules/auth/components/auth-forms";

export default function ForgotPasswordPage(): ReactElement {
  return (
    <AuthFormShell
      title="Reset password"
      description="Enter your email and we will send reset instructions if an account exists."
      footer={
        <Link href="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthFormShell>
  );
}

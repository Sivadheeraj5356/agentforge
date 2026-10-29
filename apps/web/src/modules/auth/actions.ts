"use server";

import {
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  SignInInputSchema,
  SignUpInputSchema,
} from "@agentforge/contracts";
import { getSafeRedirectPath } from "@agentforge/security";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapAuthError } from "@/modules/auth/errors";
import { ensurePersonalOrganization } from "@/modules/organizations/server/access";

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signUpAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignUpInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName") || undefined,
  });

  if (!parsed.success) {
    return { error: "Check your email, password, and display name." };
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined,
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  });

  if (error) {
    return { error: mapAuthError(error, "Unable to create your account.") };
  }

  await ensurePersonalOrganization().catch(() => {
    // Session may require email confirmation locally; ignore until signed in.
  });

  redirect("/app");
}

export async function signInAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = SignInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const next = getSafeRedirectPath(String(formData.get("next") || "/app"));
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: mapAuthError(error, "Unable to sign in with those credentials.") };
  }

  const organization = await ensurePersonalOrganization();
  // Prefer an explicit safe `next` when provided; otherwise land on the personal workspace.
  if (next !== "/app") {
    redirect(next);
  }
  redirect(`/app/${organization.slug}`);
}

/** Start Google sign-in through Supabase Auth (PKCE). The session is created in /auth/callback. */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  const next = getSafeRedirectPath(String(formData.get("next") || "/app"));
  const supabase = await createSupabaseServerClient();
  // Use the host the user is on, so preview deployments return to themselves.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const appUrl = host
    ? `${proto}://${host}`
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    redirect("/login?error=auth");
  }

  redirect(data.url);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ForgotPasswordInputSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createSupabaseServerClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

  // Neutral response regardless of whether the email exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  });

  return {
    success: "If an account exists for that email, reset instructions have been sent.",
  };
}

export async function resetPasswordAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = ResetPasswordInputSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: mapAuthError(error, "Unable to update password.") };
  }

  redirect("/app");
}

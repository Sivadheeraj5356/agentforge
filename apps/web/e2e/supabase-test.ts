import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:15421";
export const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
export const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export function adminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createVerifiedUser(email: string, password: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: email.split("@")[0] },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Unable to create test user");
  }
  return data.user;
}

function isJwtClockSkew(message: string | undefined): boolean {
  return (message ?? "").toLowerCase().includes("jwt issued at future");
}

export async function bootstrapOrg(
  email: string,
  password: string,
): Promise<{ id: string; slug: string }> {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw signInError;
  }

  let lastMessage = "bootstrap failed";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await client.rpc("ensure_personal_organization");
    if (!error && data?.id && data.slug) {
      return { id: data.id as string, slug: data.slug as string };
    }
    lastMessage = error?.message ?? "bootstrap failed";
    if (!isJwtClockSkew(error?.message)) {
      throw new Error(lastMessage);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(lastMessage);
}

export async function bootstrapOrgSlug(email: string, password: string): Promise<string> {
  const org = await bootstrapOrg(email, password);
  return org.slug;
}

export async function signInViaUi(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/personal-/, { timeout: 90_000 });
}

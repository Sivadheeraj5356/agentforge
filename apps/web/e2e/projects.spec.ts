import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  anonKey,
  bootstrapOrg,
  createVerifiedUser,
  signInViaUi,
  supabaseUrl,
} from "./supabase-test";

test.describe("projects domain @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const userA = {
    email: `proj.alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  const userB = {
    email: `proj.bob.${suffix}@example.com`,
    password: "password-bob-123",
  };
  let orgASlug = "";
  let orgBSlug = "";
  let orgBId = "";
  let projectASlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(userA.email, userA.password);
    await createVerifiedUser(userB.email, userB.password);
    const orgA = await bootstrapOrg(userA.email, userA.password);
    const orgB = await bootstrapOrg(userB.email, userB.password);
    orgASlug = orgA.slug;
    orgBSlug = orgB.slug;
    orgBId = orgB.id;
  });

  test("empty → create → list → open → settings → archive → filter → restore", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, userA.email, userA.password);
    await expect(page.getByText("No projects yet")).toBeVisible();

    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Name").fill("Terminal Bench Smoke");
    await page.getByLabel("Description").fill("Plain text notes only");
    await page.getByRole("button", { name: "Create project" }).last().click();

    await expect(page).toHaveURL(/\/projects\/terminal-bench-smoke/);
    projectASlug = "terminal-bench-smoke";
    await expect(page.getByRole("heading", { name: "Terminal Bench Smoke" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add task" })).toBeEnabled();

    await page.goto(`/app/${orgASlug}/projects`);
    await expect(page.getByRole("link", { name: /Terminal Bench Smoke/ })).toBeVisible();

    await page.getByRole("link", { name: /Terminal Bench Smoke/ }).click();
    await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Project settings" })).toBeVisible();

    await page.getByLabel("Name").fill("Terminal Bench Smoke v2");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText(/updated/i);

    await page.getByRole("button", { name: "Archive project" }).click();
    await expect(page).toHaveURL(/status=archived/);
    await expect(page.getByRole("link", { name: /Terminal Bench Smoke v2/ })).toBeVisible();

    await page.goto(`/app/${orgASlug}/projects`);
    await expect(page.getByText(/No projects yet|No projects match/i)).toBeVisible();

    await page.getByRole("tab", { name: "Archived" }).click();
    await page.getByRole("link", { name: /Terminal Bench Smoke v2/ }).click();
    await page.getByRole("main").getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Restore project" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectASlug}$`));
    await expect(page.getByRole("heading", { name: "Terminal Bench Smoke v2" })).toBeVisible();
  });

  test("user A opens own project; foreign project URL is not found", async ({ page }) => {
    await signInViaUi(page, userA.email, userA.password);
    await page.goto(`/app/${orgASlug}/projects/${projectASlug}`);
    await expect(page.getByRole("heading", { name: /Terminal Bench Smoke/ })).toBeVisible();

    await page.goto(`/app/${orgBSlug}/projects/${projectASlug}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("cross-tenant project mutations are blocked at the API", async () => {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({
      email: userA.email,
      password: userA.password,
    });
    expect(signInError).toBeNull();

    const { data: bobOrg } = await client
      .from("organizations")
      .select("id")
      .eq("slug", orgBSlug)
      .maybeSingle();
    expect(bobOrg).toBeNull();

    const { data: user } = await client.auth.getUser();
    const { error: insertError } = await client.from("projects").insert({
      organization_id: orgBId,
      name: "Hostile",
      slug: `hostile-${suffix}`,
      created_by: user.user!.id,
    });
    expect(insertError).not.toBeNull();
  });
});

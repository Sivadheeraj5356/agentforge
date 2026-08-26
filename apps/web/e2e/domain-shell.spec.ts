import { expect, test } from "@playwright/test";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

test.describe("chunk 4 domain shell @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const userA = {
    email: `domain.alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  const userB = {
    email: `domain.bob.${suffix}@example.com`,
    password: "password-bob-123",
  };
  let orgASlug = "";
  let orgBSlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(userA.email, userA.password);
    await createVerifiedUser(userB.email, userB.password);
    orgASlug = await bootstrapOrgSlug(userA.email, userA.password);
    orgBSlug = await bootstrapOrgSlug(userB.email, userB.password);
    expect(orgASlug).not.toEqual(orgBSlug);
  });

  test("benchmarks, evaluations, results, and settings empty states render", async ({ page }) => {
    await signInViaUi(page, userA.email, userA.password);

    await page.goto(`/app/${orgASlug}`);
    const primaryNav = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Evaluations" })).toBeVisible();
    await expect(primaryNav.getByRole("link", { name: "Trials" })).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Lab" }),
    ).toHaveCount(0);

    await page.goto(`/app/${orgASlug}/benchmarks`);
    await expect(page.getByRole("link", { name: "AgentForge" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Benchmarks" })).toBeVisible();
    await expect(page.getByText("agentforge-internal")).toBeVisible();
    await expect(page.getByText("terminal-bench")).toBeVisible();

    await page.goto(`/app/${orgASlug}/evaluations`);
    await expect(page.getByRole("heading", { name: "Evaluations" })).toBeVisible();
    await expect(page.getByText("No evaluation runs")).toBeVisible();

    await page.goto(`/app/${orgASlug}/trials`);
    await expect(page.getByRole("heading", { name: "Trials" })).toBeVisible();
    await expect(page.getByText("No trials yet")).toBeVisible();

    await page.goto(`/app/${orgASlug}/results`);
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.getByText("No results yet")).toBeVisible();

    await page.goto(`/app/${orgASlug}/settings`);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    await page.goto(`/app/${orgASlug}/environments`);
    await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible();
    await expect(page.getByText("Simulated Slack", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("31%")).toHaveCount(0);
  });

  test("unauthorized org still not-found on new routes", async ({ page }) => {
    await signInViaUi(page, userA.email, userA.password);
    await page.goto(`/app/${orgBSlug}/benchmarks`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });
});

import { expect, test, type Browser } from "@playwright/test";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

test.describe("authenticated shell + cross-tenant @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const userA = {
    email: `alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  const userB = {
    email: `bob.${suffix}@example.com`,
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

  test("auth shell loads with empty projects", async ({ page }) => {
    await signInViaUi(page, userA.email, userA.password);
    await expect(page.getByRole("heading", { name: "Evaluation Infrastructure" })).toBeVisible();
    await expect(page.getByText("No projects yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create project" })).toBeEnabled();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Color theme" })).toBeVisible();
  });

  test("user A can open org A and cannot open org B", async ({ page }) => {
    await signInViaUi(page, userA.email, userA.password);
    await page.goto(`/app/${orgASlug}`);
    await expect(page.getByRole("heading", { name: "Evaluation Infrastructure" })).toBeVisible();

    await page.goto(`/app/${orgBSlug}`);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("theme toggle updates document class", async ({ browser }: { browser: Browser }) => {
    const page = await browser.newPage();
    await signInViaUi(page, userA.email, userA.password);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.close();
  });
});

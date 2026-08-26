import { expect, test } from "@playwright/test";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

test.describe("work environments chrome @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const user = {
    email: `env.alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  let orgSlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(user.email, user.password);
    orgSlug = await bootstrapOrgSlug(user.email, user.password);
  });

  test("lists simulated packs and queues without invented percentages", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, user.email, user.password);

    await page.goto(`/app/${orgSlug}/projects`);
    const trigger = page.getByRole("button", { name: "Create project" }).first();
    const dialog = page.getByRole("dialog");
    await expect(trigger).toBeEnabled();
    await expect(async () => {
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await dialog.getByLabel("Name").fill("Env Pack");
    await dialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/env-pack/);

    await page.goto(`/app/${orgSlug}/environments`);
    await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Environments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run multi-agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run BYO" })).toBeVisible();
    await expect(page.getByLabel("Experience pack")).toContainText("Wave inventory");
    await expect(page.getByLabel("Experience pack")).toContainText("Skill constraint");
    await expect(page.getByText("Simulated Slack", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Simulated GitHub", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Simulated Jira", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Simulated Grafana", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("No staged scores yet")).toBeVisible();
    await expect(page.getByText("31%")).toHaveCount(0);
    await expect(page.getByText("24%")).toHaveCount(0);
    await expect(page.getByText("19%")).toHaveCount(0);
    await expect(page.getByText("54%")).toHaveCount(0);
    await expect(page.getByText("28%")).toHaveCount(0);

    await page.getByLabel("Experience pack").selectOption("orders-ops");
    await page.getByRole("button", { name: "Run oracle" }).click();
    await expect(
      page.getByText("Pack run queued. Stage scores appear after the evaluator worker."),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("31%")).toHaveCount(0);
  });
});

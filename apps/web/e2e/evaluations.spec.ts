import { expect, test, type Locator, type Page } from "@playwright/test";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

test.describe("evaluation enqueue @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const user = {
    email: `eval.alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  let orgSlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(user.email, user.password);
    orgSlug = await bootstrapOrgSlug(user.email, user.password);
  });

  async function openDialog(page: Page, triggerName: string): Promise<Locator> {
    const trigger = page.getByRole("button", { name: triggerName }).first();
    const dialog = page.getByRole("dialog");
    await expect(trigger).toBeEnabled();
    await expect(async () => {
      await trigger.click();
      await expect(dialog).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    return dialog;
  }

  test("queues an oracle run without inventing scores", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, user.email, user.password);

    await page.goto(`/app/${orgSlug}/projects`);
    const createDialog = await openDialog(page, "Create project");
    await createDialog.getByLabel("Name").fill("Eval Harness");
    await createDialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/projects\/eval-harness/);

    await page.goto(`/app/${orgSlug}/evaluations`);
    await expect(page.getByRole("heading", { name: "Evaluations" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run oracle" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run multi-agent" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run BYO" })).toBeVisible();
    await page.getByLabel("Catalog task", { exact: true }).selectOption("broken-orders-api");
    await page.getByLabel("Sandbox").selectOption("isolated");
    await page.getByRole("button", { name: "Run oracle" }).click();
    const runLink = page.getByRole("link", { name: /eval-harness \/ run 1/i });
    await expect(runLink).toBeVisible({ timeout: 30_000 });
    await expect(runLink).toContainText("queued");
    await expect(page.getByText("AgentForge").first()).toBeVisible();
    await expect(page.getByText("54%")).toHaveCount(0);
    await expect(page.getByText("28%")).toHaveCount(0);

    const href = await runLink.getAttribute("href");
    expect(href).toBeTruthy();
    const report = await page.request.get(`${href}/report`);
    expect(report.ok()).toBeTruthy();
    const body = await report.json();
    expect(body.product).toBe("AgentForge");
    expect(body.costUsd).toBeNull();
    expect(body.scores?.passAt1 ?? null).toBeNull();
    expect(JSON.stringify(body)).not.toContain("54%");
    expect(JSON.stringify(body)).not.toContain("28%");

    await page.goto(`/app/${orgSlug}/evaluations`);
    await page.getByLabel("Catalog task", { exact: true }).selectOption("broken-orders-api");
    await page.getByLabel("Sandbox").selectOption("isolated");
    await page.getByRole("button", { name: "Run agent" }).click();
    const agentLink = page.getByRole("link", { name: /eval-harness \/ run 2/i });
    await expect(agentLink).toBeVisible({ timeout: 30_000 });
    await expect(agentLink).toContainText("queued");
    await expect(page.getByText("54%")).toHaveCount(0);
    await expect(page.getByText("28%")).toHaveCount(0);
  });
});

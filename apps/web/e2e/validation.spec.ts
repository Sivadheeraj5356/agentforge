import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureZip } from "@agentforge/validation";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

test.describe("task package validation @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const user = {
    email: `val.alice.${suffix}@example.com`,
    password: "password-alice-123",
  };
  let orgSlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(user.email, user.password);
    orgSlug = await bootstrapOrgSlug(user.email, user.password);
  });

  /**
   * Opens a dialog and returns it. The click is retried because a click issued
   * before hydration is silently dropped, and the trigger shares its name with the
   * dialog's submit button, so callers must scope form interactions to the dialog.
   */
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

  async function uploadPackage(
    page: Page,
    projectName: string,
    projectSlug: string,
    zip: Uint8Array,
  ): Promise<void> {
    // The projects list always offers the create dialog; the org home only does when empty.
    await page.goto(`/app/${orgSlug}/projects`);
    const createDialog = await openDialog(page, "Create project");
    await createDialog.getByLabel("Name").fill(projectName);
    await createDialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}`));

    const uploadDialog = await openDialog(page, "Add task");
    await uploadDialog.getByLabel("Task package (ZIP)").setInputFiles({
      name: "terminus-task.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });
    await uploadDialog.getByRole("button", { name: "Upload and validate" }).click();
    await expect(page).toHaveURL(/\/validations\/[0-9a-f-]{36}/, { timeout: 90_000 });
  }

  test("a complete package reports no findings", async ({ page }) => {
    test.setTimeout(180_000);
    expect(orgSlug.length).toBeGreaterThan(0);
    await signInViaUi(page, user.email, user.password);

    await uploadPackage(page, "Validation Valid", "validation-valid", fixtureZip("valid"));

    await expect(page.getByRole("heading", { name: "Validation report" })).toBeVisible();
    await expect(page.getByText("Passed", { exact: true })).toBeVisible();
    await expect(page.getByText("No validation issues found.")).toBeVisible();
    await expect(page.getByText(/terminus/).first()).toBeVisible();
  });

  test("a malformed package renders findings with evidence and detail", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, user.email, user.password);

    await uploadPackage(
      page,
      "Validation Broken",
      "validation-broken",
      fixtureZip("invalid-environment"),
    );

    await expect(page.getByRole("heading", { name: "Validation report" })).toBeVisible();
    await expect(page.getByText("Failed", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK")).toBeVisible();
    await expect(page.getByText("environment/Dockerfile:2")).toBeVisible();

    await page.getByText("Show detail").first().click();
    await expect(page.getByText("Recommendation").first()).toBeVisible();

    await page.getByRole("link", { name: /^Warning/ }).click();
    await expect(page).toHaveURL(/severity=warning/);
    await expect(page.getByText("TASK_ENVIRONMENT_WORKDIR_MISSING")).toBeVisible();
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK")).toHaveCount(0);
  });
});

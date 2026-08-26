import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureZip } from "@agentforge/validation";

import { bootstrapOrgSlug, createVerifiedUser, signInViaUi } from "./supabase-test";

/**
 * Task inspector end to end. Motion is reduced for every test here: the panes and
 * disclosures animate, and waiting on a transition is the classic source of flake.
 */
test.use({ reducedMotion: "reduce" });

test.describe("task inspector @smoke", () => {
  test.describe.configure({ mode: "serial" });

  const suffix = Date.now();
  const owner = {
    email: `inspector.owner.${suffix}@example.com`,
    password: "password-inspector-123",
  };
  const outsider = {
    email: `inspector.outsider.${suffix}@example.com`,
    password: "password-outsider-123",
  };
  const projectName = `Inspector ${suffix}`;
  const projectSlug = `inspector-${suffix}`;

  let orgSlug = "";
  let outsiderOrgSlug = "";

  test.beforeAll(async () => {
    await createVerifiedUser(owner.email, owner.password);
    await createVerifiedUser(outsider.email, outsider.password);
    orgSlug = await bootstrapOrgSlug(owner.email, owner.password);
    outsiderOrgSlug = await bootstrapOrgSlug(outsider.email, outsider.password);
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

  async function uploadInto(page: Page, zip: Uint8Array): Promise<void> {
    await page.goto(`/app/${orgSlug}/projects/${projectSlug}`);
    const dialog = await openDialog(page, "Add task");
    await dialog.getByLabel("Task package (ZIP)").setInputFiles({
      name: "terminus-task.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(zip),
    });
    await dialog.getByRole("button", { name: "Upload and validate" }).click();
    await expect(page).toHaveURL(/\/validations\/[0-9a-f-]{36}/, { timeout: 120_000 });
  }

  /**
   * Entering the inspector is the slowest navigation in the suite: `next dev` compiles
   * the route on first request and the URL only changes once the server payload lands.
   * The default expect timeout is not enough for that first cold hit on Windows.
   */
  async function openFirstTask(page: Page): Promise<void> {
    await page.goto(`/app/${orgSlug}/projects/${projectSlug}/tasks`);
    await page
      .getByRole("link")
      .filter({ hasText: /run|finding/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/tasks\/[a-z0-9-]+(\?|$)/, { timeout: 120_000 });
  }

  test("a validated package becomes a browsable task", async ({ page }) => {
    test.setTimeout(240_000);
    await signInViaUi(page, owner.email, owner.password);

    await page.goto(`/app/${orgSlug}/projects`);
    const createDialog = await openDialog(page, "Create project");
    await createDialog.getByLabel("Name").fill(projectName);
    await createDialog.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}`));

    await uploadInto(page, fixtureZip("invalid-environment"));

    await page.goto(`/app/${orgSlug}/projects/${projectSlug}`);
    await page.getByRole("link", { name: /run 1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectSlug}/tasks/[a-z0-9-]+$`), {
      timeout: 120_000,
    });

    // Header states the facts and nothing invented.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("terminus", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Failed", { exact: true }).first()).toBeVisible();

    // Tree, viewer, findings.
    const tree = page.getByRole("tree", { name: "Task files" });
    await expect(tree).toBeVisible();
    await expect(tree.getByRole("treeitem", { name: /instruction\.md/ })).toBeVisible();

    await tree.getByRole("treeitem", { name: /instruction\.md/ }).click();
    await expect(page.getByText("Contents of instruction.md")).toBeAttached();

    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK").first()).toBeVisible();
  });

  test("clicking a finding opens its file and marks the evidence line", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, owner.email, owner.password);
    await openFirstTask(page);

    await page
      .getByRole("button", { name: /TASK_ENVIRONMENT_SOLUTION_LEAK/ })
      .first()
      .click();

    await expect(page.getByText("environment/Dockerfile").first()).toBeVisible();
    await expect(page.getByTestId("evidence-line").first()).toBeVisible();
    await expect(page).toHaveURL(/file=environment%2FDockerfile/);
    await expect(page).toHaveURL(/line=/);
  });

  test("filters and search narrow the report and stay in the URL", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, owner.email, owner.password);
    await openFirstTask(page);

    const severityFilters = page.getByRole("group", { name: "Severity" });
    await severityFilters.getByRole("button", { name: /^Warning/ }).click();
    await expect(page).toHaveURL(/severity=warning/);
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK")).toHaveCount(0);

    await severityFilters.getByRole("button", { name: /^All/ }).click();
    await page.getByPlaceholder("Search title, code, path, validator").fill("workdir");
    await expect(page).toHaveURL(/q=workdir/);
    await expect(page.getByText("TASK_ENVIRONMENT_WORKDIR_MISSING").first()).toBeVisible();
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK")).toHaveCount(0);
  });

  test("keyboard alone moves through the file tree", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, owner.email, owner.password);
    await openFirstTask(page);

    const tree = page.getByRole("tree", { name: "Task files" });
    await tree.getByRole("treeitem").first().focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/file=/);
  });

  test("a second run adds history and can be compared", async ({ page }) => {
    test.setTimeout(300_000);
    await signInViaUi(page, owner.email, owner.password);

    await uploadInto(page, fixtureZip("valid"));

    await openFirstTask(page);

    await page.getByText("Run history").click();
    await expect(page.getByRole("link", { name: "#1" })).toBeVisible();
    await expect(page.getByRole("link", { name: "#2" })).toBeVisible();

    await page.getByRole("link", { name: "#1" }).click();
    await expect(page).toHaveURL(/\/runs\/1/);
    await expect(page.getByText("TASK_ENVIRONMENT_SOLUTION_LEAK").first()).toBeVisible();

    await page.getByRole("link", { name: "Compare runs" }).click();
    await expect(page).toHaveURL(/\/runs\/compare/);
    await expect(page.getByRole("heading", { name: "Compare runs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resolved" })).toBeVisible();
  });

  test("dark mode keeps the inspector readable", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, owner.email, owner.password);
    await openFirstTask(page);

    await page
      .getByRole("group", { name: "Color theme" })
      .getByRole("button", { name: "Dark" })
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByRole("tree", { name: "Task files" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Findings" })).toBeVisible();
  });

  test("another organization's task and files are not found", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, outsider.email, outsider.password);

    // The outsider is signed in, but this project belongs to someone else.
    const response = await page.goto(`/app/${orgSlug}/projects/${projectSlug}/tasks`);
    expect(response?.status()).toBe(404);

    const fileResponse = await page.request.get(
      `/app/${orgSlug}/projects/${projectSlug}/tasks/does-not-matter/runs/1/file?path=instruction.md`,
    );
    expect(fileResponse.status()).toBe(404);

    // The outsider's own org exists, so this proves the 404 is about tenancy.
    const own = await page.goto(`/app/${outsiderOrgSlug}/projects`);
    expect(own?.status()).toBe(200);
  });

  test("a tampered file path is refused", async ({ page }) => {
    test.setTimeout(180_000);
    await signInViaUi(page, owner.email, owner.password);
    await openFirstTask(page);

    const taskUrl = new URL(page.url());
    const base = `${taskUrl.pathname.replace(/\/$/, "")}/runs/1/file`;

    for (const candidate of ["../../../etc/passwd", "/etc/passwd", "C:\\Windows\\win.ini"]) {
      const response = await page.request.get(`${base}?path=${encodeURIComponent(candidate)}`);
      expect([400, 404]).toContain(response.status());
    }

    const missing = await page.request.get(`${base}?path=${encodeURIComponent("nope.md")}`);
    expect(missing.status()).toBe(404);
  });
});

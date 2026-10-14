import { expect, test } from "@playwright/test";

test.describe("auth entry smoke @smoke", () => {
  test("anonymous /app redirects to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("public landing and docs are available without signing in", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", {
        name: "Know if the agent actually fixed it.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "What AgentForge provides." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who it's for." })).toBeVisible();
    await expect(page.getByText("Orders API operations").first()).toBeVisible();
    await expect(page.getByText("EU payments incident").first()).toBeVisible();
    await expect(page.getByText("Checkout console clone").first()).toBeVisible();
    await expect(page.getByText("Private eval — stalled release train").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Docs" }).first()).toBeVisible();
    await expect(page.getByRole("group", { name: "Color theme" }).first()).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions" })).toHaveCount(0);
    await expect(page.getByText("Is Docs public?")).toHaveCount(0);
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByText(/Terminal-Bench 4/i)).toHaveCount(0);

    await page.goto("/docs");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search docs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "RL environments", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(/Terminal-Bench 4/i)).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "Docs" })
      .getByRole("link", { name: "RL environments", exact: true })
      .click();
    await expect(page).toHaveURL(/\/docs\/environments/);
    await expect(page.getByRole("heading", { name: "RL environments", exact: true })).toBeVisible();

    await page.goto("/docs/rlvr");
    await expect(page.getByRole("heading", { name: "RLVR", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toHaveCount(0);

    await page.goto("/docs/private-eval");
    await expect(
      page.getByRole("heading", { name: "Private long-horizon eval", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/pinned environment/i).first()).toBeVisible();
    await expect(page.getByText(/we score \d+%/i)).toHaveCount(0);

    await page.goto("/docs/benchmark");
    await expect(
      page.getByRole("heading", { name: "AgentForge Horizon", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/not a Fable 5 leaderboard/i).first()).toBeVisible();
    await expect(page.getByText(/Fable 5 scored/i)).toHaveCount(0);

    await page.goto("/docs");
    await page.getByRole("button", { name: "Search docs" }).click();
    await expect(page.getByRole("dialog", { name: "Search docs" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Search docs" })).not.toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Search docs" })).toBeVisible();
  });

  test("login and signup pages render", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
    await expect(page.getByLabel("Display name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("invalid sign-in shows safe error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Unable to sign in" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("theme control switches without crashing", async ({ page }) => {
    await page.goto("/login");
    // Theme control lives in authenticated shell; auth screens stay stable.
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});

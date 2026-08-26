import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // One worker avoids Next.js compile stampedes on Windows (first action otherwise exceeds default timeouts).
  workers: 1,
  timeout: 90_000,
  // `next dev` compiles each route on first request. On Windows that regularly pushes a
  // first navigation or server action past 20s, so a spec run on its own would fail on
  // compile latency rather than on behaviour.
  expect: { timeout: 45_000 },
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm exec next dev --port 3000",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // A cold Next dev start on Windows regularly needs more than two minutes.
    timeout: 240_000,
  },
});

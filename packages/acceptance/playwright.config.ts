import { defineConfig, devices } from "@playwright/test";

// Acceptance configuration follows the layered architecture from Synapse's
// `acceptance-testing` doc: specs are business-language only, drivers/pages
// hide selectors, infrastructure (this file + global-setup.ts) wires real
// processes. The webServer entries spawn the API server (against the test
// DB) and the Vite dev server before tests run; global-setup migrates the
// test DB once.

const isCi = process.env.CI !== undefined && process.env.CI !== "";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";
const API_URL = process.env.API_URL ?? "http://localhost:3000";
const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";

if (!DATABASE_URL_TEST.toLowerCase().includes("test")) {
  throw new Error(
    `[acceptance] refusing to start — DATABASE_URL_TEST name must contain 'test', got '${DATABASE_URL_TEST}'`,
  );
}

export default defineConfig({
  testDir: "./specs",
  // One worker keeps DB-resetting per test deterministic. The test suite is
  // small; parallelism would buy little here and complicate truncation.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? "line" : "list",

  globalSetup: "./global-setup.ts",

  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // The API server points at the TEST database. global-setup has already
      // migrated it before this command runs.
      command: "pnpm --filter @org/server dev",
      url: `${API_URL}/users?page=1&pageSize=1`,
      cwd: "../../",
      env: {
        ...process.env,
        DATABASE_URL: DATABASE_URL_TEST,
        ENV: "dev",
        PORT: "3000",
        APP_URL,
        OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
      },
      reuseExistingServer: !isCi,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Vite dev server for the client. The default `.env` sets VITE_API_URL
      // to the local API; no override needed for that.
      command: "pnpm --filter @org/client dev",
      url: APP_URL,
      cwd: "../../",
      reuseExistingServer: !isCi,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Load the repo's root .env so ZITADEL_* vars are available to global-setup
// and propagate via webServer.env to the API server.
dotenv.config({ path: "../../.env" });

// Acceptance configuration follows the layered architecture from Synapse's
// `acceptance-testing` doc: specs are business-language only, drivers/pages
// hide selectors, infrastructure (this file + global-setup.ts) wires real
// processes. The webServer entries spawn the API server (against the test
// DB) and the Vite dev server before tests run; global-setup migrates the
// test DB once and pre-seeds the admin row.
//
// Auth: an `auth-setup` project runs the real Zitadel hosted-UI login as
// admin and stamps the cookie into storageState. The `chromium` project
// depends on it and inherits the storage state so each spec starts
// authenticated. login.spec.ts opts out of the storage state to exercise
// the full UI flow on every run.

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

const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

export default defineConfig({
  testDir: "./",
  // One worker keeps DB-resetting per test deterministic. The test suite is
  // small; parallelism would buy little here and complicate truncation.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: 0,
  reporter: isCi ? "line" : "list",

  globalSetup: "./global-setup.ts",

  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "auth-setup",
      testMatch: /setup\/auth\.setup\.ts/,
      // No storageState — this IS the project that creates it.
    },
    {
      name: "chromium",
      testDir: "./specs",
      // Skip the login spec here; it runs in its own project below so it
      // can start unauthenticated.
      testIgnore: /login\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_STORAGE_STATE,
      },
      dependencies: ["auth-setup"],
    },
    {
      name: "login",
      testDir: "./specs",
      testMatch: /login\.spec\.ts/,
      // Fresh, unauthenticated browser context so the spec drives the full
      // OIDC dance (no storageState).
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // The API server points at the TEST database. global-setup has already
      // migrated it before this command runs.
      command: "pnpm --filter @org/server dev",
      url: `${API_URL}/auth/me`,
      cwd: "../../",
      env: {
        ...process.env,
        DATABASE_URL: DATABASE_URL_TEST,
        ENV: "dev",
        PORT: "3000",
        APP_URL,
        OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
      },
      // Acceptance always spawns its own server processes — reusing a running
      // `pnpm -F @org/server dev` would mean the test runs against the *dev*
      // DB instead of the test DB (the env override below only takes effect
      // when Playwright actually starts the command). Kill dev servers
      // before running acceptance.
      reuseExistingServer: false,
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
      // Acceptance always spawns its own server processes — reusing a running
      // `pnpm -F @org/server dev` would mean the test runs against the *dev*
      // DB instead of the test DB (the env override below only takes effect
      // when Playwright actually starts the command). Kill dev servers
      // before running acceptance.
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

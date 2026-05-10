import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

// Load the repo's root .env so ZITADEL_* vars are available to global-setup
// and propagate via webServer.env to the API server.
dotenv.config({ path: "../../.env" });

// Acceptance configuration follows the layered architecture from Synapse's
// `acceptance-testing` doc: specs are business-language only, drivers/pages
// hide selectors, infrastructure (this file + global-setup.ts) wires real
// processes. The webServer entries spawn the BFF (against the test DB)
// and the Next renderer before tests run; global-setup migrates the
// test DB once and pre-seeds the admin row.
//
// Auth: an `auth-setup` project runs the real Zitadel hosted-UI login as
// admin and stamps the cookie into storageState. The `chromium` project
// depends on it and inherits the storage state so each spec starts
// authenticated. login.spec.ts opts out of the storage state to exercise
// the full UI flow on every run.

const isCi = process.env.CI !== undefined && process.env.CI !== "";
// Browser-facing origin (Next renderer; ADR-0018).
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? API_URL;
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
      // BFF, against the TEST database. global-setup has already migrated
      // it before this command runs. We run `tsx` (no watch) inside
      // playwright — `tsx watch` would compete with Next's file watcher
      // for inotify slots in CI and adds no value for a non-mutating
      // test process.
      name: "bff",
      command: "pnpm -F @org/server exec tsx src/server.ts",
      url: `${API_URL}/auth/me`,
      cwd: "../../",
      env: {
        ...process.env,
        DATABASE_URL: DATABASE_URL_TEST,
        ENV: "dev",
        PORT: "3001",
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
      // Next renderer. We run a real production build + `next start`
      // rather than `next dev` because:
      //   1. dev compiles routes lazily, so the URL probe can time out
      //      while Turbopack is still warming up — flaky in CI.
      //   2. dev installs file watchers that compete with `tsx watch`'s
      //      and the runner's own inotify slots.
      // `next start` boots in ~1s once the build has run. The build is
      // wired into a `pretest` script in @org/acceptance so a fresh
      // `pnpm test:acceptance` always sees current source. `.next/cache`
      // makes subsequent runs fast.
      //
      // SERVER_INTERNAL_URL points the /api/* rewrite at the test-DB-bound
      // BFF above. APP_URL stays :3000 so the BFF redirects post-sign-in
      // to the same origin Playwright drives.
      name: "web",
      command: "pnpm -F @org/web start",
      url: APP_URL,
      cwd: "../../",
      env: {
        ...process.env,
        SERVER_INTERNAL_URL,
        OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
      },
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

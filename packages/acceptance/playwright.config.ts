import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import * as dotenv from "dotenv";

import { acceptanceTarget } from "./test-utils/target";

// A local run reads the repo's .env for the stack it boots; a deployed run takes
// every IDENTITY_* value from the pipeline, never from a developer's .env.
if (!("ACCEPTANCE_BASE_URL" in process.env)) dotenv.config({ path: "../../.env" });

const target = acceptanceTarget();

// Acceptance configuration follows the layered architecture from Synapse's
// `acceptance-testing` doc: specs are business-language only, drivers/pages
// hide selectors, infrastructure (this file + global-setup.ts) wires real
// processes. The webServer entry spawns the Workers stack (against the test DB),
// which serves the SvelteKit app; global-setup migrates the test DB once and
// seeds the admin and the member.
//
// Auth: an `auth-setup` project signs the admin in through the identity
// Worker's real sign-in page and stamps the cookie into storageState. The `chromium` project
// depends on it and inherits the storage state so each spec starts
// authenticated. login.spec.ts opts out of the storage state to exercise
// the full UI flow on every run.

const isCi = (process.env.CI ?? "") !== "";

// Browser-facing origin (the SvelteKit Worker; ADR-0037). Browser navigation
// uses `localhost` so the session cookie set by the OIDC callback
// (registered as `http://localhost:3000/api/auth/callback`) is visible
// to the test origin — the cookie domain MUST match the registered
// redirect URI.
const APP_URL = target.appUrl;

// The readiness probe goes to 127.0.0.1 rather than localhost: on a dual-stack
// runner Node may resolve localhost to ::1, where nothing listens. The browser
// keeps localhost, which is what the app's redirect URI is registered as.
const toIpv4 = (url: string): string => url.replace(/\/\/localhost(:|\/|$)/, "//127.0.0.1$1");
const WEB_PROBE_URL = toIpv4(APP_URL);
const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

const reporter = (): NonNullable<PlaywrightTestConfig["reporter"]> => {
  if (isCi) return [["line"], ["html", { open: "never" }]];

  return "list";
};

// A deployed stage is already serving; there is nothing to boot.
const webServers = (): NonNullable<PlaywrightTestConfig["webServer"]> => {
  if (target.kind === "deployed") return [];

  return [
    {
      // The Workers stack under `alchemy dev`: the web Worker on :3000, whose /api
      // proxy is the readiness probe; the server Worker on :3001, reached through
      // the app Hyperdrive's dev origin, which DATABASE_URL points at the TEST
      // database; and the identity Worker on :3002 the global setup seeds. Without
      // `--env-file`, alchemy lets this process's environment win over .env, which
      // is what makes the override stick. SIGINT stops the whole stack, its
      // detached sidecar included.
      name: "workers",
      command: "pnpm -F @org/infra exec alchemy dev",
      url: `${WEB_PROBE_URL}/api/auth/me`,
      cwd: "../../",
      env: { ...process.env, DATABASE_URL: target.databaseUrl, APP_URL },
      gracefulShutdown: { signal: "SIGINT", timeout: 30_000 },
      // Acceptance always spawns its own stack — a running `pnpm dev` holds the
      // same ports against the dev database. Stop it before running acceptance.
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ];
};

export default defineConfig({
  testDir: "./",
  // One worker keeps DB-resetting per test deterministic. The test suite is
  // small; parallelism would buy little here and complicate truncation.
  workers: 1,
  fullyParallel: false,
  forbidOnly: isCi,
  retries: 0,
  // A terminal-only reporter writes no `playwright-report/`, which the CI
  // artifact upload expects — pair `line` with `html` so the run leaves one.
  reporter: reporter(),

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
      name: "member-setup",
      testMatch: /setup\/member\.setup\.ts/,
      // No storageState — logs in the regular member to create it.
    },
    {
      name: "chromium",
      testDir: "./specs",
      // Skip the login spec here; it runs in its own project below so it
      // can start unauthenticated.
      testIgnore: /login\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        // Default to the admin session. Org-scoped specs (add-todo) opt
        // into the member session via `test.use({ storageState })`; both
        // setups are dependencies so either cookie is ready.
        storageState: ADMIN_STORAGE_STATE,
      },
      dependencies: ["auth-setup", "member-setup"],
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

  webServer: webServers(),
});

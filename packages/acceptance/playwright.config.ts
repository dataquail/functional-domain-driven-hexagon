import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

import { acceptanceTarget } from "./test-utils/target";

// A local run reads the repo's .env for the stack it boots; a deployed run takes
// every IDENTITY_* value from the pipeline, never from a developer's .env.
if (process.env.ACCEPTANCE_BASE_URL === undefined) dotenv.config({ path: "../../.env" });

const target = acceptanceTarget();

// Acceptance configuration follows the layered architecture from Synapse's
// `acceptance-testing` doc: specs are business-language only, drivers/pages
// hide selectors, infrastructure (this file + global-setup.ts) wires real
// processes. The webServer entries spawn the Workers stack (against the test DB),
// which serves the SvelteKit renderer, or Next beside it with WEB_RENDERER=next;
// global-setup migrates the test DB once and pre-seeds the admin row.
//
// Auth: an `auth-setup` project signs the admin in through the identity
// Worker's real sign-in page and stamps the cookie into storageState. The `chromium` project
// depends on it and inherits the storage state so each spec starts
// authenticated. login.spec.ts opts out of the storage state to exercise
// the full UI flow on every run.

const isCi = process.env.CI !== undefined && process.env.CI !== "";
// Which renderer serves :3000 until Phase 7 deletes Next: the SvelteKit app,
// inside the Workers stack, or Next beside it.
const WEB_RENDERER = process.env.WEB_RENDERER === "next" ? "next" : "svelte";
// Browser-facing origin (the renderer; ADR-0018). Browser navigation
// uses `localhost` so the session cookie set by the OIDC callback
// (registered as `http://localhost:3000/api/auth/callback`) is visible
// to the test origin — the cookie domain MUST match the registered
// redirect URI.
const APP_URL = target.appUrl;
const API_URL = process.env.API_URL ?? "http://localhost:3001";
// `WEB_PROBE_URL` and `BFF_PROBE_URL` are *server-side only* readiness
// probes used by Playwright's `webServer.url`. They go to `127.0.0.1`
// instead of `localhost` to dodge an IPv6/IPv4 resolution race: Node
// 18+ uses verbatim `getaddrinfo` order, and on dual-stack runners
// `localhost` may resolve to `::1` first. The BFF binds on
// `0.0.0.0:3001` (IPv4 wildcard) — if `fetch` picks `::1` it gets
// ECONNREFUSED and Playwright's probe times out. Pinning the probes
// to `127.0.0.1` forces IPv4 and matches the BFF's listener. The
// browser-side `baseURL` (above) stays `localhost` because that's
// what the app's redirect URI is registered as.
const toIpv4 = (url: string): string => url.replace(/\/\/localhost(:|\/|$)/, "//127.0.0.1$1");
const WEB_PROBE_URL = toIpv4(APP_URL);
const BFF_PROBE_URL = toIpv4(API_URL);
// Server-side rewrite target (Next → BFF). Also pinned to IPv4 for the
// same reason; Next's `/api/*` rewrite runs server-side and is not
// browser-visible.
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? BFF_PROBE_URL;
const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

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
  reporter: isCi ? [["line"], ["html", { open: "never" }]] : "list",

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

  // A deployed stage is already serving; there is nothing to boot.
  webServer:
    target.kind === "deployed"
      ? []
      : [
          {
            // The Workers stack under `alchemy dev`: the server Worker on :3001, reached
            // through the app Hyperdrive's dev origin, which DATABASE_URL points at the
            // TEST database; the identity Worker on :3002 the global setup seeds; and,
            // for the SvelteKit renderer, the web Worker on :3000, whose /api proxy is
            // the readiness probe. Without `--env-file`, alchemy lets this process's
            // environment win over .env, which is what makes the override stick.
            // SIGINT is what stops the whole stack, its detached sidecar included.
            name: "workers",
            command: "pnpm -F @org/infra exec alchemy dev",
            url:
              WEB_RENDERER === "svelte"
                ? `${WEB_PROBE_URL}/api/auth/me`
                : `${BFF_PROBE_URL}/auth/me`,
            cwd: "../../",
            env: {
              ...process.env,
              DATABASE_URL: target.databaseUrl,
              APP_URL,
              WEB_RENDERER,
            },
            gracefulShutdown: { signal: "SIGINT", timeout: 30_000 },
            // Acceptance always spawns its own stack — a running `pnpm dev` holds the
            // same ports against the dev database. Stop it before running acceptance.
            reuseExistingServer: false,
            timeout: 180_000,
            stdout: "pipe",
            stderr: "pipe",
          },
          ...(WEB_RENDERER === "next"
            ? [
                {
                  // Next renderer: a production build + `next start`, which boots in
                  // ~1s once `test:next` has built it; `next dev` compiles routes
                  // lazily and the probe can time out. SERVER_INTERNAL_URL points the
                  // /api/* rewrite at the server Worker above.
                  name: "web",
                  command: "pnpm -F @org/web start",
                  url: WEB_PROBE_URL,
                  cwd: "../../",
                  env: {
                    ...process.env,
                    SERVER_INTERNAL_URL,
                    OTLP_URL: process.env.OTLP_URL ?? "http://localhost:4318/v1/traces",
                  },
                  reuseExistingServer: false,
                  timeout: 30_000,
                  stdout: "pipe" as const,
                  stderr: "pipe" as const,
                },
              ]
            : []),
        ],
});

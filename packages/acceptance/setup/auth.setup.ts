import { test as setup } from "@playwright/test";

import { IdentityLoginPage } from "@/drivers/pages/identity-login-page";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "@/test-utils/admin-credentials";

// Auth setup project. Runs once per Playwright invocation (before the
// `chromium` test project) and stamps the resulting session cookie into
// `playwright/.auth/admin.json` so specs can reuse it via `storageState`.
//
// It drives the identity Worker's real sign-in page rather than minting a
// session through a back door; login.spec.ts runs the same flow every run.
export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  // Next-proxied path to the BFF's /auth/login (ADR-0018 § "How the /api/*
  // proxy works"). The BFF redirects to the identity Worker's sign-in page.
  await page.goto("/api/auth/login");

  await new IdentityLoginPage(page).signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  // The seeded admin is a super-admin, redirected off the regular-user root
  // `/` to the platform org admin view — wait for that settled URL rather
  // than the transient `/`.
  try {
    await page.waitForURL(({ pathname }) => pathname === "/admin/orgs", { timeout: 15_000 });
  } catch (cause) {
    throw new Error(
      `[auth.setup] Sign-in did not land on the platform admin view.\n` +
        `  Stuck at: ${page.url()}\n` +
        `  Page title: ${await page.title()}\n` +
        `  Most common cause: the identity Worker was seeded with a different IDENTITY_ADMIN_PASSWORD.\n` +
        `  Original: ${String(cause)}`,
    );
  }

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

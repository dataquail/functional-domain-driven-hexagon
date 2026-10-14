import { expect, test } from "@playwright/test";

import { IdentityLoginPage } from "@/drivers/pages/identity-login-page";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "@/test-utils/admin-credentials";

// Login is a critical user path; it gets exercised on every run, not just in
// setup. Runs in the dedicated `login` project (no storageState) so the browser
// starts unauthenticated and drives the full OIDC dance.
test("a user can sign in through the identity Worker and land on the app", async ({ page }) => {
  await page.goto("/api/auth/login");

  await new IdentityLoginPage(page).signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

  // The seeded admin is a super-admin (`platform.roles = 'super_admin'`, see
  // admin-seed.ts); the root `/` redirects super-admins to the platform-wide
  // org admin view, which is their landing page.
  await page.waitForURL(({ pathname }) => pathname === "/admin/orgs", { timeout: 15_000 });

  // Sign-out is a plain <a href="/api/auth/logout"> (BFF logout is
  // GET-idempotent per ADR-0017).
  await expect(page.getByRole("link", { name: /sign out/i })).toBeVisible();
});

test("signing out ends both sessions and returns to sign-in without a confirmation step", async ({
  page,
}) => {
  await page.goto("/api/auth/login");
  await new IdentityLoginPage(page).signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.waitForURL(({ pathname }) => pathname === "/admin/orgs", { timeout: 15_000 });

  await page.getByRole("link", { name: /sign out/i }).click();

  // The id_token hint lets the identity Worker end its session and redirect
  // straight back; the app, now signed out, sends the browser to sign in again.
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible({ timeout: 15_000 });
  const me = await page.request.get("/api/auth/me");
  expect(me.status()).toBe(401);
});

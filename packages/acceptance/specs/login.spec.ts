import { ZitadelLoginPage } from "@/drivers/pages/zitadel-login-page";
import { expect, test } from "@playwright/test";

// Login is a critical user path; it gets exercised on every run, not just
// in setup. Runs in the dedicated `login` project (no storageState) so the
// browser starts unauthenticated and drives the full OIDC dance.
test("a user can sign in via Zitadel and land on the app", async ({ page }) => {
  const adminEmail = process.env.ZITADEL_ADMIN_EMAIL;
  const adminPassword = process.env.ZITADEL_ADMIN_PASSWORD;
  if (
    adminEmail === undefined ||
    adminEmail === "" ||
    adminPassword === undefined ||
    adminPassword === ""
  ) {
    throw new Error(
      "[login.spec] ZITADEL_ADMIN_EMAIL and ZITADEL_ADMIN_PASSWORD must be set in .env",
    );
  }

  await page.goto("/api/auth/login");

  const zitadel = new ZitadelLoginPage(page);
  await zitadel.signIn(adminEmail, adminPassword);

  await page.waitForURL(({ pathname }) => pathname === "/", { timeout: 15_000 });

  // Authenticated nav element from the root layout. Sign-out is a plain
  // <a href="/api/auth/logout"> on Next (BFF logout is GET-idempotent
  // per ADR-0017), so the role flips from button to link.
  await expect(page.getByRole("link", { name: /sign out/i })).toBeVisible();
});

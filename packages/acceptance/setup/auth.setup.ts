import { ZitadelLoginPage } from "@/drivers/pages/zitadel-login-page";
import { test as setup } from "@playwright/test";

// Auth setup project. Runs once per Playwright invocation (before the
// `chromium` test project) and stamps the resulting session cookie into
// `playwright/.auth/admin.json` so specs can reuse it via `storageState`.
//
// We deliberately drive the *real* Zitadel hosted UI rather than minting a
// session via a back-door endpoint — the user's intent (see plan §5
// revision) is for login to be a real E2E path. login.spec.ts also runs the
// flow on every test run for regression coverage.
export const ADMIN_STORAGE_STATE = "playwright/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  const adminEmail = process.env.ZITADEL_ADMIN_EMAIL;
  const adminPassword = process.env.ZITADEL_ADMIN_PASSWORD;
  if (
    adminEmail === undefined ||
    adminEmail === "" ||
    adminPassword === undefined ||
    adminPassword === ""
  ) {
    throw new Error(
      "[auth.setup] ZITADEL_ADMIN_EMAIL and ZITADEL_ADMIN_PASSWORD must be set in .env. " +
        "These must match the credentials accepted by your Zitadel instance — " +
        "verify by signing in to http://localhost:8080/ui/console first.",
    );
  }

  // SPA route that drops into our server's /auth/login (Vite proxy → :3000),
  // which redirects to Zitadel's hosted login.
  await page.goto("/auth/login");

  const zitadel = new ZitadelLoginPage(page);
  await zitadel.signIn(adminEmail, adminPassword);

  // Wait for the OIDC callback to land us back on the SPA root with a
  // session cookie set. Surface a clearer error than a bare timeout if we
  // get stuck on Zitadel (most often: bad password — see screenshot).
  try {
    await page.waitForURL(({ pathname }) => pathname === "/", { timeout: 15_000 });
  } catch (cause) {
    throw new Error(
      `[auth.setup] Sign-in did not land on the SPA root.\n` +
        `  Stuck at: ${page.url()}\n` +
        `  Page title: ${await page.title()}\n` +
        `  Most common cause: ZITADEL_ADMIN_PASSWORD doesn't match Zitadel.\n` +
        `  Original: ${String(cause)}`,
    );
  }

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});

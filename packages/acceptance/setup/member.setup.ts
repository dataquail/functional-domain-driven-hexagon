import { test as setup } from "@playwright/test";

import { ZitadelLoginPage } from "@/drivers/pages/zitadel-login-page";
import {
  MEMBER_EMAIL,
  MEMBER_PASSWORD,
  MEMBER_STORAGE_STATE,
} from "@/test-utils/member-credentials";

// Member auth-setup project. Mirrors auth.setup.ts but for the regular
// (non-super-admin) member provisioned by global-setup, stamping the
// session cookie into `playwright/.auth/member.json`. Org-scoped specs
// (e.g. add-todo) opt into this storageState — super-admins can't own
// orgs or hold todos, so those surfaces need a real member.
//
// First login JIT-provisions the member's app `users` row (sign-in.ts).
setup("authenticate as member", async ({ page }) => {
  await page.goto("/api/auth/login");

  const zitadel = new ZitadelLoginPage(page);
  await zitadel.signIn(MEMBER_EMAIL, MEMBER_PASSWORD);

  // A regular user lands on the root `/` (the org picker) — unlike a
  // super-admin, who is redirected to /admin/orgs.
  try {
    await page.waitForURL(({ pathname }) => pathname === "/", { timeout: 15_000 });
  } catch (cause) {
    throw new Error(
      `[member.setup] Member sign-in did not land on the SPA root.\n` +
        `  Stuck at: ${page.url()}\n` +
        `  Page title: ${await page.title()}\n` +
        `  Most common cause: ACCEPTANCE_MEMBER_PASSWORD doesn't satisfy the Zitadel password policy.\n` +
        `  Original: ${String(cause)}`,
    );
  }

  await page.context().storageState({ path: MEMBER_STORAGE_STATE });
});

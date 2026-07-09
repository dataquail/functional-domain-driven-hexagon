import { test } from "@playwright/test";

import { OrgTasksPage } from "@/drivers/pages/org-tasks-page";
import { RootPage } from "@/drivers/pages/root-page";
import { MEMBER_STORAGE_STATE } from "@/test-utils/member-credentials";

// Todos are org-scoped (ADR-0020), and super-admins can't own orgs, so
// this path runs as the regular member (member-setup mints the cookie).
// Each run creates a fresh org and adds a todo inside it — a brand-new
// org has no todos, so no truncation is needed for isolation.
test.use({ storageState: MEMBER_STORAGE_STATE });

test("a member can add a todo within their organization", async ({ page }) => {
  const root = new RootPage(page);
  await root.visit();
  const orgId = await root.createOrg(`Acme ${Date.now()}`);

  // createOrg navigates into the new org's tasks page on success.
  const tasks = new OrgTasksPage(page, orgId);
  await tasks.expectReady();

  await tasks.addTodo("Buy milk");

  await tasks.expectTodoVisible("Buy milk");
  await tasks.expectInputCleared();
});

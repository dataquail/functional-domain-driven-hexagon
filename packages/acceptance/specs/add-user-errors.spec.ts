import { playwrightUsersDriver } from "@org/test-drivers/adapters/playwright/users-page-driver";
import { test } from "@playwright/test";

import { truncate } from "@/test-utils/database";
import { acceptanceTarget } from "@/test-utils/target";

const target = acceptanceTarget();

test.beforeEach(async () => {
  await truncate(target, ["wallet.wallets", "user.users"]);
});

// Negative-path acceptance coverage. The Synapse acceptance-testing guide is
// explicit: "verify both happy and unhappy paths including error scenarios."
// Happy path lives in add-user.spec.ts; this file is its mirror.
//
// Two scenarios chosen for breadth:
//   1. Client-side validation (empty field) — exercises form-level rejection
//      before any request leaves the browser. Catches regressions in the
//      contract schema → form-validation glue.
//   2. Server-side 409 (duplicate email) — exercises the full
//      contract error path: server emits UserAlreadyExistsError, the
//      ApiClient decodes it as a tagged error, the ViewModel maps it to a
//      toast. Catches regressions anywhere in that chain.

test("submitting an empty email shows a field validation error", async ({ page }) => {
  const users = playwrightUsersDriver(page);
  await users.goto();

  await users.createUser({
    email: "",
    country: "USA",
    street: "123 Main St",
    postalCode: "12345",
  });

  await users.expectFieldError("email");
});

test("creating a user with a duplicate email surfaces a 409 toast", async ({ page }) => {
  const users = playwrightUsersDriver(page);
  await users.goto();

  const duplicate = {
    email: "alice@example.com",
    country: "USA",
    street: "123 Main St",
    postalCode: "12345",
  };

  await users.createUser(duplicate);
  await users.expectUserInList(duplicate.email);

  // Second submit with the same email — server returns 409
  // UserAlreadyExistsError; the presenter must surface it as a toast.
  await users.createUser(duplicate);
  await users.expectToast("error", "already exists");
});

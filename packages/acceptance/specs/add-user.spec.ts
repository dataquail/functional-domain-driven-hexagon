import { truncate } from "@/test-utils/database";
import { playwrightUsersDriver } from "@org/test-drivers/adapters/playwright/users-page-driver";
import { test } from "@playwright/test";

const DATABASE_URL_TEST =
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/effect-monorepo-test";

test.beforeEach(async () => {
  // Initialize state at the start of each spec (Synapse: "state
  // initialization, not cleanup"). users + wallets together because the
  // wallet event subscriber writes synchronously inside the create-user
  // transaction.
  await truncate(DATABASE_URL_TEST, ["wallets", "users"]);
});

test("a user can be created from the users page", async ({ page }) => {
  const users = playwrightUsersDriver(page);
  await users.goto();

  await users.createUser({
    email: "alice@example.com",
    country: "USA",
    street: "123 Main St",
    postalCode: "12345",
  });

  await users.expectUserInList("alice@example.com");
});

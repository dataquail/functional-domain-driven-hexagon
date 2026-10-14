// Integration tier worked example: render the real CreateUser +
// UserList pair against MSW-driven contract responses. The handlers
// describe what each endpoint returns for this scenario; the
// `svelteUsersDriver` exercises the same UI methods the acceptance spec
// uses against Playwright.
//
// What this tier proves that presenter tests don't: the form's
// mutation flows through the real `HttpApiClient` (schema-decoded
// against the contract), the toast surfaces through the production
// `Toast` layer rendered into the DOM by `<Toaster />`, and the
// query cache invalidation refires `UserList`'s suspense query.
//
// Per ADR-0019, handlers are stateless and order-independent. The
// "create then see in list" flow updates the list handler between
// create and assertion — MSW resolves the most recently registered
// handler first.

import { svelteUsersDriver } from "@org/test-drivers/adapters/svelte-tl/users-page-driver";
import { describe, it } from "vitest";

import { makeUser } from "@/test/fixtures";
import { handlers } from "@/test/handlers/handler-set";
import { renderWithHarness } from "@/test/integration-harness";
import { server } from "@/test/msw-server";

import TestUsersPage from "./test-users-page.svelte";

const validPayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
} as const;

describe("UsersPage — integration tier", () => {
  it("creates a user and surfaces the success toast", async () => {
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({ result: "success" }),
    );

    const rendered = renderWithHarness(TestUsersPage, {});
    const driver = svelteUsersDriver(rendered);

    await driver.goto();
    await driver.createUser(validPayload);
    await driver.expectToast("success", "User created!");
  });

  it("surfaces the server's UserAlreadyExistsError message", async () => {
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({
        result: "UserAlreadyExistsError",
        message: "That email is already taken.",
      }),
    );

    const rendered = renderWithHarness(TestUsersPage, {});
    const driver = svelteUsersDriver(rendered);

    await driver.goto();
    await driver.createUser(validPayload);
    await driver.expectToast("error", "That email is already taken.");
  });

  it("shows the new user in the list after creation", async () => {
    const newUser = makeUser({ email: validPayload.email });

    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({ result: "success", id: newUser.id }),
    );

    const rendered = renderWithHarness(TestUsersPage, {});
    const driver = svelteUsersDriver(rendered);

    await driver.goto();
    // After the create, the mutation invalidates the users query and
    // UserList refetches. Register the post-create list handler now so
    // the refetch sees the new user. MSW resolves most-recent-first.
    server.use(handlers.users.list([newUser]));

    await driver.createUser(validPayload);
    await driver.expectUserInList(validPayload.email);
  });
});

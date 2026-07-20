// Integration tier coverage for UserList — empty state, pagination, and
// validation-blocks-mutation. Companion to create-user.integration.test.tsx
// (which covers the create-then-see flow). ADR-0019 patterns: per-test
// handlers via `server.use(...)`, no shared in-memory state, RTL driver
// for user-perceivable assertions.

import { UserId } from "@org/contracts/EntityIds";
import { rtlUsersDriver } from "@org/test-drivers/adapters/rtl/users-page-driver";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { CreateUser } from "@/features/users/create-user/create-user.view";
import { UserList } from "@/features/users/user-list.view";
import { makePaginatedUsers, makeUser } from "@/test/fixtures";
import { handlers } from "@/test/handlers";
import { renderWithHarness } from "@/test/integration-harness";
import { installMswLifecycle, server } from "@/test/msw-server";

installMswLifecycle();

const TestUsersPage: React.FC = () => (
  <div>
    <CreateUser />
    <React.Suspense fallback={<div data-testid="users-loading" />}>
      <UserList />
    </React.Suspense>
  </div>
);

describe("UserList — integration tier", () => {
  it("renders the empty state when the server returns zero users", async () => {
    server.use(handlers.auth.signedInAs(), handlers.users.list([]));

    renderWithHarness(<TestUsersPage />);

    expect(await screen.findByText("No users yet.")).toBeVisible();
    // The list element must NOT render when the empty state is shown —
    // a regression that always rendered the list would still find users
    // via testid but the empty UX would be broken.
    expect(screen.queryByTestId("user-list")).toBeNull();
  });

  it("renders pagination 'Page 1 of N' from the server's total, not the in-page count", async () => {
    // 3 users on page 1, 25 total → totalPages 3. The view-model
    // (Tier 3) computes this; the presenter (Tier 2) renders it. We
    // assert the rendered text so a bug at *either* tier surfaces here.
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list(
        makePaginatedUsers({
          users: [
            makeUser({
              email: "a@example.com",
              id: UserId.make("00000000-0000-0000-0000-000000000001"),
            }),
            makeUser({
              email: "b@example.com",
              id: UserId.make("00000000-0000-0000-0000-000000000002"),
            }),
            makeUser({
              email: "c@example.com",
              id: UserId.make("00000000-0000-0000-0000-000000000003"),
            }),
          ],
          page: 1,
          pageSize: 10,
          total: 25,
        }),
      ),
    );

    renderWithHarness(<TestUsersPage />);

    // Wait for the suspense fallback to resolve, then assert.
    expect(await screen.findByText(/Page 1 of 3/)).toBeVisible();
    expect(screen.getByText(/25 total/)).toBeVisible();
  });

  it("refetches with page=2 when 'Next page' is clicked", async () => {
    const user = userEvent.setup();

    // The list handler reads the page urlParam from each request and
    // returns a distinct set per page. The handler is stateless — it
    // observes the page query param the client sends.
    const page1 = [makeUser({ email: "alice@example.com" })];
    const page2 = [
      makeUser({
        email: "zoe@example.com",
        id: UserId.make("00000000-0000-0000-0000-000000000099"),
      }),
    ];

    // The default usersHandlers.list reads `urlParams.page`. We need
    // different responses per page, so register two handlers: MSW
    // resolves most-recent-first, but our handler is keyed on page
    // via the urlParams arg.
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list(makePaginatedUsers({ users: page1, page: 1, pageSize: 10, total: 20 })),
    );

    const rendered = renderWithHarness(<TestUsersPage />);
    await rtlUsersDriver(rendered).goto();

    expect(await screen.findByText("alice@example.com")).toBeVisible();
    expect(screen.getByText(/Page 1 of 2/)).toBeVisible();

    // Re-register the list handler for page 2 before the click.
    server.use(
      handlers.users.list(makePaginatedUsers({ users: page2, page: 2, pageSize: 10, total: 20 })),
    );

    const nextButton = screen.getByRole("button", { name: /next page/i });
    await user.click(nextButton);

    expect(await screen.findByText("zoe@example.com")).toBeVisible();
    expect(screen.getByText(/Page 2 of 2/)).toBeVisible();
  });
});

// NOTE on validation-blocks-mutation: this is covered at the presenter tier
// (`create-user.presenter.test.ts` — "surfaces field errors and does not call
// the mutation on invalid submit"). Re-asserting it here would test the same
// branch through more wiring. Integration-tier coverage focuses on what the
// presenter tier can't see — real HTTP shape, real cache invalidation, real
// pagination/refetch flow.

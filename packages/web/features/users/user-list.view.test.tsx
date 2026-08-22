import type * as UserContract from "@org/contracts/api/UserContract";
import { UserId } from "@org/contracts/EntityIds";
import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { makePaginatedUsers, makeUser } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { UserList } from "./user-list.view";
import { pageAtom, usersResultAtom } from "./user-list.view-model";

// A page change re-reads the query atom, and a reactivity-wrapped atom fetches
// on mount however it was seeded -- so a View test that navigates cannot be made
// hermetic by seeding alone. MSW closes the hole: the incidental refetch is
// served locally instead of escaping to the network. The assertions below are
// still only about what the View writes into the graph.

// The handler serves the same page the atom is seeded with, so a recompute
// lands on the state the test already described rather than a different one.
const renderUserList = (page: UserContract.PaginatedUsers) => {
  server.use(usersHandlers.list(page));
  return renderView(<UserList />, {
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [usersResultAtom, AsyncResult.success(page)],
    ],
  });
};

describe("UserList view", () => {
  it("renders one row per user, with email and address", () => {
    renderUserList(
      makePaginatedUsers({
        users: [
          makeUser({ email: "ada@example.com" }),
          makeUser({
            id: UserId.make("22222222-2222-2222-2222-222222222222"),
            email: "grace@example.com",
          }),
        ],
        total: 2,
      }),
    );

    const list = screen.getByTestId("user-list");
    expect(within(list).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(list).getByText("grace@example.com")).toBeInTheDocument();
    expect(within(list).getAllByText("1 A St, 10001 US")).toHaveLength(2);
  });

  it("says so when a user has no address on file", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser({ address: null })], total: 1 }));

    expect(screen.getByText("No address on file")).toBeInTheDocument();
  });

  it("shows the empty state instead of a list when there are no users", () => {
    renderUserList(makePaginatedUsers({ users: [], total: 0 }));

    expect(screen.getByText("No users yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("user-list")).not.toBeInTheDocument();
  });

  it("reports the page position", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));

    expect(screen.getByText(/Page 1 of 3 · 25 total/)).toBeInTheDocument();
  });

  it("disables previous on the first page and enables next when more pages exist", () => {
    renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));

    expect(screen.getByTestId("pagination-previous")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).toBeEnabled();
  });

  it("dispatches a page change into the graph when next is clicked", async () => {
    const user = userEvent.setup();
    const { registry } = renderUserList(makePaginatedUsers({ users: [makeUser()], total: 25 }));
    expect(registry.get(pageAtom)).toBe(1);

    await user.click(screen.getByTestId("pagination-next"));

    // The View's job ends at the write. What page 2 then contains is the
    // ViewModel's business, and is asserted in its own test.
    expect(registry.get(pageAtom)).toBe(2);
  });
});

import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import {
  makeOrganization,
  makePaginatedOrganizations,
  ORG_B_ID,
} from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { OrgsList } from "./orgs-list.view";
import { adminOrgsResultAtom, includeDeletedAtom, pageAtom } from "./orgs-list.view-model";

// A page change or filter flip re-reads the query atom, and a reactivity-wrapped
// atom fetches on mount however it was seeded -- so a View test that navigates
// cannot be made hermetic by seeding alone. MSW closes the hole: the incidental
// refetch is served locally instead of escaping to the network. The assertions
// below are still only about what the View writes into the graph.

// The handler serves the same page the atom is seeded with, so a recompute
// lands on the state the test already described rather than a different one.
const renderList = (page: ReturnType<typeof makePaginatedOrganizations>) => {
  server.use(orgsHandlers.findAll(page));
  return renderView(<OrgsList />, {
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [adminOrgsResultAtom, AsyncResult.success(page)],
    ],
  });
};

describe("OrgsList view", () => {
  it("links an active row and leaves a deleted one as plain text", () => {
    renderList(
      makePaginatedOrganizations({
        organizations: [
          makeOrganization({ name: "Live Org" }),
          makeOrganization({
            id: ORG_B_ID,
            name: "Dead Org",
            deletedAt: makeOrganization().createdAt,
          }),
        ],
        total: 2,
      }),
    );

    const list = screen.getByTestId("admin-orgs-list");
    expect(within(list).getAllByTestId("admin-orgs-row-link")).toHaveLength(1);
    expect(within(list).getByText("Live Org")).toBeInTheDocument();
    expect(within(list).getByText("Dead Org")).toBeInTheDocument();
  });

  it("offers Delete on an active row and Restore on a deleted one", () => {
    renderList(
      makePaginatedOrganizations({
        organizations: [
          makeOrganization(),
          makeOrganization({ id: ORG_B_ID, deletedAt: makeOrganization().createdAt }),
        ],
        total: 2,
      }),
    );

    expect(screen.getAllByTestId("admin-orgs-delete")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-orgs-restore")).toHaveLength(1);
  });

  it("shows the empty state instead of a list when there are no organizations", () => {
    renderList(makePaginatedOrganizations({ organizations: [], total: 0 }));

    expect(screen.getByText("No organizations.")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-orgs-list")).not.toBeInTheDocument();
  });

  it("dispatches the deleted-filter toggle into the graph", async () => {
    const user = userEvent.setup();
    const { registry } = renderList(makePaginatedOrganizations({ total: 1 }));
    expect(screen.getByTestId("orgs-toggle-deleted")).toHaveTextContent("Show deleted");

    await user.click(screen.getByTestId("orgs-toggle-deleted"));

    expect(registry.get(includeDeletedAtom)).toBe(true);
    expect(registry.get(pageAtom)).toBe(1);
  });

  it("dispatches a page change into the graph", async () => {
    const user = userEvent.setup();
    const { registry } = renderList(makePaginatedOrganizations({ total: 25 }));

    await user.click(screen.getByTestId("pagination-next"));

    expect(registry.get(pageAtom)).toBe(2);
  });
});

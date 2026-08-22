import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { navigationRequestAtom, pathnameAtom } from "@/services/atom/navigation.shared";
import { renderView } from "@/test/atom-harness";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { OrgSwitcher } from "./org-switcher.view";
import { orgSwitcherResultAtom } from "./org-switcher.view-model";

// The handler serves the same list the atom is seeded with. Mounting the View
// mounts the query atom underneath it, which fetches however it was seeded, so
// a View test still needs the request to land somewhere.
const renderSwitcher = (
  orgs: ReadonlyArray<ReturnType<typeof makeMyOrganization>>,
  pathname = "/",
) => {
  server.use(orgsHandlers.findMine(orgs));
  return renderView(<OrgSwitcher />, {
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [orgSwitcherResultAtom, AsyncResult.success(orgs)],
      [pathnameAtom, pathname],
    ],
  });
};

describe("OrgSwitcher view", () => {
  it("renders nothing when the caller belongs to no organizations", () => {
    renderSwitcher([]);

    expect(screen.queryByTestId("org-switcher")).not.toBeInTheDocument();
  });

  it("shows the active organization's name", () => {
    renderSwitcher(
      [makeMyOrganization({ name: "Org A" }), makeMyOrganization({ id: ORG_B_ID, name: "Org B" })],
      `/orgs/${ORG_B_ID}`,
    );

    expect(screen.getByTestId("org-switcher")).toHaveTextContent("Org B");
  });

  it("dispatches a navigation when the create-new affordance is used", async () => {
    const user = userEvent.setup();
    const { registry } = renderSwitcher([makeMyOrganization()]);

    await user.click(screen.getByTestId("org-switcher-create-new"));

    expect(registry.get(navigationRequestAtom)?.href).toBe("/");
  });
});

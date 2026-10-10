import { screen, within } from "@testing-library/react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { OrgPicker } from "./org-picker.view";
import { myOrgsResultAtom } from "./org-picker.view-model";

const renderPicker = (orgs: ReadonlyArray<ReturnType<typeof makeMyOrganization>>) => {
  server.use(orgsHandlers.findMine(orgs));
  return renderView(<OrgPicker />, {
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [myOrgsResultAtom, AsyncResult.success(orgs)],
    ],
  });
};

describe("OrgPicker view", () => {
  it("renders one card per organization, linking into it", () => {
    renderPicker([
      makeMyOrganization({ name: "Org A" }),
      makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
    ]);

    const picker = screen.getByTestId("org-picker");
    const links = within(picker).getAllByTestId("org-picker-item");
    expect(links).toHaveLength(2);
    expect(within(picker).getByText("Org A")).toBeInTheDocument();
    expect(links[1]).toHaveAttribute("href", `/orgs/${ORG_B_ID}`);
  });

  it("shows the empty state instead of a grid when the caller belongs to nothing", () => {
    renderPicker([]);

    expect(screen.getByText(/don't belong to any organizations yet/)).toBeInTheDocument();
    expect(screen.queryByTestId("org-picker")).not.toBeInTheDocument();
  });
});

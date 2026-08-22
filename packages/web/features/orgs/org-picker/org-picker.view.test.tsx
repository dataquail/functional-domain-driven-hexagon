import { screen, within } from "@testing-library/react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";

import { OrgPicker } from "./org-picker.view";
import { myOrgsResultAtom } from "./org-picker.view-model";

const renderPicker = (orgs: ReadonlyArray<ReturnType<typeof makeMyOrganization>>) =>
  renderView(<OrgPicker />, {
    initialValues: [[myOrgsResultAtom, AsyncResult.success(orgs)]],
  });

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

import { screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { ORG_A_ID } from "@/test/fixtures/organization";

import OrgNav from "./org-nav.view.svelte";

describe("OrgNav view", () => {
  it("links a member to the org's tasks and members only", () => {
    renderView(OrgNav, { orgId: ORG_A_ID, isAdmin: false });

    expect(screen.getByRole("navigation", { name: "Organization" })).toBeInTheDocument();
    expect(screen.getByTestId("org-nav-tasks")).toHaveAttribute("href", `/orgs/${ORG_A_ID}`);
    expect(screen.getByTestId("org-nav-members")).toHaveAttribute(
      "href",
      `/orgs/${ORG_A_ID}/members`,
    );
    expect(screen.queryByTestId("org-nav-billing")).not.toBeInTheDocument();
    expect(screen.queryByTestId("org-nav-invite")).not.toBeInTheDocument();
  });

  it("adds billing and invite for an org admin", () => {
    renderView(OrgNav, { orgId: ORG_A_ID, isAdmin: true });

    expect(screen.getByTestId("org-nav-billing")).toHaveAttribute(
      "href",
      `/orgs/${ORG_A_ID}/billing`,
    );
    expect(screen.getByTestId("org-nav-invite")).toHaveAttribute(
      "href",
      `/orgs/${ORG_A_ID}/invite`,
    );
  });
});

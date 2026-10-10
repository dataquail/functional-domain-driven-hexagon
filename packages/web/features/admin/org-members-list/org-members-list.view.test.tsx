import { UserId } from "@org/contracts/EntityIds";
import { screen } from "@testing-library/react";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { renderView } from "@/test/atom-harness";
import { makeOrganizationMember, ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { OrgMembersList } from "./org-members-list.view";
import { orgMembersResultAtom } from "./org-members-list.view-model";

const BOB_ID = UserId.make("88888888-8888-8888-8888-888888888888");

const renderRoster = (
  members: ReadonlyArray<ReturnType<typeof makeOrganizationMember>>,
  canManage = true,
) => {
  server.use(orgsHandlers.findMembers(members));
  return renderView(<OrgMembersList orgId={ORG_A_ID} canManage={canManage} />, {
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [orgMembersResultAtom(ORG_A_ID), AsyncResult.success({ members })],
    ],
  });
};

describe("OrgMembersList view", () => {
  it("badges the admin and offers Demote for them, Promote for everyone else", () => {
    renderRoster([
      makeOrganizationMember({ isAdmin: true }),
      makeOrganizationMember({ userId: BOB_ID, email: "bob@example.com" }),
    ]);

    expect(screen.getAllByTestId("admin-org-members-admin-badge")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-org-members-demote")).toHaveLength(1);
    expect(screen.getAllByTestId("admin-org-members-promote")).toHaveLength(1);
  });

  it("hides every management control from someone who cannot manage", () => {
    renderRoster([makeOrganizationMember()], false);

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members-promote")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members-remove")).not.toBeInTheDocument();
  });

  it("shows the empty state instead of a roster when the org has no members", () => {
    renderRoster([]);

    expect(screen.getByText("No members in this organization yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-org-members")).not.toBeInTheDocument();
  });
});

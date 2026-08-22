import { InvitationId } from "@org/contracts/EntityIds";
import { screen } from "@testing-library/react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { makePendingInvitation, ORG_A_ID } from "@/test/fixtures/organization";

import { OrgInvitationsList } from "./org-invitations-list.view";
import { orgInvitationsResultAtom } from "./org-invitations-list.view-model";

const LAPSED_ID = InvitationId.make("99999999-9999-9999-9999-999999999999");

const renderInvitations = (invitations: ReadonlyArray<ReturnType<typeof makePendingInvitation>>) =>
  renderView(<OrgInvitationsList orgId={ORG_A_ID} />, {
    initialValues: [[orgInvitationsResultAtom(ORG_A_ID), AsyncResult.success({ invitations })]],
  });

describe("OrgInvitationsList view", () => {
  it("labels a live invitation Pending and a lapsed one Expired", () => {
    renderInvitations([
      makePendingInvitation(),
      makePendingInvitation({
        invitationId: LAPSED_ID,
        inviteeEmail: "lapsed@example.com",
        status: "expired",
      }),
    ]);

    const statuses = screen.getAllByTestId("org-invitations-status");
    expect(statuses.map((s) => s.textContent)).toEqual(["Pending", "Expired"]);
  });

  it("offers Resend and Revoke on every row", () => {
    renderInvitations([makePendingInvitation()]);

    expect(screen.getAllByTestId("org-invitations-resend")).toHaveLength(1);
    expect(screen.getAllByTestId("org-invitations-revoke")).toHaveLength(1);
  });

  it("shows the empty state instead of a list when nothing is outstanding", () => {
    renderInvitations([]);

    expect(screen.getByText("No pending invitations.")).toBeInTheDocument();
    expect(screen.queryByTestId("org-invitations")).not.toBeInTheDocument();
  });
});

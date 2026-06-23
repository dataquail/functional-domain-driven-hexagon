import { InvitationId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { computeOrgInvitationsListView } from "./org-invitations-list.view-model";

describe("computeOrgInvitationsListView", () => {
  it("maps invitations, formats expiry, and flags expired", () => {
    const view = computeOrgInvitationsListView({
      invitations: [
        {
          invitationId: InvitationId.make("11111111-1111-1111-1111-111111111111"),
          inviteeEmail: "pending@example.com",
          status: "pending",
          expiresAt: "2026-06-08T00:00:00.000Z",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
        {
          invitationId: InvitationId.make("22222222-2222-2222-2222-222222222222"),
          inviteeEmail: "lapsed@example.com",
          status: "expired",
          expiresAt: "2026-01-08T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    } as unknown as never);

    expect(view.rows).toHaveLength(2);
    expect(view.isEmpty).toBe(false);
    expect(view.rows[0]?.email).toBe("pending@example.com");
    expect(view.rows[0]?.isExpired).toBe(false);
    expect(view.rows[0]?.expiresAtLabel).toBe("2026-06-08");
    expect(view.rows[1]?.isExpired).toBe(true);
  });

  it("isEmpty when there are no invitations", () => {
    const view = computeOrgInvitationsListView({ invitations: [] });
    expect(view.isEmpty).toBe(true);
  });
});

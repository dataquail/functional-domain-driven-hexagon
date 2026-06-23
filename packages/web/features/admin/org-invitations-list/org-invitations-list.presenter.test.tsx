import { InvitationId, OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrgInvitationsListPresenter } from "./org-invitations-list.presenter";

const resendMutate = vi.fn();
const revokeMutate = vi.fn();
const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const invitationIdA = InvitationId.make("22222222-2222-2222-2222-222222222222");
const invitationIdB = InvitationId.make("33333333-3333-3333-3333-333333333333");

vi.mock("@/services/data-access/use-org-members-queries", () => ({
  useOrgInvitationsSuspenseQuery: () => ({
    data: {
      invitations: [
        {
          invitationId: invitationIdA,
          inviteeEmail: "pending@example.com",
          status: "pending",
          expiresAt: "2026-06-08T00:00:00.000Z",
          createdAt: "2026-06-01T00:00:00.000Z",
        },
        {
          invitationId: invitationIdB,
          inviteeEmail: "lapsed@example.com",
          status: "expired",
          expiresAt: "2026-01-08T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  }),
  useResendOrgInvitationMutation: () => ({ mutate: resendMutate, isPending: false }),
  useRevokeOrgInvitationMutation: () => ({ mutate: revokeMutate, isPending: false }),
}));

describe("useOrgInvitationsListPresenter", () => {
  beforeEach(() => {
    resendMutate.mockReset();
    revokeMutate.mockReset();
  });

  it("returns mapped rows with the expired flag", () => {
    const { result } = renderHook(() => useOrgInvitationsListPresenter(orgId));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.rows[0]?.isExpired).toBe(false);
    expect(result.current.rows[1]?.isExpired).toBe(true);
  });

  it("onResend dispatches the resend mutation with orgId + invitationId", () => {
    const { result } = renderHook(() => useOrgInvitationsListPresenter(orgId));
    act(() => {
      result.current.onResend(result.current.rows[0]);
    });
    expect(resendMutate).toHaveBeenCalledWith({ orgId, invitationId: invitationIdA });
  });

  it("onRevoke dispatches the revoke mutation", () => {
    const { result } = renderHook(() => useOrgInvitationsListPresenter(orgId));
    act(() => {
      result.current.onRevoke(result.current.rows[1]);
    });
    expect(revokeMutate).toHaveBeenCalledWith({ orgId, invitationId: invitationIdB });
  });
});

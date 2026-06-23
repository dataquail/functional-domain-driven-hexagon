import { OrganizationId, UserId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrgMembersListPresenter } from "./org-members-list.presenter";

const removeMutate = vi.fn();
const promoteMutate = vi.fn();
const demoteMutate = vi.fn();
const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const userIdA = UserId.make("22222222-2222-2222-2222-222222222222");
const userIdB = UserId.make("33333333-3333-3333-3333-333333333333");

vi.mock("@/services/data-access/use-org-members-queries", () => ({
  useOrgMembersSuspenseQuery: () => ({
    data: {
      members: [
        {
          userId: userIdA,
          email: "a@example.com",
          joinedAt: "2026-01-01T00:00:00.000Z",
          isAdmin: false,
        },
        {
          userId: userIdB,
          email: "b@example.com",
          joinedAt: "2026-01-02T00:00:00.000Z",
          isAdmin: true,
        },
      ],
    },
  }),
  useRemoveOrgMemberMutation: () => ({ mutate: removeMutate, isPending: false }),
  usePromoteOrgMemberMutation: () => ({ mutate: promoteMutate, isPending: false }),
  useDemoteOrgMemberMutation: () => ({ mutate: demoteMutate, isPending: false }),
}));

describe("useOrgMembersListPresenter", () => {
  beforeEach(() => {
    removeMutate.mockReset();
    promoteMutate.mockReset();
    demoteMutate.mockReset();
  });

  it("returns mapped rows with isAdmin", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.rows[0]?.isAdmin).toBe(false);
    expect(result.current.rows[1]?.isAdmin).toBe(true);
  });

  it("onRemove dispatches the mutation with orgId + userId", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    act(() => {
      result.current.onRemove(result.current.rows[0]);
    });
    expect(removeMutate).toHaveBeenCalledWith({ orgId, userId: userIdA });
  });

  it("onPromote dispatches the promote mutation", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    act(() => {
      result.current.onPromote(result.current.rows[0]);
    });
    expect(promoteMutate).toHaveBeenCalledWith({ orgId, userId: userIdA });
  });

  it("onDemote dispatches the demote mutation", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    act(() => {
      result.current.onDemote(result.current.rows[1]);
    });
    expect(demoteMutate).toHaveBeenCalledWith({ orgId, userId: userIdB });
  });
});

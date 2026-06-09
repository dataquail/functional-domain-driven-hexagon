import { OrganizationId, UserId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrgMembersListPresenter } from "./org-members-list.presenter";

const removeMutate = vi.fn();
const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const userIdA = UserId.make("22222222-2222-2222-2222-222222222222");

vi.mock("@/services/data-access/use-admin-org-members-queries", () => ({
  useAdminOrgMembersSuspenseQuery: () => ({
    data: {
      members: [{ userId: userIdA, email: "a@example.com", joinedAt: "2026-01-01T00:00:00.000Z" }],
    },
  }),
  useRemoveOrgMemberMutation: () => ({ mutate: removeMutate, isPending: false }),
}));

describe("useOrgMembersListPresenter", () => {
  beforeEach(() => {
    removeMutate.mockReset();
  });

  it("returns mapped rows", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.isEmpty).toBe(false);
  });

  it("onRemove dispatches the mutation with orgId + userId", () => {
    const { result } = renderHook(() => useOrgMembersListPresenter(orgId));
    act(() => {
      result.current.onRemove(result.current.rows[0]);
    });
    expect(removeMutate).toHaveBeenCalledWith({ orgId, userId: userIdA });
  });
});

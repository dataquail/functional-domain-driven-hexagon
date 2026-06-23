import { OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAcceptInvitationPresenter } from "./accept-invitation.presenter";

const push = vi.fn();
const mutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useAcceptInvitationMutation: () => ({ mutateAsync, isPending: false }),
}));

describe("useAcceptInvitationPresenter", () => {
  beforeEach(() => {
    push.mockReset();
    mutateAsync.mockReset();
  });

  it("accepts and routes into the org on success", async () => {
    const orgId = OrganizationId.make("33333333-3333-3333-3333-333333333333");
    mutateAsync.mockResolvedValueOnce({ organizationId: orgId });

    const { result } = renderHook(() => useAcceptInvitationPresenter("tok-1"));
    await act(async () => {
      await result.current.onAccept();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ token: "tok-1" });
    expect(push).toHaveBeenCalledWith(`/orgs/${orgId}`);
  });

  it("swallows mutation failure so the toast can show", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("gone"));
    const { result } = renderHook(() => useAcceptInvitationPresenter("tok-1"));
    await act(async () => {
      await result.current.onAccept();
    });
    expect(push).not.toHaveBeenCalled();
  });
});

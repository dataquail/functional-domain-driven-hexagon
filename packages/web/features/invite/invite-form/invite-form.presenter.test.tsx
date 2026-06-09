import { OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInviteFormPresenter } from "./invite-form.presenter";

const mutateAsync = vi.fn();

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useInviteUserMutation: () => ({ mutateAsync }),
}));

const orgId = OrganizationId.make("11111111-1111-1111-1111-111111111111");

describe("useInviteFormPresenter", () => {
  beforeEach(() => {
    mutateAsync.mockReset();
  });

  it("submits the decoded payload with the orgId", async () => {
    mutateAsync.mockResolvedValueOnce({ invitationId: "inv-1" });
    const { result } = renderHook(() => useInviteFormPresenter(orgId));
    result.current.form.setFieldValue("email", "new@example.com");
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(mutateAsync).toHaveBeenCalledWith({ orgId, payload: { email: "new@example.com" } });
  });
});

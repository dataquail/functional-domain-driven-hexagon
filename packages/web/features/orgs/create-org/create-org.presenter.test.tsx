// Presenter test: stubs the mutation hook + next/navigation so we can
// assert the wiring without standing up a QueryClient or a real
// router. The useForm orchestration is exercised by submitting the
// form and checking the mutation was called with the decoded payload
// and the router was pushed to the new org id.

import { OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateOrgPresenter } from "./create-org.presenter";

const push = vi.fn();
const mutateAsync = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useCreateOrganizationMutation: () => ({ mutateAsync }),
}));

describe("useCreateOrgPresenter", () => {
  beforeEach(() => {
    push.mockReset();
    mutateAsync.mockReset();
  });

  it("submits the decoded payload and navigates to the new org", async () => {
    const newId = OrganizationId.make("00000000-0000-0000-0000-000000000001");
    mutateAsync.mockResolvedValueOnce({ id: newId });

    const { result } = renderHook(() => useCreateOrgPresenter());
    result.current.form.setFieldValue("name", "Acme");

    await act(async () => {
      await result.current.form.handleSubmit();
    });

    expect(mutateAsync).toHaveBeenCalledWith({ name: "Acme" });
    expect(push).toHaveBeenCalledWith(`/orgs/${newId}`);
  });
});

import { OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrgsListPresenter } from "./orgs-list.presenter";

const softDeleteMutate = vi.fn();
const restoreMutate = vi.fn();
const queryArgs: { current: unknown } = { current: null };

const sampleResponse = {
  organizations: [
    {
      id: OrganizationId.make("11111111-1111-1111-1111-111111111111"),
      name: "A",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      deletedAt: null,
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
};

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useAdminOrgsSuspenseQuery: (args: unknown) => {
    queryArgs.current = args;
    return { data: sampleResponse };
  },
  useSoftDeleteOrganizationMutation: () => ({ mutate: softDeleteMutate }),
  useRestoreOrganizationMutation: () => ({ mutate: restoreMutate }),
}));

describe("useOrgsListPresenter", () => {
  beforeEach(() => {
    softDeleteMutate.mockReset();
    restoreMutate.mockReset();
    queryArgs.current = null;
  });

  it("queries with current paging + toggle state", () => {
    renderHook(() => useOrgsListPresenter());
    expect(queryArgs.current).toEqual({ page: 1, pageSize: 10, includeDeleted: "false" });
  });

  it("toggling includeDeleted resets to page 1 and flips the flag", () => {
    const { rerender, result } = renderHook(() => useOrgsListPresenter());
    act(() => {
      result.current.toggleIncludeDeleted();
    });
    rerender();
    expect(queryArgs.current).toEqual({ page: 1, pageSize: 10, includeDeleted: "true" });
  });

  it("onSoftDelete dispatches the mutation with the row id", () => {
    const { result } = renderHook(() => useOrgsListPresenter());
    act(() => {
      result.current.onSoftDelete(result.current.rows[0]);
    });
    expect(softDeleteMutate).toHaveBeenCalledWith({ id: sampleResponse.organizations[0].id });
  });

  it("onRestore dispatches the mutation with the row id", () => {
    const { result } = renderHook(() => useOrgsListPresenter());
    act(() => {
      result.current.onRestore(result.current.rows[0]);
    });
    expect(restoreMutate).toHaveBeenCalledWith({ id: sampleResponse.organizations[0].id });
  });
});

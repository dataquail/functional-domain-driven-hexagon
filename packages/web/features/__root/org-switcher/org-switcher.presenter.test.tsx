// Presenter test: stubs the data-access hook + next/navigation so the
// presenter can be exercised under a renderer without standing up a
// QueryClient or a real router. The view-model already has its own
// unit tests; here we cover the wiring (router.push gets the right
// href, presenter returns the view-model output).

import { OrganizationId } from "@org/contracts/EntityIds";
import { act, renderHook } from "@testing-library/react";
import * as DateTime from "effect/DateTime";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrgSwitcherPresenter } from "./org-switcher.presenter";

const push = vi.fn();
const pathname = { current: "/orgs/11111111-1111-1111-1111-111111111111/billing" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname.current,
}));

const now = DateTime.fromDateUnsafe(new Date("2026-01-01T00:00:00Z"));

const orgsData = [
  {
    id: OrganizationId.make("11111111-1111-1111-1111-111111111111"),
    name: "Org A",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
  {
    id: OrganizationId.make("22222222-2222-2222-2222-222222222222"),
    name: "Org B",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useMyOrgsSuspenseQuery: () => ({ data: orgsData }),
}));

describe("useOrgSwitcherPresenter", () => {
  beforeEach(() => {
    push.mockReset();
    pathname.current = "/orgs/11111111-1111-1111-1111-111111111111/billing";
  });

  it("returns the derived view", () => {
    const { result } = renderHook(() => useOrgSwitcherPresenter());
    expect(result.current.activeOrgId).toBe(orgsData[0].id);
    expect(result.current.options).toHaveLength(2);
    expect(result.current.isEmpty).toBe(false);
  });

  it("onSelect navigates to the matched option, preserving the sub-route", () => {
    const { result } = renderHook(() => useOrgSwitcherPresenter());
    act(() => {
      result.current.onSelect(orgsData[1].id);
    });
    expect(push).toHaveBeenCalledWith("/orgs/22222222-2222-2222-2222-222222222222/billing");
  });

  it("onSelect is a no-op for an unknown id", () => {
    const { result } = renderHook(() => useOrgSwitcherPresenter());
    act(() => {
      result.current.onSelect("99999999-9999-9999-9999-999999999999");
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("onCreateNew routes to /", () => {
    const { result } = renderHook(() => useOrgSwitcherPresenter());
    act(() => {
      result.current.onCreateNew();
    });
    expect(push).toHaveBeenCalledWith("/");
  });
});

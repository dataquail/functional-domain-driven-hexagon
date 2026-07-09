import { OrganizationId } from "@org/contracts/EntityIds";
import { renderHook } from "@testing-library/react";
import * as DateTime from "effect/DateTime";
import { describe, expect, it, vi } from "vitest";

import { useOrgPickerPresenter } from "./org-picker.presenter";

const now = DateTime.fromDateUnsafe(new Date("2026-01-01T00:00:00Z"));

const orgsData = [
  {
    id: OrganizationId.make("11111111-1111-1111-1111-111111111111"),
    name: "Org A",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  },
];

vi.mock("@/services/data-access/use-orgs-queries", () => ({
  useMyOrgsSuspenseQuery: () => ({ data: orgsData }),
}));

describe("useOrgPickerPresenter", () => {
  it("returns the list and an isEmpty flag", () => {
    const { result } = renderHook(() => useOrgPickerPresenter());
    expect(result.current.orgs).toBe(orgsData);
    expect(result.current.isEmpty).toBe(false);
  });
});

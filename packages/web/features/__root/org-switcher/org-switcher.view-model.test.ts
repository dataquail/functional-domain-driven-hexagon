import { OrganizationId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vitest";

import { computeOrgSwitcherView, extractActiveOrgId } from "./org-switcher.view-model";

const now = DateTime.unsafeFromDate(new Date("2026-01-01T00:00:00Z"));

const orgA = {
  id: OrganizationId.make("11111111-1111-1111-1111-111111111111"),
  name: "Org A",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
} as const;

const orgB = {
  id: OrganizationId.make("22222222-2222-2222-2222-222222222222"),
  name: "Org B",
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
} as const;

describe("extractActiveOrgId", () => {
  it("pulls the id segment from an /orgs/:id path", () => {
    expect(extractActiveOrgId("/orgs/11111111-1111-1111-1111-111111111111")).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
  it("pulls the id segment from a nested /orgs/:id/billing path", () => {
    expect(extractActiveOrgId("/orgs/11111111-1111-1111-1111-111111111111/billing")).toBe(
      "11111111-1111-1111-1111-111111111111",
    );
  });
  it("returns null on a non-org path", () => {
    expect(extractActiveOrgId("/")).toBeNull();
    expect(extractActiveOrgId("/admin/orgs")).toBeNull();
    expect(extractActiveOrgId("/users")).toBeNull();
  });
});

describe("computeOrgSwitcherView", () => {
  it("derives options that preserve the trailing sub-route", () => {
    const view = computeOrgSwitcherView({
      orgs: [orgA, orgB],
      pathname: "/orgs/11111111-1111-1111-1111-111111111111/billing",
    });
    expect(view.activeOrgId).toBe(orgA.id);
    expect(view.options.map((o) => o.href)).toEqual([
      "/orgs/11111111-1111-1111-1111-111111111111/billing",
      "/orgs/22222222-2222-2222-2222-222222222222/billing",
    ]);
  });

  it("from non-org paths the switch lands at the org root", () => {
    const view = computeOrgSwitcherView({ orgs: [orgA, orgB], pathname: "/admin/orgs" });
    expect(view.activeOrgId).toBeNull();
    expect(view.options.map((o) => o.href)).toEqual([`/orgs/${orgA.id}`, `/orgs/${orgB.id}`]);
  });

  it("flags an empty list", () => {
    const view = computeOrgSwitcherView({ orgs: [], pathname: "/" });
    expect(view.isEmpty).toBe(true);
  });

  it("returns null active id when the URL id doesn't match any membership", () => {
    const view = computeOrgSwitcherView({
      orgs: [orgA],
      pathname: "/orgs/99999999-9999-9999-9999-999999999999",
    });
    expect(view.activeOrgId).toBeNull();
  });
});

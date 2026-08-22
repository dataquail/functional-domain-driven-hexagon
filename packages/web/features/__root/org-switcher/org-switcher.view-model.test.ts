import { OrganizationId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { navigationRequestAtom, pathnameAtom } from "@/services/atom/navigation.shared";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  computeOrgSwitcherView,
  createNewOrgAtom,
  extractActiveOrgId,
  orgSwitcherAtom,
  orgSwitcherResultAtom,
  selectOrgAtom,
} from "./org-switcher.view-model";

const now = DateTime.fromDateUnsafe(new Date("2026-01-01T00:00:00Z"));

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

const makeRegistry = (pathname: string) =>
  AtomRegistry.make({
    initialValues: [
      [apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }],
      [pathnameAtom, pathname],
    ],
  });

const settle = (registry: AtomRegistry.AtomRegistry) =>
  Effect.runPromise(
    AtomRegistry.getResult(registry, orgSwitcherResultAtom, { suspendOnWaiting: true }),
  );

describe("org switcher ViewModel", () => {
  it("re-derives its options when the pathname changes, without refetching", async () => {
    let fetches = 0;
    server.use(
      orgsHandlers.findMine([
        makeMyOrganization({ name: "Org A" }),
        makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
      ]),
    );
    server.events.on("request:start", () => {
      fetches += 1;
    });

    const registry = makeRegistry("/");
    await settle(registry);
    expect(registry.get(orgSwitcherAtom).activeOrgId).toBeNull();

    registry.set(pathnameAtom, `/orgs/${ORG_B_ID}/billing`);

    const view = registry.get(orgSwitcherAtom);
    expect(view.activeOrgId).toBe(ORG_B_ID);
    expect(view.options.map((o) => o.href)).toEqual([
      `/orgs/${makeMyOrganization().id}/billing`,
      `/orgs/${ORG_B_ID}/billing`,
    ]);
    expect(fetches).toBe(1);
    server.events.removeAllListeners();
  });

  it("asks to navigate to the selected org's href", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization({ id: ORG_B_ID, name: "Org B" })]));

    const registry = makeRegistry("/orgs/whatever/members");
    await settle(registry);

    registry.set(selectOrgAtom, ORG_B_ID);

    expect(registry.get(navigationRequestAtom)?.href).toBe(`/orgs/${ORG_B_ID}/members`);
  });

  it("ignores a selection that is not one of the caller's orgs", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization()]));

    const registry = makeRegistry("/");
    await settle(registry);

    registry.set(selectOrgAtom, ORG_B_ID);

    expect(registry.get(navigationRequestAtom)).toBeNull();
  });

  it("sends the create-new affordance to the root picker", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization()]));

    const registry = makeRegistry("/orgs/anything");
    await settle(registry);

    registry.set(createNewOrgAtom, undefined);

    expect(registry.get(navigationRequestAtom)?.href).toBe("/");
  });
});
